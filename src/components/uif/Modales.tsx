// Formularios del módulo UIF: legajo de una persona y registro de una operación. Habita no presenta nada ante la UIF: acá se anotan datos y fechas.
import { useEffect, useState } from "react";
import { appApi } from "../../config";
import { Field, Modal } from "../ui";
import { Check, Note, numText, todayISO, toNum } from "../g1/common";
import { useContractOptions } from "../garantias/Modales";

type Flash = { show: (t: string, e?: boolean) => void; fail: (e: unknown) => void };

export function ProfileModal({ p, onClose, onDone, flash }: { p?: any | null; onClose: () => void; onDone: () => void; flash: Flash }) {
  const [people, setPeople] = useState<{ id: number; full_name: string }[]>([]);
  const [f, setF] = useState({
    party_id: String(p?.party_id || ""), risk: p?.risk || "BAJO", is_pep: !!p?.is_pep, repet_checked_on: p?.repet_checked_on || "", pep_checked_on: p?.pep_checked_on || "",
    source_of_funds_text: p?.source_of_funds_text || "", beneficial_owner_text: p?.beneficial_owner_text || "", last_review_on: p?.last_review_on || "", next_review_on: p?.next_review_on || "", notes: p?.notes || "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => { appApi<{ items: { id: number; full_name: string }[] }>("/parties?active=true").then((r) => setPeople(r.items)).catch(() => undefined); }, []);
  const set = (k: keyof typeof f, v: any) => setF((x) => ({ ...x, [k]: v }));
  const d = (v: string) => v || null;
  async function save() {
    setBusy(true); setErr("");
    try {
      const body: Record<string, unknown> = {
        risk: f.risk, is_pep: f.is_pep, repet_checked_on: d(f.repet_checked_on), pep_checked_on: d(f.pep_checked_on), source_of_funds_text: f.source_of_funds_text.trim() || null,
        beneficial_owner_text: f.beneficial_owner_text.trim() || null, last_review_on: d(f.last_review_on), next_review_on: d(f.next_review_on), notes: f.notes.trim() || null,
      };
      if (!p) body.party_id = Number(f.party_id) || null;
      await appApi(p ? `/aml/profiles/${p.id}` : "/aml/profiles", { method: p ? "PUT" : "POST", body });
      flash.show("Legajo guardado"); onDone();
    } catch (e) { setErr(e instanceof Error ? e.message : "No se pudo guardar"); } finally { setBusy(false); }
  }
  return (
    <Modal title={p ? `Legajo de ${p.party}` : "Nuevo legajo"} eyebrow="UIF" size="wide" onClose={onClose} footer={<>
      <button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={busy} onClick={save}>{busy ? "Guardando..." : "Guardar"}</button></>}>
      {err && <Note tone="error">{err}</Note>}
      <div className="g1-grid">
        {!p && <Field label="Persona" wide><select value={f.party_id} onChange={(e) => set("party_id", e.target.value)}><option value="">Elegí una persona</option>{people.map((x) => <option key={x.id} value={x.id}>{x.full_name}</option>)}</select></Field>}
        <Field label="Nivel de riesgo (lo decidís vos)"><select value={f.risk} onChange={(e) => set("risk", e.target.value)}><option value="BAJO">Bajo</option><option value="MEDIO">Medio</option><option value="ALTO">Alto</option></select></Field>
        <div className="form-group"><label>Persona expuesta políticamente</label><Check checked={f.is_pep} onChange={(v) => set("is_pep", v)}>Es PEP</Check></div>
        <Field label="Control RePET realizado el"><input type="date" max={todayISO()} value={f.repet_checked_on} onChange={(e) => set("repet_checked_on", e.target.value)} /></Field>
        <Field label="Control PEP realizado el"><input type="date" max={todayISO()} value={f.pep_checked_on} onChange={(e) => set("pep_checked_on", e.target.value)} /></Field>
        <Field label="Última revisión del legajo"><input type="date" max={todayISO()} value={f.last_review_on} onChange={(e) => set("last_review_on", e.target.value)} /></Field>
        <Field label="Próxima revisión"><input type="date" value={f.next_review_on} onChange={(e) => set("next_review_on", e.target.value)} /></Field>
      </div>
      <Field label="Origen de los fondos"><textarea rows={2} value={f.source_of_funds_text} onChange={(e) => set("source_of_funds_text", e.target.value)} /></Field>
      <Field label="Beneficiario final (si es una sociedad)"><textarea rows={2} value={f.beneficial_owner_text} onChange={(e) => set("beneficial_owner_text", e.target.value)} /></Field>
      <Field label="Notas"><textarea rows={2} value={f.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
      <p className="hb-hint">Los documentos de la persona (DNI, constancias) se suben en Documentos. Los legajos se conservan 10 años.</p>
    </Modal>
  );
}

export function OperationModal({ o, onClose, onDone, flash }: { o?: any | null; onClose: () => void; onDone: () => void; flash: Flash }) {
  const contracts = useContractOptions("");
  const [people, setPeople] = useState<{ id: number; full_name: string }[]>([]);
  const [f, setF] = useState({
    kind: o?.kind || "LOCACION", party_id: String(o?.party_id || ""), contract_id: String(o?.contract_id || ""), operation_date: o?.operation_date || todayISO(), amount_ars: numText(o?.amount_ars),
    annual: numText(o?.annual_amount_ars), fx_rate: "", cash_involved: !!o?.cash_involved, unusual: !!o?.unusual, unusual_notes: o?.unusual_notes || "", reported_on: o?.reported_on || "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => { appApi<{ items: { id: number; full_name: string }[] }>("/parties?active=true").then((r) => setPeople(r.items)).catch(() => undefined); }, []);
  const set = (k: keyof typeof f, v: any) => setF((x) => ({ ...x, [k]: v }));
  const contract = contracts.find((c) => c.id === Number(f.contract_id));
  const loc = f.kind === "LOCACION";
  async function save() {
    setBusy(true); setErr("");
    try {
      const body: Record<string, unknown> = {
        kind: f.kind, party_id: Number(f.party_id) || null, operation_date: f.operation_date || null, cash_involved: f.cash_involved, unusual: f.unusual,
        unusual_notes: f.unusual_notes.trim() || null, reported_on: f.reported_on || null,
      };
      if (loc) {
        body.contract_id = Number(f.contract_id) || null;
        if (!f.contract_id) body.amount_ars = toNum(f.annual);
        if (contract?.currency === "USD") body.fx_rate = toNum(f.fx_rate);
      } else body.amount_ars = toNum(f.amount_ars);
      await appApi(o ? `/aml/operations/${o.id}` : "/aml/operations", { method: o ? "PUT" : "POST", body });
      flash.show("Operación guardada"); onDone();
    } catch (e) { setErr(e instanceof Error ? e.message : "No se pudo guardar"); } finally { setBusy(false); }
  }
  return (
    <Modal title={o ? "Editar la operación" : "Registrar una operación"} eyebrow="UIF" size="wide" onClose={onClose} footer={<>
      <button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={busy} onClick={save}>{busy ? "Guardando..." : "Guardar"}</button></>}>
      {err && <Note tone="error">{err}</Note>}
      <div className="g1-grid">
        <Field label="Tipo"><select value={f.kind} disabled={!!o} onChange={(e) => set("kind", e.target.value)}><option value="LOCACION">Locación (alquiler)</option><option value="COMPRAVENTA">Compraventa</option></select></Field>
        <Field label="Fecha de la operación"><input type="date" value={f.operation_date} onChange={(e) => set("operation_date", e.target.value)} /></Field>
        <Field label="Cliente" wide><select value={f.party_id} onChange={(e) => set("party_id", e.target.value)}><option value="">Elegí una persona</option>{people.map((x) => <option key={x.id} value={x.id}>{x.full_name}</option>)}</select></Field>
        {loc ? <>
          <Field label="Contrato" wide hint="Con el contrato calculamos el monto anual: canon vigente × 12 (o los meses del plazo si es más corto)."><select value={f.contract_id} onChange={(e) => set("contract_id", e.target.value)}><option value="">Sin contrato (cargo el monto anual)</option>{contracts.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></Field>
          {!f.contract_id && <Field label="Monto anual en pesos"><input inputMode="decimal" value={f.annual} onChange={(e) => set("annual", e.target.value)} /></Field>}
          {contract?.currency === "USD" && <Field label="Cotización que usás (pesos por dólar)"><input inputMode="decimal" value={f.fx_rate} onChange={(e) => set("fx_rate", e.target.value)} /></Field>}
        </> : <Field label="Monto de la operación en pesos"><input inputMode="decimal" value={f.amount_ars} onChange={(e) => set("amount_ars", e.target.value)} /></Field>}
        <Field label="Presentada en el portal de la UIF el" hint="Lo cargás vos cuando presentaste. Habita no presenta nada."><input type="date" max={todayISO()} value={f.reported_on} onChange={(e) => set("reported_on", e.target.value)} /></Field>
      </div>
      <Check checked={f.cash_involved} onChange={(v) => set("cash_involved", v)}>Hubo pagos en efectivo</Check>
      <Check checked={f.unusual} onChange={(v) => set("unusual", v)}>La anoto como operación inusual en mi registro</Check>
      {f.unusual && <Field label="Por qué la anotás"><textarea rows={2} value={f.unusual_notes} onChange={(e) => set("unusual_notes", e.target.value)} /></Field>}
      <p className="hb-hint">Al guardar, marcamos si la operación está «alcanzada» comparando el total anual del cliente con 300 veces el SMVM que cargaste en Configuración. Es una ayuda: la decisión es tuya y de tu contador.</p>
    </Modal>
  );
}
