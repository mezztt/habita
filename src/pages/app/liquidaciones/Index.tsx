// Pantalla «Liquidaciones» (módulo liquidaciones, grupo G2): lo cobrado menos honorarios, por propietario y mes.
// Backend: backend/routes/liquidaciones.py · pendientes: backend/routes/liquidaciones.py -> pending_items
import { useCallback, useEffect, useState } from "react";
import { appApi, canAccess, currentPeriod, getSessionUser, isReadOnly, moneyIn, periodLabel, shiftPeriod, shortDate } from "../../../config";
import { Empty, Field, Loading, Modal, PageHeader, Pill, useFlash, useRefreshKey } from "../../../components/ui";
import { PortalLinkButton } from "../../../components/cobranzas/PortalLinks";
import { printSettlement } from "../../print/printG2";
import "../../../g2.css";

interface Row {
  id: number; owner_id: number; owner_name: string; period: string; currency: string; status: string; gross_collected: number; commission_total: number;
  commission_iva: number; deductions_total: number; net_amount: number; carried_balance_in: number; carried_balance_out: number;
  paid_on: string | null; paid_method: string | null; paid_reference: string | null; closed_at: string | null; commission_invoice_ref: string | null; notes: string | null;
}
interface Line { id: number; kind: string; kind_label: string; description: string; amount: number; share_pct: number; manual: boolean; receipt: { receipt_id: number; number_text: string; issued_on: string } | null }
interface Detail extends Row { owner_wa: string | null; lines: Line[]; editable: boolean }
interface List { period: string; items: Row[]; missing: { owner_id: number; name: string }[] }

const TONE: Record<string, [string, string]> = { BORRADOR: ["Borrador", "orange"], CERRADA: ["Cerrada", "blue"], PAGADA: ["Pagada", "green"] };
const today = () => new Date().toISOString().slice(0, 10);
const parse = (v: string) => { const s = v.trim().replace(/\s/g, ""); if (!s) return NaN; const t = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s; return Number(t); };

function LiquidacionesPage() {
  const user = getSessionUser();
  const readOnly = isReadOnly(user);
  const isAdmin = user?.role === "ADMINISTRADOR";
  const { show, fail, node } = useFlash();
  const refreshKey = useRefreshKey();
  const [period, setPeriod] = useState(currentPeriod());
  const [data, setData] = useState<List | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => { appApi<List>(`/settlements?period=${period}`).then(setData).catch(fail); }, [period, fail]);
  useEffect(load, [load, refreshKey]);

  async function generate(ownerId?: number) {
    setBusy(true);
    try {
      const r = await appApi<{ created: number; updated: number; skipped_closed: number }>(`/settlements/generate?period=${period}`, { method: "POST", body: ownerId ? { owner_id: ownerId } : {} });
      show(r.created || r.updated ? `Listo: ${r.created} nueva(s) y ${r.updated} actualizada(s)` : "No había nada nuevo para liquidar");
      load();
    } catch (e) { fail(e); } finally { setBusy(false); }
  }

  return (
    <section className="products-page">
      <PageHeader eyebrow="LIQUIDACIONES" title="Liquidaciones" subtitle="Lo cobrado menos honorarios, listo para rendir a cada propietario.">
        {!readOnly && <button className="primary-button" disabled={busy} onClick={() => generate()} data-tour="liq-generar">Generar liquidaciones del mes</button>}
      </PageHeader>
      {node}
      <div className="g2-filters">
        <div className="g2-period"><button aria-label="Mes anterior" onClick={() => setPeriod(shiftPeriod(period, -1))}>‹</button><strong>{periodLabel(period)}</strong><button aria-label="Mes siguiente" onClick={() => setPeriod(shiftPeriod(period, 1))}>›</button></div>
      </div>
      {!data ? <Loading /> : (
        <>
          {data.missing.length > 0 && (
            <div className="hb-note hb-note-warn" role="status">
              <strong>Hay cobros sin liquidar:</strong> {data.missing.map((m) => m.name || `Propietario ${m.owner_id}`).join(", ")}.
              {!readOnly && <> <button className="g2-mini" disabled={busy} onClick={() => generate()}>Generar ahora</button></>}
            </div>
          )}
          {data.items.length === 0 ? (
            <Empty title="Todavía no hay liquidaciones de este mes">Se arman con lo cobrado en el mes. Cuando haya recibos, tocá «Generar liquidaciones del mes».</Empty>
          ) : (
            <div className="g2-cards">
              {data.items.map((r) => {
                const [label, tone] = TONE[r.status] || [r.status, "gray"];
                return (
                  <article key={r.id} className="g2-card">
                    <header><h3>{r.owner_name}</h3><Pill tone={tone}>{label}</Pill></header>
                    <div className="g2-net" aria-label="Neto a pagar">{moneyIn(r.net_amount, r.currency)}</div>
                    <div className="g2-kv"><span>Cobrado</span><b>{moneyIn(r.gross_collected, r.currency)}</b></div>
                    <div className="g2-kv"><span>Comisión{r.commission_iva ? " + IVA" : ""}</span><b>{moneyIn(-(r.commission_total + r.commission_iva), r.currency)}</b></div>
                    <div className="g2-kv"><span>Gastos y descuentos</span><b>{moneyIn(-r.deductions_total, r.currency)}</b></div>
                    {r.carried_balance_in !== 0 && <div className="g2-kv"><span>Saldo anterior</span><b>{moneyIn(r.carried_balance_in, r.currency)}</b></div>}
                    {r.status === "PAGADA" && <div className="g2-kv"><span>Pagada el</span><b>{shortDate(r.paid_on)}</b></div>}
                    <div className="g2-actions" style={{ justifyContent: "flex-start", marginTop: 4 }}>
                      <button className="g2-mini is-primary" onClick={() => setOpen(r.id)}>Ver detalle</button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
          <p className="hb-hint">La rendición no es una factura. El sistema no mueve plata: registrás acá cuándo y cómo pagaste.</p>
        </>
      )}
      {open !== null && <SettlementModal id={open} readOnly={readOnly} isAdmin={isAdmin} onClose={() => setOpen(null)} onChanged={load} />}
    </section>
  );
}

function SettlementModal({ id, readOnly, isAdmin, onClose, onChanged }: { id: number; readOnly: boolean; isAdmin: boolean; onClose: () => void; onChanged: () => void }) {
  const user = getSessionUser();
  const { show, fail, node } = useFlash();
  const [d, setD] = useState<Detail | null>(null);
  const [busy, setBusy] = useState(false);
  const [manual, setManual] = useState({ kind: "GASTO", description: "", amount: "" });
  const [payOpen, setPayOpen] = useState(false);
  const [pay, setPay] = useState({ paid_on: today(), paid_method: "Transferencia", paid_reference: "" });
  const [invRef, setInvRef] = useState("");

  const load = useCallback(() => { appApi<Detail>(`/settlements/${id}`).then((x) => { setD(x); setInvRef(x.commission_invoice_ref || ""); }).catch(fail); }, [id, fail]);
  useEffect(load, [load]);

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try { await fn(); show(ok); load(); onChanged(); } catch (e) { fail(e); } finally { setBusy(false); }
  }
  async function addManual() {
    const n = parse(manual.amount);
    if (!manual.description.trim()) return fail(new Error("Escribí el motivo"));
    if (!Number.isFinite(n) || n === 0) return fail(new Error("Poné un importe distinto de cero"));
    // GASTO se resta del propietario; el importe se carga en positivo. El ajuste lleva el signo que escribas.
    const amount = manual.kind === "GASTO" ? -Math.abs(n) : n;
    await run(() => appApi(`/settlements/${id}`, { method: "PATCH", body: { add_lines: [{ kind: manual.kind, description: manual.description.trim(), amount }] } }), "Línea agregada");
    setManual({ kind: "GASTO", description: "", amount: "" });
  }
  async function discard() {
    if (!window.confirm("¿Descartar este borrador? Se vuelve a armar cuando generes de nuevo.")) return;
    setBusy(true);
    try { await appApi(`/settlements/${id}`, { method: "DELETE" }); onChanged(); onClose(); } catch (e) { fail(e); setBusy(false); }
  }
  async function print() {
    try { const p = await appApi(`/settlements/${id}/pdf`); printSettlement(p); } catch (e) { fail(e); }
  }

  if (!d) return <Modal title="Liquidación" eyebrow="LIQUIDACIONES" size="xl" onClose={onClose}>{node}<Loading /></Modal>;
  const [label, tone] = TONE[d.status] || [d.status, "gray"];
  const msg = `Hola ${d.owner_name.split(/[\s,]+/)[0]}, te paso la rendición de ${periodLabel(d.period)}: neto a transferirte ${moneyIn(d.net_amount, d.currency)}.`;
  return (
    <Modal title={`${d.owner_name} · ${periodLabel(d.period)}`} eyebrow="LIQUIDACIÓN" size="xl" onClose={onClose}
      footer={<>
        <button className="secondary-button" onClick={print}>Imprimir rendición</button>
        {d.owner_wa && <a className="secondary-button" href={`https://wa.me/${d.owner_wa.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noopener noreferrer">Avisar por WhatsApp</a>}
        {canAccess(user, "web_portal") && <PortalLinkButton partyId={d.owner_id} kind="PROPIETARIO" name={d.owner_name} label="Link del portal" />}
        {!readOnly && d.status === "BORRADOR" && <button className="hb-danger-button" disabled={busy} onClick={discard}>Descartar borrador</button>}
        {!readOnly && d.status === "BORRADOR" && <button className="primary-button" disabled={busy} onClick={() => run(() => appApi(`/settlements/${id}/close`, { method: "POST" }), "Liquidación cerrada")}>Cerrar liquidación</button>}
        {isAdmin && d.status === "CERRADA" && <button className="primary-button" onClick={() => setPayOpen(true)}>Registrar pago</button>}
      </>}>
      {node}
      <div className="hb-stack">
        <div className="hb-toolbar"><Pill tone={tone}>{label}</Pill>
          {d.status === "BORRADOR" && <span className="hb-hint">Se recalcula al cerrar. Una vez cerrada no se modifica.</span>}
          {d.status === "PAGADA" && <span className="hb-hint">Pagada el {shortDate(d.paid_on)} · {d.paid_method} · {d.paid_reference}</span>}
        </div>
        <div className="hb-table-wrap">
          <table className="hb-table">
            <thead><tr><th>Concepto</th><th className="num">Importe</th>{d.editable && !readOnly && <th />}</tr></thead>
            <tbody>
              {d.lines.length === 0 && <tr><td colSpan={3}>Sin movimientos.</td></tr>}
              {d.lines.map((l) => (
                <tr key={l.id}>
                  <td>{l.description}<small>{l.kind_label}{l.share_pct < 100 ? ` · ${l.share_pct}% del propietario` : ""}{l.receipt ? ` · recibo ${l.receipt.number_text} del ${shortDate(l.receipt.issued_on)}` : ""}</small></td>
                  <td className="num">{moneyIn(l.amount, d.currency)}</td>
                  {d.editable && !readOnly && <td className="num">{l.manual && <button className="g2-mini is-danger" disabled={busy} onClick={() => run(() => appApi(`/settlements/${id}`, { method: "PATCH", body: { remove_line_ids: [l.id] } }), "Línea quitada")}>Quitar</button>}</td>}
                </tr>
              ))}
              <tr className="g2-total-row"><td>Cobrado</td><td className="num">{moneyIn(d.gross_collected, d.currency)}</td>{d.editable && !readOnly && <td />}</tr>
              <tr><td>Comisión</td><td className="num">{moneyIn(-d.commission_total, d.currency)}</td>{d.editable && !readOnly && <td />}</tr>
              {d.commission_iva > 0 && <tr><td>IVA sobre la comisión</td><td className="num">{moneyIn(-d.commission_iva, d.currency)}</td>{d.editable && !readOnly && <td />}</tr>}
              <tr><td>Gastos y descuentos</td><td className="num">{moneyIn(-d.deductions_total, d.currency)}</td>{d.editable && !readOnly && <td />}</tr>
              {d.carried_balance_in !== 0 && <tr><td>Saldo anterior</td><td className="num">{moneyIn(d.carried_balance_in, d.currency)}</td>{d.editable && !readOnly && <td />}</tr>}
              <tr className="g2-total-row"><td>Neto a pagar</td><td className="num">{moneyIn(d.net_amount, d.currency)}</td>{d.editable && !readOnly && <td />}</tr>
            </tbody>
          </table>
        </div>
        {d.carried_balance_out > 0 && <div className="hb-note hb-note-warn">El neto quedó en cero: {moneyIn(d.carried_balance_out, d.currency)} se descuentan de la próxima liquidación.</div>}

        {d.editable && !readOnly && (
          <div className="g2-box">
            <strong>Agregar un gasto o ajuste</strong>
            <div className="g2-grid-2" style={{ marginTop: 8 }}>
              <Field label="Tipo"><select value={manual.kind} onChange={(e) => setManual({ ...manual, kind: e.target.value })}><option value="GASTO">Gasto a descontar</option><option value="AJUSTE_MANUAL">Ajuste (+ suma, − resta)</option></select></Field>
              <Field label="Importe"><input inputMode="decimal" value={manual.amount} onChange={(e) => setManual({ ...manual, amount: e.target.value })} placeholder="0" /></Field>
            </div>
            <Field label="Motivo" hint="Es obligatorio: queda en la rendición y en el registro de cambios."><input value={manual.description} onChange={(e) => setManual({ ...manual, description: e.target.value })} /></Field>
            <button className="g2-mini is-primary" style={{ marginTop: 8 }} disabled={busy} onClick={addManual}>Agregar</button>
          </div>
        )}
        {!readOnly && (
          <Field label="Factura de la comisión (referencia)" hint="El sistema no factura: anotá el número de la factura que emitiste por afuera.">
            <div className="g2-actions" style={{ justifyContent: "flex-start", flexWrap: "nowrap" }}>
              <input value={invRef} onChange={(e) => setInvRef(e.target.value)} placeholder="Ej. 0003-00001234" />
              <button className="g2-mini" disabled={busy || invRef === (d.commission_invoice_ref || "")} onClick={() => run(() => appApi(`/settlements/${id}`, { method: "PATCH", body: { commission_invoice_ref: invRef } }), "Referencia guardada")}>Guardar</button>
            </div>
          </Field>
        )}
      </div>
      {payOpen && (
        <Modal title="Registrar el pago al propietario" eyebrow="LIQUIDACIÓN" onClose={() => setPayOpen(false)} footer={<>
          <button className="secondary-button" onClick={() => setPayOpen(false)}>Cancelar</button>
          <button className="primary-button" disabled={busy || !pay.paid_reference.trim() || !pay.paid_method.trim()} onClick={() => run(async () => { await appApi(`/settlements/${id}/pay`, { method: "POST", body: pay }); setPayOpen(false); }, "Pago registrado")}>Confirmar</button></>}>
          <p className="hb-muted">Esto solo deja constancia de que transferiste {moneyIn(d.net_amount, d.currency)}. No mueve dinero.</p>
          <Field label="Fecha"><input type="date" value={pay.paid_on} onChange={(e) => setPay({ ...pay, paid_on: e.target.value })} /></Field>
          <Field label="Forma de pago"><input value={pay.paid_method} onChange={(e) => setPay({ ...pay, paid_method: e.target.value })} /></Field>
          <Field label="Referencia" hint="Número de operación, comprobante o aclaración."><input value={pay.paid_reference} onChange={(e) => setPay({ ...pay, paid_reference: e.target.value })} /></Field>
        </Modal>
      )}
    </Modal>
  );
}

export default LiquidacionesPage;
