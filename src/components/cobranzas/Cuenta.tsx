// Cuenta corriente de un contrato, cobro con recibo, cargos manuales y punitorios (módulo cobranzas, grupo G2).
// Se puede reusar en la ficha del contrato: <CuentaContrato contractId={id} onChanged={...} />
import { useCallback, useEffect, useState } from "react";
import { appApi, getSessionUser, isReadOnly, moneyIn, shortDate } from "../../config";
import { Empty, Field, Loading, Modal, Pill, useFlash } from "../ui";
import { printReceipt, printStatement, periodName } from "../../pages/print/printG2";
import "../../g2.css";

export interface AccCharge {
  id: number; period: string; concept: string; concept_label: string; description: string; amount: number; currency: string; fx_rate: number | null;
  due_date: string; status: string; paid_amount: number; balance: number; days_late: number; pending_amount: boolean; needs_fx: boolean;
  voided_reason: string | null; is_credit: boolean; payer: string; collected_by: string; paid_by: { receipt_id: number; number_text: string; amount: number; voided: boolean }[];
}
interface Account {
  contract: { id: number; number: number; status: string; address: string; currency: string; current_rent: number; tenant: { id: number; full_name: string; wa_phone: string | null } | null };
  as_of: string; grace_days: number; charges: AccCharge[]; receipts: any[];
  balances: Record<string, { debt: number; overdue: number; credit: number; net: number; overdue_count: number }>;
  late_interest: { rate: number; message: string | null; items: { charge_id: number; concept_label: string; period: string; days: number; amount: number; balance: number; currency: string; already_charged: boolean }[]; totals: Record<string, number> };
}

export const STATUS_TONE: Record<string, string> = { PENDIENTE: "orange", PARCIAL: "blue", PAGADO: "green", ANULADO: "gray" };
const METHODS: [string, string][] = [["EFECTIVO", "Efectivo"], ["TRANSFERENCIA", "Transferencia"], ["MERCADO_PAGO", "Mercado Pago"], ["CHEQUE", "Cheque"], ["OTRO", "Otro"]];
/** Acepta 1500,50 · 1.500,50 · 1500.50 · 1.500 (punto de miles) */
export const num = (v: string) => {
  const t = String(v).trim();
  if (!t) return NaN;
  const norm = t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : /\.\d{3}$/.test(t) && (t.match(/\./g) || []).length >= 1 && !/^\d+\.\d{1,2}$/.test(t) ? t.replace(/\./g, "") : t;
  const n = Number(norm);
  return Number.isFinite(n) ? n : NaN;
};
const numFree = num;

/** Mismo orden que el backend (H.4.2): punitorios, luego lo más viejo; dentro de cada período, expensas antes que alquiler */
function sortKey(c: AccCharge): string {
  return `${c.concept === "PUNITORIO" ? 0 : 1}|${c.period}|${c.concept === "ALQUILER" || c.concept === "DIFERENCIA_AJUSTE" ? 1 : 0}|${c.due_date}|${String(c.id).padStart(9, "0")}`;
}

export function CuentaContrato({ contractId, onChanged }: { contractId: number; onChanged?: () => void }) {
  const user = getSessionUser();
  const canWrite = !isReadOnly(user) && user?.role !== "AGENTE";
  const canManage = user?.role === "ADMINISTRADOR" || user?.role === "ENCARGADO";
  const { show, fail, node } = useFlash();
  const [data, setData] = useState<Account | null>(null);
  const [pay, setPay] = useState(false);
  const [manual, setManual] = useState(false);
  const [voidTarget, setVoidTarget] = useState<{ kind: "receipt" | "charge"; id: number; label: string } | null>(null);
  const [showAll, setShowAll] = useState(false);

  const load = useCallback(() => { appApi<Account>(`/contracts/${contractId}/account`).then(setData).catch(fail); }, [contractId, fail]);
  useEffect(load, [load]);
  const changed = () => { load(); onChanged?.(); };

  async function openReceipt(id: number) {
    try { printReceipt(await appApi(`/receipts/${id}/pdf`)); } catch (e) { fail(e); }
  }
  async function statement() {
    try { printStatement(await appApi(`/contracts/${contractId}/statement/pdf`)); } catch (e) { fail(e); }
  }
  async function chargeInterest(action: "CARGAR" | "CONDONAR", note?: string) {
    try {
      await appApi(`/contracts/${contractId}/late-interest/charge`, { method: "POST", body: { action, note: note || null } });
      show(action === "CARGAR" ? "Punitorio cargado" : "Punitorio condonado"); changed();
    } catch (e) { fail(e); }
  }

  if (!data) return <>{node}<Loading /></>;
  const c = data.contract;
  const open = data.charges.filter((x) => x.status !== "ANULADO" && x.payer === "INQUILINO" && x.collected_by === "INMOBILIARIA");
  const visible = (showAll ? data.charges : data.charges.filter((x) => x.status === "PENDIENTE" || x.status === "PARCIAL" || x.pending_amount)).filter((x) => showAll || x.status !== "ANULADO");
  const currencies = Object.keys(data.balances);
  const li = data.late_interest;

  return (
    <div className="hb-stack">
      {node}
      <div className="hb-card-head">
        <div><h2>Contrato N.º {c.number}</h2><p>{c.address}{c.tenant ? ` · ${c.tenant.full_name}` : ""}</p></div>
        <div className="g2-actions">
          {canWrite && <button className="primary-button" onClick={() => setPay(true)}>Cobrar</button>}
          {canWrite && <button className="secondary-button" onClick={() => setManual(true)}>Cargo manual</button>}
          <button className="secondary-button" onClick={statement}>Estado de cuenta</button>
        </div>
      </div>

      <div className="hb-kpis">
        {currencies.length === 0 && <div className="hb-kpi"><span>Saldo</span><strong>{moneyIn(0, c.currency)}</strong><small>Sin deuda</small></div>}
        {currencies.map((cur) => {
          const b = data.balances[cur];
          return (
            <div key={cur} className={`hb-kpi ${b.overdue > 0 ? "is-alert" : ""}`}>
              <span>{b.net < 0 ? "Saldo a favor" : "Debe"} ({cur})</span><strong>{moneyIn(Math.abs(b.net), cur)}</strong>
              <small>{b.overdue > 0 ? `${moneyIn(b.overdue, cur)} vencido en ${b.overdue_count} cargo(s)` : b.credit > 0 ? `Incluye ${moneyIn(b.credit, cur)} a favor` : "Nada vencido"}</small>
            </div>
          );
        })}
      </div>

      {li.items.length > 0 && (
        <div className="hb-note hb-note-warn" role="note">
          <strong>Punitorio sugerido: {Object.entries(li.totals).map(([cur, v]) => moneyIn(v, cur)).join(" + ")}</strong>
          <div>Interés simple al {li.rate}% mensual sobre {li.items.length} cargo(s) vencido(s). No se carga solo: lo decidís vos.</div>
          {canManage && (
            <div className="g2-actions" style={{ justifyContent: "flex-start", marginTop: 8 }}>
              <button className="g2-mini is-primary" onClick={() => chargeInterest("CARGAR")}>Cargar punitorio</button>
              <button className="g2-mini" onClick={() => { const n = window.prompt("¿Por qué lo condonás? (queda registrado)"); if (n && n.trim()) chargeInterest("CONDONAR", n.trim()); }}>Condonar con motivo</button>
            </div>
          )}
        </div>
      )}
      {li.message && li.items.length === 0 && Object.keys(data.balances).some((k) => data.balances[k].overdue > 0) && <div className="hb-note hb-note-info">{li.message}</div>}

      <div className="hb-toolbar" style={{ marginBottom: 0 }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Cargos</h2>
        <label className="hb-hint" style={{ display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Ver también los pagados y anulados</label>
      </div>
      {visible.length === 0 ? <Empty title="No hay cargos pendientes">Los cargos del mes aparecen cuando generás la cobranza.</Empty> : (
        <div className="hb-table-wrap">
          <table className="hb-table">
            <thead><tr><th>Concepto</th><th>Vence</th><th className="num">Importe</th><th className="num">Saldo</th><th>Estado</th><th /></tr></thead>
            <tbody>
              {visible.map((x) => (
                <tr key={x.id}>
                  <td>{x.concept_label} {periodName(x.period)}<small>{x.description}{x.paid_by.length > 0 ? ` · pagado en ${x.paid_by.filter((p) => !p.voided).map((p) => p.number_text).join(", ")}` : ""}{x.voided_reason ? ` · ${x.voided_reason}` : ""}</small></td>
                  <td>{shortDate(x.due_date)}{x.days_late > 0 && <small className="g2-late">{x.days_late} días de mora</small>}</td>
                  <td className="num">{x.pending_amount ? "Sin cargar" : moneyIn(x.amount, x.currency)}{x.needs_fx && <small>Falta cotización</small>}</td>
                  <td className="num">{moneyIn(x.balance, x.currency)}</td>
                  <td><Pill tone={STATUS_TONE[x.status] || "gray"}>{x.is_credit && x.status !== "ANULADO" ? "A favor" : x.status === "PENDIENTE" && x.days_late > 0 ? "Vencido" : x.status.charAt(0) + x.status.slice(1).toLowerCase()}</Pill></td>
                  <td className="num">{canManage && x.status !== "ANULADO" && x.paid_amount === 0 && x.payer === "INQUILINO" &&
                    <button className="g2-mini is-danger" onClick={() => setVoidTarget({ kind: "charge", id: x.id, label: `${x.concept_label} ${periodName(x.period)}` })}>Anular</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 style={{ margin: "8px 0 0", fontSize: 16 }}>Recibos</h2>
      {data.receipts.length === 0 ? <Empty title="Todavía no hay recibos" /> : (
        <div className="hb-table-wrap">
          <table className="hb-table">
            <thead><tr><th>N.º</th><th>Fecha</th><th>Forma de pago</th><th className="num">Total</th><th /></tr></thead>
            <tbody>
              {data.receipts.map((r) => (
                <tr key={r.id}>
                  <td>{r.number_text}{r.status === "ANULADO" && <small className="g2-late">Anulado: {r.voided_reason}</small>}</td>
                  <td>{shortDate(r.issued_on)}</td><td>{r.method_label}</td><td className="num">{moneyIn(r.total, r.currency)}</td>
                  <td className="num"><div className="g2-actions">
                    <button className="g2-mini" onClick={() => openReceipt(r.id)}>Imprimir</button>
                    {canManage && r.status === "EMITIDO" && <button className="g2-mini is-danger" onClick={() => setVoidTarget({ kind: "receipt", id: r.id, label: `el recibo ${r.number_text}` })}>Anular</button>}
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pay && <CobrarModal account={data} openCharges={open} onClose={() => setPay(false)} onDone={(msg, receiptId) => { setPay(false); show(msg); changed(); if (receiptId) openReceipt(receiptId); }} />}
      {manual && <ChargeModal account={data} onClose={() => setManual(false)} onDone={() => { setManual(false); show("Cargo creado"); changed(); }} />}
      {voidTarget && <VoidModal target={voidTarget} onClose={() => setVoidTarget(null)} onDone={() => { setVoidTarget(null); show("Anulado"); changed(); }} />}
    </div>
  );
}

function VoidModal({ target, onClose, onDone }: { target: { kind: "receipt" | "charge"; id: number; label: string }; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function go() {
    setBusy(true); setError("");
    try { await appApi(`/${target.kind === "receipt" ? "receipts" : "charges"}/${target.id}/void`, { method: "POST", body: { reason: reason.trim() } }); onDone(); }
    catch (e) { setError(e instanceof Error ? e.message : "No se pudo anular"); } finally { setBusy(false); }
  }
  return (
    <Modal title={`Anular ${target.label}`} eyebrow="ANULACIÓN" onClose={onClose} footer={<>
      <button className="secondary-button" onClick={onClose}>Volver</button>
      <button className="hb-danger-button" disabled={busy || reason.trim().length < 3} onClick={go}>Anular</button></>}>
      <p className="hb-muted">Nada se borra: queda anulado con tu nombre, la fecha y el motivo.{target.kind === "receipt" ? " Los cargos que pagaba vuelven a quedar pendientes." : ""}</p>
      <Field label="Motivo"><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Por ejemplo: importe mal cargado" autoFocus /></Field>
      {error && <div className="hb-note hb-note-error" role="alert">{error}</div>}
    </Modal>
  );
}

function CobrarModal({ account, openCharges, onClose, onDone }: { account: Account; openCharges: AccCharge[]; onClose: () => void; onDone: (msg: string, receiptId?: number) => void }) {
  const currencies = Array.from(new Set(openCharges.filter((c) => c.balance > 0).map((c) => c.currency)));
  const [currency, setCurrency] = useState(currencies[0] || account.contract.currency);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("EFECTIVO");
  const [issued, setIssued] = useState(account.as_of);
  const [reference, setReference] = useState("");
  const [fx, setFx] = useState("");
  const [useCredit, setUseCredit] = useState(false);
  const [pick, setPick] = useState(false);
  const [sel, setSel] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const debts = openCharges.filter((c) => c.currency === currency && c.balance > 0 && c.status !== "PAGADO").sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
  const credit = openCharges.filter((c) => c.currency === currency && c.balance < 0).reduce((s, c) => s - c.balance, 0);
  const cash = num(amount);
  let left = Number.isFinite(cash) ? cash + (useCredit ? credit : 0) : 0;
  const plan = debts.map((d) => { const take = Math.max(0, Math.min(left, d.balance)); left -= take; return { d, take }; });
  const leftover = Number.isFinite(cash) ? Math.max(0, cash - plan.reduce((s, p) => s + p.take, 0)) : 0;
  const manualTotal = Object.values(sel).reduce((s, v) => s + (numFree(v) || 0), 0);

  async function go() {
    setBusy(true); setError("");
    try {
      const body: Record<string, unknown> = { contract_id: account.contract.id, method, currency, issued_on: issued, reference: reference.trim() || null,
        use_credit: useCredit, fx_rate: currency === "USD" ? numFree(fx) : null };
      if (pick) {
        body.items = Object.entries(sel).filter(([, v]) => numFree(v) > 0).map(([id, v]) => ({ charge_id: Number(id), amount: numFree(v) }));
        if (amount.trim()) body.amount = cash;
      } else body.amount = cash;
      const r = await appApi<{ id: number; number_text: string }>("/receipts", { method: "POST", body });
      onDone(`Recibo ${r.number_text} emitido`, r.id);
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo registrar el cobro"); } finally { setBusy(false); }
  }
  const ready = pick ? manualTotal > 0 && (currency !== "USD" || numFree(fx) > 0) : Number.isFinite(cash) && cash > 0 && (currency !== "USD" || numFree(fx) > 0);

  return (
    <Modal title="Cobrar" eyebrow={`CONTRATO N.º ${account.contract.number}`} size="wide" onClose={onClose} footer={<>
      <button className="secondary-button" onClick={onClose}>Cancelar</button>
      <button className="primary-button" disabled={busy || !ready} onClick={go}>Emitir recibo</button></>}>
      <div className="product-form">
        <div className="form-row">
          {currencies.length > 1 && <Field label="Moneda"><select value={currency} onChange={(e) => { setCurrency(e.target.value); setSel({}); }}>{currencies.map((c) => <option key={c} value={c}>{c === "USD" ? "Dólares (USD)" : "Pesos ($)"}</option>)}</select></Field>}
          <Field label={pick ? `Total cobrado (opcional, ${currency})` : `Importe cobrado (${currency})`}><input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" autoFocus /></Field>
          <Field label="Forma de pago"><select value={method} onChange={(e) => setMethod(e.target.value)}>{METHODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        </div>
        <div className="form-row">
          <Field label="Fecha"><input type="date" value={issued} max={account.as_of} onChange={(e) => setIssued(e.target.value)} /></Field>
          <Field label="Referencia (opcional)"><input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="N.º de transferencia, cheque…" /></Field>
          {currency === "USD" && <Field label="Cotización usada ($ por USD)" hint="La cargás vos; el sistema no consulta cotizaciones."><input inputMode="decimal" value={fx} onChange={(e) => setFx(e.target.value)} /></Field>}
        </div>
        {credit > 0 && <label className="hb-hint" style={{ display: "flex", gap: 6, alignItems: "center" }}><input type="checkbox" checked={useCredit} onChange={(e) => setUseCredit(e.target.checked)} /> Usar el saldo a favor de {moneyIn(credit, currency)}</label>}
      </div>
      <label className="hb-hint" style={{ display: "flex", gap: 6, alignItems: "center", margin: "10px 0" }}><input type="checkbox" checked={pick} onChange={(e) => setPick(e.target.checked)} /> Elegir yo a qué cargos se aplica</label>
      {debts.length === 0 ? <div className="hb-note hb-note-info">No hay cargos pendientes en esta moneda. Lo que cobres queda como saldo a favor.</div> : (
        <div className="hb-table-wrap">
          <table className="hb-table">
            <thead><tr><th>Se aplica a</th><th className="num">Saldo</th><th className="num">{pick ? "Aplicar" : "Se imputa"}</th></tr></thead>
            <tbody>
              {(pick ? debts.map((d) => ({ d, take: 0 })) : plan).map(({ d, take }) => (
                <tr key={d.id}>
                  <td>{d.concept_label} {periodName(d.period)}<small>Vence {shortDate(d.due_date)}{d.days_late > 0 ? ` · ${d.days_late} días de mora` : ""}</small></td>
                  <td className="num">{moneyIn(d.balance, d.currency)}</td>
                  <td className="num">{pick
                    ? <input className="g2-input-num" inputMode="decimal" aria-label={`Importe para ${d.concept_label} ${d.period}`} value={sel[d.id] ?? ""} placeholder="0" onChange={(e) => setSel({ ...sel, [d.id]: e.target.value })} />
                    : (take > 0 ? <b>{moneyIn(take, d.currency)}</b> : "—")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!pick && leftover > 0 && <div className="hb-note hb-note-info" style={{ marginTop: 10 }}>Sobran {moneyIn(leftover, currency)}: quedan como saldo a favor del inquilino.</div>}
      {error && <div className="hb-note hb-note-error" role="alert" style={{ marginTop: 10 }}>{error}</div>}
    </Modal>
  );
}

function ChargeModal({ account, onClose, onDone }: { account: Account; onClose: () => void; onDone: () => void }) {
  const today = account.as_of;
  const [f, setF] = useState({ concept: "OTRO", description: "", amount: "", period: today.slice(0, 7), due: today, payer: "INQUILINO", collected_by: "INMOBILIARIA" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setF({ ...f, [k]: v });
  async function go() {
    setBusy(true); setError("");
    try {
      await appApi("/charges", { method: "POST", body: { contract_id: account.contract.id, period: f.period, concept: f.concept, description: f.description.trim(), amount: numFree(f.amount), due_date: f.due, payer: f.payer, collected_by: f.collected_by } });
      onDone();
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo crear el cargo"); } finally { setBusy(false); }
  }
  const concepts: [string, string][] = [["OTRO", "Otro"], ["ALQUILER", "Alquiler"], ["EXPENSAS_ORD", "Expensas ordinarias"], ["EXPENSAS_EXTRA", "Expensas extraordinarias"], ["ABL", "ABL"], ["AGUA", "Agua"], ["LUZ", "Luz"], ["GAS", "Gas"], ["SEGURO", "Seguro"], ["REPARACION", "Reparación"], ["COMISION_INICIO", "Comisión de inicio"], ["DEPOSITO", "Depósito"], ["DIFERENCIA_AJUSTE", "Diferencia de ajuste"]];
  return (
    <Modal title="Cargo manual" eyebrow={`CONTRATO N.º ${account.contract.number}`} onClose={onClose} footer={<>
      <button className="secondary-button" onClick={onClose}>Cancelar</button>
      <button className="primary-button" disabled={busy || f.description.trim().length < 2 || !(numFree(f.amount) > 0)} onClick={go}>Crear cargo</button></>}>
      <div className="product-form">
        <div className="form-row">
          <Field label="Concepto"><select value={f.concept} onChange={(e) => set("concept", e.target.value)}>{concepts.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
          <Field label={`Importe (${account.contract.currency})`}><input inputMode="decimal" value={f.amount} onChange={(e) => set("amount", e.target.value)} /></Field>
        </div>
        <Field label="Detalle"><input value={f.description} onChange={(e) => set("description", e.target.value)} placeholder="Por ejemplo: arreglo de la cerradura" /></Field>
        <div className="form-row">
          <Field label="Período"><input type="month" value={f.period} onChange={(e) => set("period", e.target.value)} /></Field>
          <Field label="Vence"><input type="date" value={f.due} onChange={(e) => set("due", e.target.value)} /></Field>
        </div>
        <div className="form-row">
          <Field label="Lo paga"><select value={f.payer} onChange={(e) => set("payer", e.target.value)}><option value="INQUILINO">Inquilino</option><option value="PROPIETARIO">Propietario (se descuenta en su liquidación)</option></select></Field>
          <Field label="Lo cobra"><select value={f.collected_by} onChange={(e) => set("collected_by", e.target.value)}><option value="INMOBILIARIA">La inmobiliaria</option><option value="DIRECTO">Se paga directo</option></select></Field>
        </div>
        {error && <div className="hb-note hb-note-error" role="alert">{error}</div>}
      </div>
    </Modal>
  );
}
