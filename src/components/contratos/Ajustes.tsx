// Tarjeta de un ajuste de alquiler y sus acciones: confirmar (siempre una persona), descartar con motivo, avisar por WhatsApp, recalcular.
import { useState } from "react";
import { Link } from "react-router-dom";
import { appApi, moneyIn, shortDate } from "../../config";
import { Field, Modal, Pill } from "../ui";
import { ADJ_STATUS, METHOD_LABEL, Note, daysText, numText, openWa, toNum } from "../g1/common";

export interface Adj {
  id: number | null; contract: { id: number; number: number; address: string; currency: string; tenant: string | null }; due_date: string; applies_from: string; status: string;
  method: string; index_code: string | null; previous_rent: number | null; new_rent: number | null; factor: number | null; formula_text: string | null; note: string | null;
  decided_at: string | null; notice_sent_at: string | null; days_to: number; change_pct?: number; wa: { url: string | null; text: string; to: string } | null;
}
type Flash = { show: (t: string, e?: boolean) => void; fail: (e: unknown) => void };

export function AjusteCard({ adj, canEdit, flash, onChanged, showContract = true }: { adj: Adj; canEdit: boolean; flash: Flash; onChanged: () => void; showContract?: boolean }) {
  const [modal, setModal] = useState<"apply" | "discard" | null>(null);
  const [busy, setBusy] = useState(false);
  const cur = adj.contract.currency;
  const [stLabel, stTone] = ADJ_STATUS[adj.status] || [adj.status, "gray"];
  const open = adj.status === "PROPUESTO" || adj.status === "ESPERANDO_INDICE";
  const late = open && adj.days_to < 0;

  async function propose() {
    setBusy(true);
    try { await appApi(`/contracts/${adj.contract.id}/adjustments/propose`, { method: "POST" }); flash.show("Propuesta recalculada"); onChanged(); } catch (e) { flash.fail(e); } finally { setBusy(false); }
  }
  async function wa() {
    if (!adj.wa?.url || !adj.id) return;
    openWa(adj.wa.url);
    try { await appApi(`/adjustments/${adj.id}/notice-sent`, { method: "POST" }); flash.show("Anotamos que avisaste al inquilino"); onChanged(); } catch (e) { flash.fail(e); }
  }

  return (
    <div className="g1-adj-card">
      <header>
        <div>
          {showContract && <strong>Contrato N.º {adj.contract.number} · {adj.contract.address}</strong>}
          <span className="g1-sub">{showContract && adj.contract.tenant ? `${adj.contract.tenant} · ` : ""}{METHOD_LABEL[adj.method] || adj.method}{adj.index_code ? ` ${adj.index_code}` : ""} · fecha {shortDate(adj.due_date)}{open ? ` (${daysText(adj.days_to).replace("vence", "es").replace("venció", "fue")})` : ""}</span>
        </div>
        <div className="hb-row"><Pill tone={stTone}>{stLabel}</Pill>{late && <Pill tone="red">Atrasado</Pill>}{adj.notice_sent_at && <Pill tone="green">Avisado {shortDate(adj.notice_sent_at)}</Pill>}</div>
      </header>
      <div className="g1-adj-nums">
        <span>Antes <strong>{adj.previous_rent !== null ? moneyIn(adj.previous_rent, cur) : "—"}</strong></span>
        <span>Después <strong>{adj.new_rent !== null ? moneyIn(adj.new_rent, cur) : "—"}</strong></span>
        {adj.change_pct !== undefined && <span className="g1-sub">{adj.change_pct > 0 ? "+" : ""}{String(adj.change_pct).replace(".", ",")}%</span>}
      </div>
      {adj.note && <div className="g1-sub">{adj.note}</div>}
      {adj.formula_text && <details className="g1-formula"><summary>Ver la fórmula</summary>{adj.formula_text}</details>}
      {adj.status === "ESPERANDO_INDICE" && (
        <Note tone="warn">Todavía no está cargado el índice necesario{adj.index_code ? ` (${adj.index_code})` : ""}. Cargalo en <Link to="/app/configuracion" style={{ color: "inherit", fontWeight: 800 }}>Configuración, Índices</Link> y después tocá «Recalcular». Si acordaron otro valor, descartá el ajuste y usá «Cambiar el canon» en la ficha del contrato.</Note>)}
      {canEdit && (
        <div className="g1-actions">
          {adj.status === "PROPUESTO" && <button className="g1-mini is-primary" disabled={busy} onClick={() => setModal("apply")}>Confirmar ajuste</button>}
          {open && <button className="g1-mini" disabled={busy} onClick={propose}>Recalcular</button>}
          {open && <button className="g1-mini is-danger" disabled={busy} onClick={() => setModal("discard")}>Descartar</button>}
          {adj.status === "PREVISTO" && <button className="g1-mini" disabled={busy} onClick={propose}>Proponer ahora</button>}
          {adj.wa?.url && (adj.status === "PROPUESTO" || adj.status === "APLICADO") && <button className="g1-mini" onClick={wa}>{adj.notice_sent_at ? "Avisar de nuevo por WhatsApp" : "Avisar por WhatsApp"}</button>}
        </div>)}
      {modal === "apply" && <ApplyModal adj={adj} onClose={() => setModal(null)} flash={flash} onDone={() => { setModal(null); onChanged(); }} />}
      {modal === "discard" && <DiscardModal adj={adj} onClose={() => setModal(null)} flash={flash} onDone={() => { setModal(null); onChanged(); }} />}
    </div>
  );
}

function ApplyModal({ adj, onClose, onDone, flash }: { adj: Adj; onClose: () => void; onDone: () => void; flash: Flash }) {
  const [rent, setRent] = useState(numText(adj.new_rent));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const proposed = adj.new_rent;
  const value = toNum(rent);
  const changed = proposed !== null && value !== null && Math.abs(value - proposed) > 0.004;
  async function apply() {
    if (!value || value <= 0) return setErr("Cargá el canon nuevo");
    if (changed && note.trim().length < 3) return setErr("Si cambiás el valor propuesto, anotá el motivo");
    setBusy(true); setErr("");
    try {
      const r = await appApi<{ differences: { period: string; amount: number }[] | number }>(`/adjustments/${adj.id}/apply`, { method: "POST", body: { new_rent: changed ? value : null, note: note.trim() || null } });
      const n = Array.isArray(r.differences) ? r.differences.length : Number(r.differences || 0);
      flash.show(n ? `Ajuste confirmado. Se generaron ${n} cargo${n === 1 ? "" : "s"} de diferencia por los meses ya cobrados` : "Ajuste confirmado: el canon nuevo ya rige");
      onDone();
    } catch (e) { setErr(e instanceof Error ? e.message : "No se pudo confirmar"); } finally { setBusy(false); }
  }
  return (
    <Modal title="Confirmar el ajuste" eyebrow={`CONTRATO N.º ${adj.contract.number}`} onClose={onClose} footer={<>
      <button className="secondary-button" onClick={onClose}>Cancelar</button>
      <button className="primary-button" disabled={busy} onClick={apply}>{busy ? "Confirmando..." : "Confirmar y aplicar"}</button></>}>
      {err && <Note tone="error">{err}</Note>}
      <dl className="g1-kv"><dt>Fecha del ajuste</dt><dd>{shortDate(adj.due_date)}</dd><dt>Alquiler actual</dt><dd>{adj.previous_rent !== null ? moneyIn(adj.previous_rent, adj.contract.currency) : "—"}</dd>
        <dt>Propuesto</dt><dd>{proposed !== null ? moneyIn(proposed, adj.contract.currency) : "Sin propuesta (falta el índice)"}</dd></dl>
      <Field label="Alquiler nuevo" hint={changed ? "Estás cambiando el valor propuesto: queda anotado en el historial." : "Podés corregirlo si acordaste otro valor con el propietario."}>
        <input inputMode="decimal" value={rent} onChange={(e) => setRent(e.target.value)} autoFocus /></Field>
      <Field label={changed ? "Motivo del cambio" : "Nota (opcional)"}><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Por ejemplo: acordado con el propietario" /></Field>
      <p className="hb-hint">Si el canon nuevo rige desde un mes que ya cobraste, se generan cargos por la diferencia. Esta confirmación queda en la auditoría.</p>
    </Modal>
  );
}

function DiscardModal({ adj, onClose, onDone, flash }: { adj: Adj; onClose: () => void; onDone: () => void; flash: Flash }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function go() {
    if (reason.trim().length < 3) return setErr("Escribí el motivo");
    setBusy(true); setErr("");
    try { await appApi(`/adjustments/${adj.id}/discard`, { method: "POST", body: { reason: reason.trim() } }); flash.show("Ajuste descartado: el alquiler sigue igual y se calcula el siguiente"); onDone(); }
    catch (e) { setErr(e instanceof Error ? e.message : "No se pudo descartar"); } finally { setBusy(false); }
  }
  return (
    <Modal title="Descartar el ajuste" eyebrow={`CONTRATO N.º ${adj.contract.number}`} onClose={onClose} footer={<>
      <button className="secondary-button" onClick={onClose}>Cancelar</button>
      <button className="primary-button" disabled={busy} onClick={go}>Descartar</button></>}>
      {err && <Note tone="error">{err}</Note>}
      <p className="hb-muted">El alquiler no cambia. El ajuste queda en el historial como descartado, con tu motivo.</p>
      <Field label="Motivo"><input value={reason} onChange={(e) => setReason(e.target.value)} autoFocus placeholder="Por ejemplo: se acordó mantener el valor" /></Field>
    </Modal>
  );
}
