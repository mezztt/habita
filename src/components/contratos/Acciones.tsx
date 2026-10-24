// Acciones sobre un contrato: renovar, rescindir (con el cálculo sugerido), finalizar, cambiar el canon, datos administrativos (sellado, ARCA), partes y conceptos.
import { useEffect, useState } from "react";
import { appApi, moneyIn, shortDate } from "../../config";
import { Field, Modal, Pill } from "../ui";
import { Check, Note, PLAN_CONCEPT, ROLE_LABEL, numText, todayISO, toNum } from "../g1/common";
import { PartyFormModal } from "../propiedades/PartyForm";

type Flash = { show: (t: string, e?: boolean) => void; fail: (e: unknown) => void };
interface Base { c: any; onClose: () => void; onDone: () => void; flash: Flash }

function useAction() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function run<T>(fn: () => Promise<T>, ok: (r: T) => void) {
    setBusy(true); setErr("");
    try { ok(await fn()); } catch (e) { setErr(e instanceof Error ? e.message : "No se pudo completar"); } finally { setBusy(false); }
  }
  return { busy, err, setErr, run };
}
const foot = (onClose: () => void, label: string, go: () => void, busy: boolean, disabled = false) => (
  <><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={busy || disabled} onClick={go}>{busy ? "Un momento..." : label}</button></>);

// ---------------------------------------------------------------- renovar
export function RenewModal({ c, onClose, onDone, flash, onOpen }: Base & { onOpen: (id: number) => void }) {
  const a = useAction();
  const [rent, setRent] = useState(numText(c.current_rent));
  const [start, setStart] = useState("");
  const [term, setTerm] = useState(String(c.term_months));
  return (
    <Modal title="Renovar el contrato" eyebrow={`CONTRATO N.º ${c.number}`} onClose={onClose} footer={foot(onClose, "Crear la renovación", () => {
      const v = toNum(rent);
      if (!v || v <= 0) return a.setErr("Cargá el alquiler del contrato nuevo");
      a.run(() => appApi<{ id: number; number: number; warnings: string[] }>(`/contracts/${c.id}/renew`, { method: "POST", body: { initial_rent: v, start_date: start || null, term_months: toNum(term) } }),
        (r) => { flash.show(`Se creó el borrador del contrato N.º ${r.number}. Revisalo y activalo cuando firmen.`); onDone(); onOpen(r.id); });
    }, a.busy)}>
      {a.err && <Note tone="error">{a.err}</Note>}
      <p className="hb-muted">Arma un contrato nuevo en borrador con los mismos datos. El actual pasa a «Finalizado» recién cuando actives el nuevo.</p>
      <div className="g1-grid">
        <Field label="Alquiler inicial del contrato nuevo" hint={`Hoy se paga ${moneyIn(c.current_rent, c.currency)}.`}><input inputMode="decimal" value={rent} onChange={(e) => setRent(e.target.value)} autoFocus /></Field>
        <Field label="Plazo (meses)"><input inputMode="numeric" value={term} onChange={(e) => setTerm(e.target.value)} /></Field>
        <Field label="Fecha de inicio" hint={`Si la dejás vacía empieza el día siguiente al ${shortDate(c.end_date)}.`}><input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------- rescindir
export function RescindModal({ c, onClose, onDone, flash }: Base) {
  const a = useAction();
  const [notice, setNotice] = useState(todayISO());
  const [handover, setHandover] = useState("");
  const [reason, setReason] = useState("");
  const [quote, setQuote] = useState<any>(null);
  const [result, setResult] = useState<any>(null);
  useEffect(() => {
    appApi(`/contracts/${c.id}/rescission-quote?notice=${notice}`).then(setQuote).catch(() => setQuote(null));
  }, [c.id, notice]);

  if (result) {
    return (
      <Modal title="Contrato rescindido" eyebrow={`CONTRATO N.º ${c.number}`} onClose={() => { onDone(); }} footer={<button className="primary-button" onClick={onDone}>Listo</button>}>
        <Note>Quedó registrada la rescisión. La propiedad vuelve a estar disponible y no se generan más cargos desde la entrega ({shortDate(result.handover_date)}).</Note>
        {result.quote?.calculable && <div className="g1-box" style={{ marginTop: 10 }}><strong>Indemnización sugerida: {moneyIn(result.quote.amount, result.quote.currency)}</strong><br />{result.quote.formula}<br />{result.quote.message}</div>}
        {c.deposits?.some((d: any) => d.status === "EN_CUSTODIA") && <p className="hb-muted">Hay un depósito en custodia: devolvelo o aplicalo desde Garantías.</p>}
      </Modal>);
  }
  return (
    <Modal title="Rescindir el contrato" eyebrow={`CONTRATO N.º ${c.number}`} onClose={onClose} footer={foot(onClose, "Rescindir", () => {
      if (reason.trim().length < 3) return a.setErr("Escribí el motivo de la rescisión");
      a.run(() => appApi(`/contracts/${c.id}/rescind`, { method: "POST", body: { notice_date: notice, handover_date: handover || null, reason: reason.trim() } }),
        (r) => { flash.show("Contrato rescindido"); setResult(r); });
    }, a.busy)}>
      {a.err && <Note tone="error">{a.err}</Note>}
      <div className="g1-grid">
        <Field label="Fecha en que avisó el inquilino"><input type="date" value={notice} onChange={(e) => setNotice(e.target.value)} /></Field>
        <Field label="Fecha de entrega de la propiedad" hint="Si la dejás vacía se toma la fecha del aviso."><input type="date" value={handover} onChange={(e) => setHandover(e.target.value)} /></Field>
      </div>
      <Field label="Motivo"><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Por ejemplo: el inquilino se muda" /></Field>
      {quote && (quote.calculable
        ? <div className="g1-box"><strong>Indemnización sugerida: {moneyIn(quote.amount, quote.currency)}</strong><br />{quote.formula}<br /><span className="hb-muted">{quote.message}</span></div>
        : <Note tone="warn">{quote.message}</Note>)}
      <p className="hb-hint">Rescindir es definitivo: el contrato queda en el historial y no se borra. Se cortan los cargos que corresponden a después de la entrega.</p>
    </Modal>
  );
}

// ---------------------------------------------------------------- finalizar
export function FinishModal({ c, onClose, onDone, flash }: Base) {
  const a = useAction();
  const [handover, setHandover] = useState("");
  const [note, setNote] = useState("");
  return (
    <Modal title="Finalizar el contrato" eyebrow={`CONTRATO N.º ${c.number}`} onClose={onClose} footer={foot(onClose, "Finalizar", () =>
      a.run(() => appApi(`/contracts/${c.id}/finish`, { method: "POST", body: { handover_date: handover || null, note: note.trim() || null } }), () => { flash.show("Contrato finalizado"); onDone(); }), a.busy)}>
      {a.err && <Note tone="error">{a.err}</Note>}
      <p className="hb-muted">Para un contrato que terminó su plazo y no se renueva. La propiedad vuelve a estar disponible. Si el inquilino se va antes de tiempo, usá «Rescindir».</p>
      <Field label="Fecha de entrega (opcional)"><input type="date" value={handover} onChange={(e) => setHandover(e.target.value)} /></Field>
      <Field label="Nota (opcional)"><input value={note} onChange={(e) => setNote(e.target.value)} /></Field>
    </Modal>
  );
}

// ---------------------------------------------------------------- cambiar el canon
export function RentChangeModal({ c, onClose, onDone, flash }: Base) {
  const a = useAction();
  const [rent, setRent] = useState("");
  const [from, setFrom] = useState(todayISO());
  const [reason, setReason] = useState("");
  return (
    <Modal title="Cambiar el canon a mano" eyebrow={`CONTRATO N.º ${c.number}`} onClose={onClose} footer={foot(onClose, "Cambiar el canon", () => {
      const v = toNum(rent);
      if (!v || v <= 0) return a.setErr("Cargá el canon nuevo");
      if (reason.trim().length < 3) return a.setErr("Escribí el motivo");
      a.run(() => appApi(`/contracts/${c.id}/rent-change`, { method: "POST", body: { new_rent: v, applies_from: from, reason: reason.trim() } }), () => { flash.show("Canon actualizado"); onDone(); });
    }, a.busy)}>
      {a.err && <Note tone="error">{a.err}</Note>}
      <p className="hb-muted">Para un acuerdo fuera del calendario de ajustes. Queda en el historial como «cambio manual» y en la auditoría. Hoy el alquiler es {moneyIn(c.current_rent, c.currency)}.</p>
      <div className="g1-grid">
        <Field label="Canon nuevo"><input inputMode="decimal" value={rent} onChange={(e) => setRent(e.target.value)} autoFocus /></Field>
        <Field label="Rige desde"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
      </div>
      <Field label="Motivo"><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Por ejemplo: acuerdo por escrito con el propietario" /></Field>
    </Modal>
  );
}

// ---------------------------------------------------------------- datos administrativos (sellado, ARCA, comisiones, notas)
export function AdminDataModal({ c, onClose, onDone, flash }: Base) {
  const a = useAction();
  const [f, setF] = useState({
    grace_days: numText(c.grace_days), late_interest_monthly_pct: numText(c.late_interest_monthly_pct), admin_commission_pct: numText(c.admin_commission_pct),
    tenant_commission_amount: numText(c.tenant_commission_amount), tenant_commission_paid_at: c.tenant_commission_paid_at || "",
    stamp_paid_amount: numText(c.stamp_paid_amount), stamp_paid_on: c.stamp_paid_on || "", arca_registered: !!c.arca_registered, arca_number: c.arca_number || "", arca_date: c.arca_date || "",
    early_termination_pct: numText(c.early_termination_pct), early_termination_notice_days: numText(c.early_termination_notice_days), notes: c.notes || "",
  });
  const set = (k: keyof typeof f, v: any) => setF((x) => ({ ...x, [k]: v }));
  const s = (v: string) => (v.trim() ? v.trim() : null);
  const draft = c.status === "BORRADOR";
  return (
    <Modal title="Datos administrativos" eyebrow={`CONTRATO N.º ${c.number}`} size="wide" onClose={onClose} footer={foot(onClose, "Guardar", () =>
      a.run(() => appApi(`/contracts/${c.id}`, { method: "PUT", body: {
        grace_days: toNum(f.grace_days), late_interest_monthly_pct: toNum(f.late_interest_monthly_pct), admin_commission_pct: toNum(f.admin_commission_pct),
        tenant_commission_amount: toNum(f.tenant_commission_amount) ?? 0, tenant_commission_paid_at: s(f.tenant_commission_paid_at), stamp_paid_amount: toNum(f.stamp_paid_amount),
        stamp_paid_on: s(f.stamp_paid_on), arca_registered: f.arca_registered, arca_number: s(f.arca_number), arca_date: s(f.arca_date),
        early_termination_pct: toNum(f.early_termination_pct), early_termination_notice_days: toNum(f.early_termination_notice_days), notes: s(f.notes) } }),
        () => { flash.show("Datos guardados"); onDone(); }), a.busy)}>
      {a.err && <Note tone="error">{a.err}</Note>}
      <p className="hb-form-title" style={{ marginTop: 0 }}>Mora y honorarios</p>
      <div className="g1-grid">
        <Field label="Días de gracia"><input inputMode="numeric" value={f.grace_days} onChange={(e) => set("grace_days", e.target.value)} /></Field>
        <Field label="Interés mensual por mora (%)"><input inputMode="decimal" value={f.late_interest_monthly_pct} onChange={(e) => set("late_interest_monthly_pct", e.target.value)} /></Field>
        <Field label="Comisión de administración (%)"><input inputMode="decimal" value={f.admin_commission_pct} onChange={(e) => set("admin_commission_pct", e.target.value)} /></Field>
        <Field label="Comisión al inquilino (monto)"><input inputMode="decimal" value={f.tenant_commission_amount} onChange={(e) => set("tenant_commission_amount", e.target.value)} /></Field>
        <Field label="Comisión al inquilino cobrada el"><input type="date" value={f.tenant_commission_paid_at} onChange={(e) => set("tenant_commission_paid_at", e.target.value)} /></Field>
      </div>
      <p className="hb-form-title">Sellado y ARCA</p>
      <div className="g1-grid">
        <Field label="Sellado pagado (monto)" hint={c.stamp?.calculable ? `Estimado: ${moneyIn(c.stamp.total, c.currency)}` : undefined}><input inputMode="decimal" value={f.stamp_paid_amount} onChange={(e) => set("stamp_paid_amount", e.target.value)} /></Field>
        <Field label="Sellado pagado el"><input type="date" value={f.stamp_paid_on} onChange={(e) => set("stamp_paid_on", e.target.value)} /></Field>
        <Field label="Número de registro en ARCA"><input value={f.arca_number} onChange={(e) => set("arca_number", e.target.value)} /></Field>
        <Field label="Registrado en ARCA el"><input type="date" value={f.arca_date} onChange={(e) => set("arca_date", e.target.value)} /></Field>
      </div>
      <Check checked={f.arca_registered} onChange={(v) => set("arca_registered", v)}>El contrato ya se registró en ARCA (lo hace la inmobiliaria o el propietario; Habita no presenta nada)</Check>
      <p className="hb-form-title">Rescisión y notas</p>
      <div className="g1-grid">
        <Field label="Indemnización por rescisión (%)"><input inputMode="decimal" value={f.early_termination_pct} onChange={(e) => set("early_termination_pct", e.target.value)} /></Field>
        <Field label="Preaviso (días)"><input inputMode="numeric" value={f.early_termination_notice_days} onChange={(e) => set("early_termination_notice_days", e.target.value)} /></Field>
      </div>
      <Field label="Notas internas"><textarea rows={3} value={f.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
      {!draft && <p className="hb-hint">Con el contrato activo no se cambian el plazo, el alquiler inicial ni la moneda. Para un cambio de canon usá «Cambiar el canon»; para otro plazo, renová.</p>}
    </Modal>
  );
}

// ---------------------------------------------------------------- partes
export function PartiesModal({ c, onClose, onDone, flash }: Base) {
  const a = useAction();
  const [people, setPeople] = useState<{ id: number; full_name: string }[]>([]);
  const [rows, setRows] = useState<{ role: string; party_id: number; is_primary: boolean }[]>(() => {
    const out: { role: string; party_id: number; is_primary: boolean }[] = [];
    for (const role of ["INQUILINO", "COINQUILINO", "GARANTE", "FIADOR"]) for (const p of c.parties?.[role] || []) out.push({ role, party_id: p.id, is_primary: !!p.is_primary });
    return out;
  });
  const [newOpen, setNewOpen] = useState(false);
  useEffect(() => { appApi<{ items: { id: number; full_name: string }[] }>("/parties?active=true").then((r) => setPeople(r.items)).catch(() => undefined); }, []);
  const upd = (i: number, patch: object) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <Modal title="Inquilinos y garantes" eyebrow={`CONTRATO N.º ${c.number}`} size="wide" onClose={onClose} footer={foot(onClose, "Guardar", () => {
      const list = rows.filter((r) => r.party_id);
      if (!list.some((r) => r.role === "INQUILINO")) return a.setErr("El contrato necesita un inquilino");
      a.run(() => appApi<{ warnings: string[] }>(`/contracts/${c.id}/parties`, { method: "PUT", body: { parties: list.map((r) => ({ ...r, is_primary: r.role === "INQUILINO" && (r.is_primary || list.filter((x) => x.role === "INQUILINO")[0] === r) })) } }),
        (r) => { flash.show(r.warnings?.length ? r.warnings[0] : "Partes guardadas", !!r.warnings?.length); onDone(); });
    }, a.busy)}>
      {a.err && <Note tone="error">{a.err}</Note>}
      {rows.map((r, i) => (
        <div key={i} className="g1-party-row">
          <select aria-label="Rol" value={r.role} onChange={(e) => upd(i, { role: e.target.value })}>{Object.entries(ROLE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          <select aria-label="Persona" value={r.party_id || ""} onChange={(e) => upd(i, { party_id: Number(e.target.value) })}><option value="">Elegí una persona</option>{people.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}</select>
          <span />
          <button type="button" className="g1-mini is-danger" aria-label="Quitar" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>×</button>
        </div>))}
      <div className="hb-row">
        <button type="button" className="g1-mini" onClick={() => setRows((rs) => [...rs, { role: "COINQUILINO", party_id: 0, is_primary: false }])}>Agregar persona</button>
        <button type="button" className="g1-mini" onClick={() => setNewOpen(true)}>Cargar persona nueva</button>
      </div>
      {newOpen && <PartyFormModal onClose={() => setNewOpen(false)} onSaved={(np) => { setPeople((p) => [...p, { id: np.id, full_name: np.full_name }]); setRows((rs) => [...rs, { role: "COINQUILINO", party_id: np.id, is_primary: false }]); setNewOpen(false); }} />}
    </Modal>
  );
}

// ---------------------------------------------------------------- conceptos recurrentes
export function PlanModal({ c, onClose, onDone, flash }: Base) {
  const a = useAction();
  const [rows, setRows] = useState<{ concept: string; payer: string; collected_by: string; mode: string; amount: string; active: boolean }[]>(
    (c.charge_plan || []).map((r: any) => ({ concept: r.concept, payer: r.payer, collected_by: r.collected_by, mode: r.mode, amount: numText(r.amount), active: r.active })));
  const upd = (i: number, patch: object) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  return (
    <Modal title="Conceptos que se cobran todos los meses" eyebrow={`CONTRATO N.º ${c.number}`} size="wide" onClose={onClose} footer={foot(onClose, "Guardar", () =>
      a.run(() => appApi(`/contracts/${c.id}/charge-plan`, { method: "PUT", body: { items: rows.map((r) => ({ ...r, amount: r.mode === "FIJO" ? toNum(r.amount) : null })) } }), () => { flash.show("Conceptos guardados"); onDone(); }), a.busy)}>
      {a.err && <Note tone="error">{a.err}</Note>}
      {rows.length === 0 && <p className="hb-muted">Sin conceptos: solo se cobra el alquiler.</p>}
      {rows.map((r, i) => (
        <div key={i} className="g1-grid3" style={{ marginBottom: 8, alignItems: "end" }}>
          <Field label="Concepto"><select value={r.concept} onChange={(e) => upd(i, { concept: e.target.value })}>{Object.entries(PLAN_CONCEPT).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
          <Field label="Lo paga"><select value={r.payer} onChange={(e) => upd(i, { payer: e.target.value })}><option value="INQUILINO">El inquilino</option><option value="PROPIETARIO">El propietario</option></select></Field>
          <Field label="Quién lo cobra"><select value={r.collected_by} onChange={(e) => upd(i, { collected_by: e.target.value })}><option value="INMOBILIARIA">La inmobiliaria</option><option value="DIRECTO">Se paga directo</option></select></Field>
          <Field label="Importe"><select value={r.mode} onChange={(e) => upd(i, { mode: e.target.value })}><option value="FIJO">Monto fijo</option><option value="VARIABLE">Variable</option></select></Field>
          {r.mode === "FIJO" ? <Field label="Monto"><input inputMode="decimal" value={r.amount} onChange={(e) => upd(i, { amount: e.target.value })} /></Field> : <div />}
          <div className="hb-row"><Pill tone={r.active ? "green" : "gray"}>{r.active ? "Activo" : "Pausado"}</Pill><button type="button" className="g1-mini" onClick={() => upd(i, { active: !r.active })}>{r.active ? "Pausar" : "Activar"}</button>
            <button type="button" className="g1-mini is-danger" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}>Quitar</button></div>
        </div>))}
      <button type="button" className="g1-mini" onClick={() => setRows((rs) => [...rs, { concept: "EXPENSAS_ORD", payer: "INQUILINO", collected_by: "INMOBILIARIA", mode: "VARIABLE", amount: "", active: true }])}>Agregar concepto</button>
      <p className="hb-hint">Los cargos ya generados no cambian: esto rige desde el próximo mes que generes.</p>
    </Modal>
  );
}
