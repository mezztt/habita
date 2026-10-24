// Formularios de garantías y depósitos: alta/edición de garantía, renovación, alta de depósito y devolución con descuentos.
import { useEffect, useState } from "react";
import { appApi, moneyIn, shortDate } from "../../config";
import { Field, Modal } from "../ui";
import { GUARANTEE_KIND, Note, numText, todayISO, toNum } from "../g1/common";
import { printDepositReturn } from "../../pages/print/printG1";

type Flash = { show: (t: string, e?: boolean) => void; fail: (e: unknown) => void };
export interface ContractOpt { id: number; number: number; label: string; tenant: string | null; currency: string }

export function useContractOptions(statuses = "ACTIVOS") {
  const [opts, setOpts] = useState<ContractOpt[]>([]);
  useEffect(() => {
    appApi<{ items: { id: number; number: number; property: { address: string }; tenant: { name: string } | null; currency: string }[] }>(`/contracts?status=${statuses}`)
      .then((r) => setOpts(r.items.map((c) => ({ id: c.id, number: c.number, label: `N.º ${c.number} · ${c.property.address}${c.tenant ? " · " + c.tenant.name : ""}`, tenant: c.tenant?.name || null, currency: c.currency })))).catch(() => undefined);
  }, [statuses]);
  return opts;
}

export function GuaranteeModal({ g, contractId, renew, onClose, onDone, flash }: {
  g?: any | null; contractId?: number | null; renew?: boolean; onClose: () => void; onDone: () => void; flash: Flash;
}) {
  const contracts = useContractOptions();
  const [people, setPeople] = useState<{ id: number; full_name: string }[]>([]);
  const [f, setF] = useState({
    contract_id: String(g?.contract?.id || contractId || ""), kind: g?.kind || "SEGURO_CAUCION", guarantor_party_id: renew ? String(g?.guarantor_party_id || "") : String(g?.guarantor_party_id || ""),
    insurer: g?.insurer || "", policy_number: renew ? "" : g?.policy_number || "", insured_amount: numText(g?.insured_amount), premium: renew ? "" : numText(g?.premium),
    valid_from: renew ? g?.valid_to || "" : g?.valid_from || "", valid_to: renew ? "" : g?.valid_to || "", property_ref: g?.property_ref || "", notes: g?.notes || "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => { appApi<{ items: { id: number; full_name: string }[] }>("/parties?active=true").then((r) => setPeople(r.items)).catch(() => undefined); }, []);
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  const needsTo = f.kind === "SEGURO_CAUCION" || f.kind === "AVAL_BANCARIO";
  const s = (v: string) => (v.trim() ? v.trim() : null);

  async function save() {
    setBusy(true); setErr("");
    try {
      const body: Record<string, unknown> = {
        kind: f.kind, guarantor_party_id: f.guarantor_party_id ? Number(f.guarantor_party_id) : null, insurer: s(f.insurer), policy_number: s(f.policy_number),
        insured_amount: toNum(f.insured_amount), premium: toNum(f.premium), valid_from: s(f.valid_from), valid_to: s(f.valid_to), property_ref: s(f.property_ref), notes: s(f.notes),
      };
      if (renew) await appApi(`/guarantees/${g.id}/renew`, { method: "POST", body });
      else if (g) await appApi(`/guarantees/${g.id}`, { method: "PUT", body });
      else await appApi("/guarantees", { method: "POST", body: { ...body, contract_id: Number(f.contract_id) || null } });
      flash.show(renew ? "Garantía renovada: la anterior quedó liberada" : "Garantía guardada");
      onDone();
    } catch (e) { setErr(e instanceof Error ? e.message : "No se pudo guardar"); } finally { setBusy(false); }
  }

  return (
    <Modal title={renew ? "Renovar la garantía" : g ? "Editar la garantía" : "Nueva garantía"} eyebrow="GARANTÍAS" size="wide" onClose={onClose} footer={<>
      <button className="secondary-button" onClick={onClose}>Cancelar</button>
      <button className="primary-button" disabled={busy} onClick={save}>{busy ? "Guardando..." : renew ? "Renovar" : "Guardar"}</button></>}>
      {err && <Note tone="error">{err}</Note>}
      <div className="g1-grid">
        {!g && <Field label="Contrato" wide><select value={f.contract_id} onChange={(e) => set("contract_id", e.target.value)}><option value="">Elegí un contrato</option>{contracts.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></Field>}
        <Field label="Tipo de garantía"><select value={f.kind} disabled={renew} onChange={(e) => set("kind", e.target.value)}>{Object.entries(GUARANTEE_KIND).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        {(f.kind === "FIADOR" || f.kind === "PROPIETARIA" || f.kind === "PAGARE") && (
          <Field label={f.kind === "FIADOR" ? "Fiador" : "Persona garante"}><select value={f.guarantor_party_id} onChange={(e) => set("guarantor_party_id", e.target.value)}><option value="">Elegí una persona</option>{people.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select></Field>)}
        {(f.kind === "SEGURO_CAUCION" || f.kind === "AVAL_BANCARIO") && <>
          <Field label={f.kind === "SEGURO_CAUCION" ? "Aseguradora" : "Banco"}><input value={f.insurer} onChange={(e) => set("insurer", e.target.value)} /></Field>
          <Field label="Número de póliza o aval"><input value={f.policy_number} onChange={(e) => set("policy_number", e.target.value)} /></Field>
          <Field label="Monto asegurado"><input inputMode="decimal" value={f.insured_amount} onChange={(e) => set("insured_amount", e.target.value)} /></Field>
          <Field label="Prima"><input inputMode="decimal" value={f.premium} onChange={(e) => set("premium", e.target.value)} /></Field></>}
        {f.kind === "PROPIETARIA" && <Field label="Dirección y matrícula del inmueble en garantía" wide hint="Habita no consulta el Registro de la Propiedad: cargá los datos que te dieron."><input value={f.property_ref} onChange={(e) => set("property_ref", e.target.value)} /></Field>}
        <Field label="Vigente desde"><input type="date" value={f.valid_from} onChange={(e) => set("valid_from", e.target.value)} /></Field>
        <Field label={needsTo ? "Vigente hasta (obligatorio)" : "Vigente hasta (si tiene)"} hint={needsTo ? "Sin esta fecha no podemos avisarte del vencimiento." : undefined}><input type="date" value={f.valid_to} onChange={(e) => set("valid_to", e.target.value)} /></Field>
      </div>
      <Field label="Notas"><textarea rows={2} value={f.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
    </Modal>
  );
}

export function DepositModal({ d, onClose, onDone, flash }: { d?: any | null; onClose: () => void; onDone: () => void; flash: Flash }) {
  const contracts = useContractOptions();
  const [f, setF] = useState({ contract_id: String(d?.contract?.id || ""), amount: numText(d?.amount), currency: d?.currency || "ARS", received_on: d?.received_on || "", notes: d?.notes || "" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const set = (k: keyof typeof f, v: string) => setF((x) => ({ ...x, [k]: v }));
  async function save() {
    setBusy(true); setErr("");
    try {
      const body = { amount: toNum(f.amount), currency: f.currency, received_on: f.received_on || null, notes: f.notes.trim() || null };
      if (d) await appApi(`/deposits/${d.id}`, { method: "PUT", body });
      else await appApi("/deposits", { method: "POST", body: { ...body, contract_id: Number(f.contract_id) || null } });
      flash.show("Depósito guardado"); onDone();
    } catch (e) { setErr(e instanceof Error ? e.message : "No se pudo guardar"); } finally { setBusy(false); }
  }
  return (
    <Modal title={d ? "Editar el depósito" : "Registrar un depósito"} eyebrow="DEPÓSITOS" onClose={onClose} footer={<>
      <button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={busy} onClick={save}>{busy ? "Guardando..." : "Guardar"}</button></>}>
      {err && <Note tone="error">{err}</Note>}
      {!d && <Field label="Contrato"><select value={f.contract_id} onChange={(e) => { set("contract_id", e.target.value); const c = contracts.find((x) => x.id === Number(e.target.value)); if (c && !f.amount) set("currency", c.currency); }}>
        <option value="">Elegí un contrato</option>{contracts.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select></Field>}
      <div className="g1-grid">
        <Field label="Monto" hint={!d ? "Si lo dejás vacío se toma el del contrato." : undefined}><input inputMode="decimal" value={f.amount} onChange={(e) => set("amount", e.target.value)} /></Field>
        <Field label="Moneda"><select value={f.currency} onChange={(e) => set("currency", e.target.value)}><option value="ARS">Pesos</option><option value="USD">Dólares</option></select></Field>
        <Field label="Recibido el"><input type="date" max={todayISO()} value={f.received_on} onChange={(e) => set("received_on", e.target.value)} /></Field>
      </div>
      <Field label="Notas"><input value={f.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
    </Modal>
  );
}

export function ReturnModal({ d, onClose, onDone, flash }: { d: any; onClose: () => void; onDone: () => void; flash: Flash }) {
  const [on, setOn] = useState(todayISO());
  const [quote, setQuote] = useState<any>(null);
  const [ded, setDed] = useState<{ concept: string; amount: string }[]>([]);
  const [debt, setDebt] = useState("");
  const [fx, setFx] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState<any>(null);
  useEffect(() => { appApi(`/deposits/${d.id}/return-quote?on=${on}`).then(setQuote).catch(() => setQuote(null)); }, [d.id, on]);
  const base = quote?.base_amount ?? d.amount;
  const total = ded.reduce((a, x) => a + (toNum(x.amount) || 0), 0) + (toNum(debt) || 0);
  const back = base - total;

  async function go() {
    if (ded.some((x) => !x.concept.trim() || !(toNum(x.amount) || 0))) return setErr("Cada descuento necesita un concepto y un monto");
    if (back < 0) return setErr("Los descuentos son mayores que el depósito");
    setBusy(true); setErr("");
    try {
      const r = await appApi<any>(`/deposits/${d.id}/return`, { method: "POST", body: {
        returned_on: on, deductions: ded.map((x) => ({ concept: x.concept.trim(), amount: toNum(x.amount) })), apply_to_debt: toNum(debt), fx_rate: toNum(fx), notes: notes.trim() || null } });
      flash.show("Devolución registrada"); setDone(r);
    } catch (e) { setErr(e instanceof Error ? e.message : "No se pudo registrar"); } finally { setBusy(false); }
  }
  async function print() {
    try {
      printDepositReturn({ agency: done.agency, contract: { number: d.contract.number, address: d.contract.address, tenant: d.contract.tenant }, deposit: done.deposit, result: done, returned_on: on });
    } catch (e) { flash.fail(e); }
  }

  if (done) {
    return (
      <Modal title="Depósito devuelto" eyebrow={`CONTRATO N.º ${d.contract.number}`} onClose={onDone} footer={<><button className="secondary-button" onClick={print}>Imprimir comprobante</button><button className="primary-button" onClick={onDone}>Listo</button></>}>
        <Note>Se devuelven {moneyIn(done.returned_amount, d.currency)}{done.deductions_total ? ` y se descuentan ${moneyIn(done.deductions_total, d.currency)}` : ""}.{done.receipt ? ` Parte aplicada a la deuda con el recibo ${done.receipt}.` : ""}</Note>
        <p className="hb-hint">Queda registrado en la auditoría con los descuentos.</p>
      </Modal>);
  }
  return (
    <Modal title="Devolver el depósito" eyebrow={`CONTRATO N.º ${d.contract.number}`} size="wide" onClose={onClose} footer={<>
      <button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={busy} onClick={go}>{busy ? "Registrando..." : "Registrar la devolución"}</button></>}>
      {err && <Note tone="error">{err}</Note>}
      <div className="g1-grid">
        <Field label="Fecha de devolución"><input type="date" max={todayISO()} value={on} onChange={(e) => setOn(e.target.value)} /></Field>
        <Field label="Depósito recibido"><input value={moneyIn(d.amount, d.currency)} disabled /></Field>
      </div>
      {quote?.note && <Note tone="warn">{quote.note}</Note>}
      <div className="g1-box"><strong>Base de la devolución: {moneyIn(base, d.currency)}</strong></div>
      <p className="hb-form-title">Descuentos documentados</p>
      <p className="hb-hint" style={{ margin: "0 0 8px" }}>Solo gastos que puedas respaldar con facturas o comprobantes (reparaciones, servicios adeudados).</p>
      {ded.map((x, i) => (
        <div key={i} className="g1-sched-row" style={{ gridTemplateColumns: "minmax(0,1fr) 130px 36px" }}>
          <input aria-label="Concepto" placeholder="Concepto" value={x.concept} onChange={(e) => setDed((l) => l.map((y, j) => (j === i ? { ...y, concept: e.target.value } : y)))} />
          <input aria-label="Monto" inputMode="decimal" placeholder="Monto" value={x.amount} onChange={(e) => setDed((l) => l.map((y, j) => (j === i ? { ...y, amount: e.target.value } : y)))} />
          <button type="button" className="g1-mini is-danger" aria-label="Quitar" onClick={() => setDed((l) => l.filter((_, j) => j !== i))}>×</button>
        </div>))}
      <button type="button" className="g1-mini" onClick={() => setDed((l) => [...l, { concept: "", amount: "" }])}>Agregar descuento</button>
      <div className="g1-grid" style={{ marginTop: 12 }}>
        <Field label="Aplicar a deuda del contrato (opcional)" hint="Se emite un recibo del contrato por ese monto. Necesita el módulo de Cobranza."><input inputMode="decimal" value={debt} onChange={(e) => setDebt(e.target.value)} /></Field>
        {d.currency === "USD" && toNum(debt) ? <Field label="Cotización que usás"><input inputMode="decimal" value={fx} onChange={(e) => setFx(e.target.value)} /></Field> : null}
      </div>
      <Field label="Notas (opcional)"><input value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
      <div className="g1-box"><strong>Se devuelven {moneyIn(Math.max(back, 0), d.currency)}</strong>{total > 0 && <> · descuentos {moneyIn(total, d.currency)}</>}{back < 0 && <span className="g1-late"> · los descuentos superan al depósito</span>}
        {quote?.on && <> · al {shortDate(quote.on)}</>}</div>
    </Modal>
  );
}
