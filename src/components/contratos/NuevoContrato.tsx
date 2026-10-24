// Asistente de «Nuevo contrato» en 5 pasos (también edita un borrador): propiedad y partes, plazo y canon, ajuste con vista previa,
// comisiones y depósito, garantía y conceptos. Guarda siempre como BORRADOR; recién «Activar» genera cargos y marca la propiedad alquilada.
import { useCallback, useEffect, useMemo, useState } from "react";
import { appApi, canAccess, getSessionUser, moneyIn, shortDate } from "../../config";
import { Field, Loading, Modal, Pill } from "../ui";
import { Check, CONTRACT_STATUS, DEPOSIT_MODE_LABEL, FX_RULE_LABEL, METHOD_LABEL, Note, PLAN_CONCEPT, PURPOSE_LABEL, REGIME_LABEL, ROLE_LABEL, numText, todayISO, toNum } from "../g1/common";
import { PartyFormModal } from "../propiedades/PartyForm";

interface Lookups {
  properties: { id: number; code: string; label: string; status: string; kind: string; list_price: number | null; list_currency: string | null; has_active_contract: boolean; owner: string | null }[];
  parties: { id: number; full_name: string; doc_number: string | null; is_owner: boolean; is_tenant: boolean; is_guarantor: boolean; has_consent: boolean }[];
  indices: { code: string; label: string; kind: string }[];
  defaults: Record<string, any>;
  modules: string[];
}
interface PartyRow { role: string; party_id: number; is_primary: boolean }
interface PlanRow { concept: string; payer: string; collected_by: string; mode: string; amount: string; active: boolean }
interface Preview { items: { due_date: string; status: string; note: string | null; formula: string | null; factor: number | null; estimated_rent: number | null }[]; total: number; scheme: string; message: string | null }

const STEPS = ["Propiedad y partes", "Plazo y canon", "Ajuste", "Comisiones y depósito", "Garantía y conceptos"];

function addMonthsISO(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1 + n, 1);
  const last = new Date(dt.getFullYear(), dt.getMonth() + 1, 0).getDate();
  dt.setDate(Math.min(d, last));
  dt.setDate(dt.getDate() - 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

function blank(d: Record<string, any>, propertyId?: number | null) {
  return {
    property_id: propertyId ? String(propertyId) : "", purpose: "VIVIENDA", start_date: "", term_months: "24", handover_date: "", due_day: "10", grace_days: numText(d.grace_days ?? 0),
    currency: "ARS", initial_rent: "", fx_rule: "NO_APLICA", fx_note: "", adjustment_method: "INDICE", index_code: "ICL", adjust_every_months: "3", lag_months: "0", index_base: "ANTERIOR",
    fixed_pct: "", rounding: "", late_interest_monthly_pct: numText(d.late_interest_monthly_pct ?? 0), admin_commission_pct: numText(d.admin_commission_pct ?? 0),
    admin_commission_base: "COBRADO", late_interest_to_owner: false, tenant_commission_amount: "", owner_commission_amount: "0", deposit_mode: "MESES_CANON", deposit_amount: "",
    deposit_months: "1", deposit_currency: "ARS", early_termination_pct: "", early_termination_notice_days: "", notes: "",
    current_rent: "", deposit_received_on: "",
  };
}
type Form = ReturnType<typeof blank>;

function fromDetail(c: any, d: Record<string, any>): Form {
  const f = blank(d, c.property?.id);
  const t = (k: string, v: any) => { if (v !== null && v !== undefined) (f as any)[k] = typeof v === "number" ? numText(v) : String(v); };
  for (const k of ["purpose", "start_date", "handover_date", "currency", "fx_rule", "fx_note", "adjustment_method", "index_code", "index_base", "rounding", "admin_commission_base", "deposit_mode", "deposit_currency", "notes"]) t(k, c[k]);
  for (const k of ["term_months", "due_day", "grace_days", "initial_rent", "adjust_every_months", "lag_months", "fixed_pct", "late_interest_monthly_pct", "admin_commission_pct", "tenant_commission_amount",
    "owner_commission_amount", "deposit_amount", "deposit_months", "early_termination_pct", "early_termination_notice_days"]) t(k, c[k]);
  f.late_interest_to_owner = !!c.late_interest_to_owner;
  return f;
}

export function NuevoContrato({ draft, initialProperty, onClose, onDone }: {
  draft?: any | null; initialProperty?: number | null; onClose: () => void; onDone: (id: number, activated: boolean) => void;
}) {
  const user = getSessionUser();
  const [lk, setLk] = useState<Lookups | null>(null);
  const [step, setStep] = useState(0);
  const [f, setF] = useState<Form | null>(null);
  const [parties, setParties] = useState<PartyRow[]>([]);
  const [plan, setPlan] = useState<PlanRow[]>([]);
  const [sched, setSched] = useState<{ desde_mes: string; monto: string }[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [previewErr, setPreviewErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [newPerson, setNewPerson] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  useEffect(() => {
    appApi<Lookups>("/contracts/lookups").then((l) => {
      setLk(l);
      if (draft) {
        setF(fromDetail(draft, l.defaults));
        const rows: PartyRow[] = [];
        for (const role of ["INQUILINO", "COINQUILINO", "GARANTE", "FIADOR"]) for (const p of draft.parties?.[role] || []) rows.push({ role, party_id: p.id, is_primary: !!p.is_primary });
        setParties(rows);
        setPlan((draft.charge_plan || []).map((r: any) => ({ concept: r.concept, payer: r.payer, collected_by: r.collected_by, mode: r.mode, amount: numText(r.amount), active: r.active })));
        setSched((draft.schedule || []).map((r: any) => ({ desde_mes: String(r.desde_mes), monto: numText(r.monto) })));
      } else {
        const b = blank(l.defaults, initialProperty);
        const prop = l.properties.find((p) => p.id === initialProperty);
        if (prop?.list_price && prop.list_currency) { b.initial_rent = numText(prop.list_price); b.currency = prop.list_currency; b.deposit_currency = prop.list_currency; }
        setF(b);
        setParties([{ role: "INQUILINO", party_id: 0, is_primary: true }]);
      }
    }).catch((e) => setErr(e instanceof Error ? e.message : "No se pudo preparar el asistente"));
  }, [draft, initialProperty]);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => (x ? { ...x, [k]: v } : x));

  const payload = useCallback((withParties: boolean) => {
    if (!f) return {};
    const n = (v: string) => toNum(v);
    const s = (v: string) => (v.trim() ? v.trim() : null);
    const body: Record<string, unknown> = {
      property_id: Number(f.property_id) || null, purpose: f.purpose, start_date: s(f.start_date), term_months: n(f.term_months), handover_date: s(f.handover_date), due_day: n(f.due_day),
      grace_days: n(f.grace_days), currency: f.currency, initial_rent: n(f.initial_rent), fx_rule: f.currency === "USD" ? f.fx_rule : "NO_APLICA", fx_note: s(f.fx_note),
      adjustment_method: f.adjustment_method, index_code: f.adjustment_method === "INDICE" ? f.index_code : null,
      adjust_every_months: f.adjustment_method === "INDICE" || f.adjustment_method === "PORCENTAJE" ? n(f.adjust_every_months) : null, lag_months: n(f.lag_months) ?? 0, index_base: f.index_base,
      fixed_pct: f.adjustment_method === "PORCENTAJE" ? n(f.fixed_pct) : null,
      schedule: f.adjustment_method === "ESCALONADO" ? sched.filter((r) => r.desde_mes && r.monto).map((r) => ({ desde_mes: Number(r.desde_mes), monto: n(r.monto) })) : null,
      rounding: s(f.rounding), late_interest_monthly_pct: n(f.late_interest_monthly_pct) ?? 0, admin_commission_pct: n(f.admin_commission_pct) ?? 0, admin_commission_base: f.admin_commission_base,
      late_interest_to_owner: f.late_interest_to_owner, tenant_commission_amount: n(f.tenant_commission_amount) ?? 0, owner_commission_amount: n(f.owner_commission_amount) ?? 0,
      deposit_mode: f.deposit_mode, deposit_months: f.deposit_mode === "FIJO" ? null : n(f.deposit_months), deposit_amount: f.deposit_mode === "FIJO" ? n(f.deposit_amount) : n(f.deposit_amount),
      deposit_currency: f.deposit_currency, early_termination_pct: n(f.early_termination_pct), early_termination_notice_days: n(f.early_termination_notice_days), notes: s(f.notes),
    };
    if (withParties) {
      body.parties = parties.filter((p) => p.party_id).map((p) => ({ party_id: p.party_id, role: p.role, is_primary: p.is_primary }));
      body.charge_plan = plan.filter((r) => r.concept).map((r) => ({ concept: r.concept, payer: r.payer, collected_by: r.collected_by, mode: r.mode, amount: r.mode === "FIJO" ? toNum(r.amount) : null, active: r.active }));
    }
    return body;
  }, [f, parties, plan, sched]);

  // vista previa de los próximos ajustes (paso 3)
  const previewKey = useMemo(() => JSON.stringify(payload(false)), [payload]);
  useEffect(() => {
    if (step !== 2 || !f) return;
    if (!f.start_date || !f.term_months || !f.initial_rent || !f.property_id) { setPreview(null); setPreviewErr("Completá la propiedad, la fecha de inicio, el plazo y el alquiler (pasos 1 y 2) para ver los ajustes."); return; }
    const t = window.setTimeout(() => {
      appApi<Preview>("/contracts/preview-adjustments", { method: "POST", body: JSON.parse(previewKey) }).then((r) => { setPreview(r); setPreviewErr(""); })
        .catch((e) => { setPreview(null); setPreviewErr(e instanceof Error ? e.message : "No se pudo calcular"); });
    }, 350);
    return () => window.clearTimeout(t);
  }, [step, previewKey, f]);

  if (!f || !lk) return <Modal title="Nuevo contrato" eyebrow="CONTRATOS" size="xl" onClose={onClose}>{err ? <Note tone="error">{err}</Note> : <Loading />}</Modal>;

  const prop = lk.properties.find((p) => p.id === Number(f.property_id));
  const end = f.start_date && toNum(f.term_months) ? addMonthsISO(f.start_date, Number(toNum(f.term_months))) : "";
  const hasGuar = lk.modules.includes("garantias");
  const hasCob = lk.modules.includes("cobranzas");
  const isDraft = !!draft;
  const started = !!f.start_date && f.start_date < todayISO();

  function stepError(i: number): string {
    if (i === 0) {
      if (!f!.property_id) return "Elegí la propiedad";
      if (!parties.some((p) => p.role === "INQUILINO" && p.party_id)) return "Elegí al inquilino";
      const ids = parties.filter((p) => p.party_id).map((p) => `${p.party_id}`);
      if (new Set(ids).size !== ids.length) return "Una persona está repetida en las partes";
    }
    if (i === 1) {
      if (!f!.start_date) return "Cargá la fecha de inicio";
      if (!toNum(f!.term_months)) return "Cargá el plazo en meses";
      if (!toNum(f!.initial_rent)) return "Cargá el alquiler inicial";
    }
    if (i === 2) {
      if ((f!.adjustment_method === "INDICE" || f!.adjustment_method === "PORCENTAJE") && !toNum(f!.adjust_every_months)) return "Indicá cada cuántos meses se ajusta";
      if (f!.adjustment_method === "PORCENTAJE" && f!.fixed_pct === "") return "Indicá el porcentaje de cada ajuste";
      if (f!.adjustment_method === "ESCALONADO" && !sched.some((r) => r.desde_mes && r.monto)) return "Cargá al menos un escalón";
    }
    if (i === 3 && f!.deposit_mode !== "FIJO" && !toNum(f!.deposit_months)) return "Indicá cuántos meses de alquiler es el depósito";
    return "";
  }
  function next() { const e = stepError(step); if (e) return setErr(e); setErr(""); setStep(step + 1); }
  function go(i: number) { if (i > step) { for (let k = step; k < i; k++) { const e = stepError(k); if (e) { setErr(e); setStep(k); return; } } } setErr(""); setStep(i); }

  async function save(activate: boolean) {
    for (let k = 0; k < 4; k++) { const e = stepError(k); if (e) { setErr(e); setStep(k); return; } }
    setBusy(true); setErr("");
    try {
      let id: number;
      let warns: string[] = [];
      if (isDraft) {
        const r = await appApi<{ id: number; warnings: string[] }>(`/contracts/${draft.id}`, { method: "PUT", body: payload(false) });
        id = r.id; warns = r.warnings || [];
        const pr = await appApi<{ warnings: string[] }>(`/contracts/${id}/parties`, { method: "PUT", body: { parties: payload(true).parties } });
        warns = warns.concat(pr.warnings || []);
        await appApi(`/contracts/${id}/charge-plan`, { method: "PUT", body: { items: (payload(true) as any).charge_plan } });
      } else {
        const r = await appApi<{ id: number; warnings: string[] }>("/contracts", { method: "POST", body: payload(true) });
        id = r.id; warns = r.warnings || [];
      }
      if (activate) {
        await appApi(`/contracts/${id}/activate`, { method: "POST", body: { current_rent: toNum(f!.current_rent), deposit_received_on: f!.deposit_received_on || null } });
      }
      if (warns.length && !activate) { setWarnings(warns); }
      onDone(id, activate);
    } catch (e) { setErr(e instanceof Error ? e.message : "No se pudo guardar"); } finally { setBusy(false); }
  }

  const setParty = (i: number, patch: Partial<PartyRow>) => setParties((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));

  const tenantRows = parties.map((p, i) => ({ p, i })).filter((x) => x.p.role === "INQUILINO" || x.p.role === "COINQUILINO");
  const guarRows = parties.map((p, i) => ({ p, i })).filter((x) => x.p.role === "GARANTE" || x.p.role === "FIADOR");

  const renderPartyRow = ({ p, i }: { p: PartyRow; i: number }, roles: string[]) => (
    <div key={i} className="g1-party-row">
      <select aria-label="Rol" value={p.role} onChange={(e) => setParty(i, { role: e.target.value, is_primary: e.target.value === "INQUILINO" && !parties.some((x, j) => j !== i && x.role === "INQUILINO") })}>
        {roles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select>
      <select aria-label="Persona" value={p.party_id || ""} onChange={(e) => setParty(i, { party_id: Number(e.target.value) })}>
        <option value="">Elegí una persona</option>{lk.parties.map((x) => <option key={x.id} value={x.id}>{x.full_name}{x.doc_number ? ` · ${x.doc_number}` : ""}</option>)}</select>
      <span>{p.party_id && !lk.parties.find((x) => x.id === p.party_id)?.has_consent ? <Pill tone="orange">Sin consentimiento</Pill> : null}</span>
      <button type="button" className="g1-mini is-danger" aria-label="Quitar" onClick={() => setParties((ps) => ps.filter((_, j) => j !== i))}>×</button>
    </div>);

  return (
    <Modal title={isDraft ? `Editar borrador del contrato N.º ${draft.number}` : "Nuevo contrato"} eyebrow="CONTRATOS" size="xl" onClose={onClose} footer={<>
      <button className="secondary-button" onClick={onClose}>Cancelar</button>
      {step > 0 && <button className="secondary-button" onClick={() => { setErr(""); setStep(step - 1); }}>Atrás</button>}
      {step < 4 && <button className="primary-button" onClick={next}>Siguiente</button>}
      {step === 4 && <button className="secondary-button" disabled={busy} onClick={() => save(false)}>{busy ? "Guardando..." : "Guardar como borrador"}</button>}
      {step === 4 && <button className="primary-button" disabled={busy} onClick={() => save(true)}>{busy ? "Activando..." : "Guardar y activar"}</button>}</>}>
      <div className="g1-steps" role="tablist">
        {STEPS.map((l, i) => <button key={l} type="button" role="tab" className={`g1-step ${i === step ? "is-on" : i < step ? "is-done" : ""}`} onClick={() => go(i)}><b>Paso {i + 1}</b>{l}</button>)}
      </div>
      {err && <Note tone="error">{err}</Note>}
      {warnings.length > 0 && warnings.map((w) => <Note key={w} tone="warn">{w}</Note>)}

      {step === 0 && (
        <>
          <Field label="Propiedad" hint={prop ? (prop.owner ? `Propietario: ${prop.owner}` : "La propiedad no tiene propietario cargado: cargalo en Propiedades antes de liquidar.") : undefined}>
            <select value={f.property_id} onChange={(e) => set("property_id", e.target.value)}>
              <option value="">Elegí una propiedad</option>{lk.properties.map((p) => <option key={p.id} value={p.id}>{p.label} · {p.code}{p.has_active_contract ? " (con contrato vigente)" : ""}</option>)}</select></Field>
          {prop?.has_active_contract && <Note tone="warn">Esta propiedad ya tiene un contrato vigente. Podés dejar el borrador armado (por ejemplo una renovación), pero no se va a poder activar mientras se pisen las fechas.</Note>}
          <p className="hb-form-title">Inquilinos</p>
          {tenantRows.map((r) => renderPartyRow(r, ["INQUILINO", "COINQUILINO"]))}
          <div className="hb-row">
            <button type="button" className="g1-mini" onClick={() => setParties((ps) => [...ps, { role: ps.some((x) => x.role === "INQUILINO") ? "COINQUILINO" : "INQUILINO", party_id: 0, is_primary: !ps.some((x) => x.role === "INQUILINO") }])}>Agregar inquilino o coinquilino</button>
            <button type="button" className="g1-mini" onClick={() => setNewPerson("INQUILINO")}>Cargar persona nueva</button>
          </div>
          <Field label="Destino del alquiler">
            <select value={f.purpose} onChange={(e) => set("purpose", e.target.value)}>{Object.entries(PURPOSE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        </>)}

      {step === 1 && (
        <>
          <div className="g1-grid">
            <Field label="Fecha de inicio"><input type="date" value={f.start_date} onChange={(e) => set("start_date", e.target.value)} /></Field>
            <Field label="Plazo (meses)" hint={end ? `Termina el ${shortDate(end)}` : undefined}><input inputMode="numeric" value={f.term_months} onChange={(e) => set("term_months", e.target.value)} /></Field>
            <Field label="Entrega de llaves (opcional)"><input type="date" value={f.handover_date} onChange={(e) => set("handover_date", e.target.value)} /></Field>
            <Field label="Día de vencimiento de cada mes" hint="Del 1 al 28."><input inputMode="numeric" value={f.due_day} onChange={(e) => set("due_day", e.target.value)} /></Field>
            <Field label="Moneda"><select value={f.currency} onChange={(e) => { set("currency", e.target.value); if (e.target.value === "ARS") set("fx_rule", "NO_APLICA"); else if (f.fx_rule === "NO_APLICA") set("fx_rule", "PACTADA"); if (!isDraft) set("deposit_currency", e.target.value); }}><option value="ARS">Pesos ($)</option><option value="USD">Dólares (USD)</option></select></Field>
            <Field label="Alquiler inicial (por mes)"><input inputMode="decimal" value={f.initial_rent} onChange={(e) => set("initial_rent", e.target.value)} placeholder="0" /></Field>
            {f.currency === "USD" && <>
              <Field label="Cotización pactada"><select value={f.fx_rule} onChange={(e) => set("fx_rule", e.target.value)}>{Object.entries(FX_RULE_LABEL).filter(([k]) => k !== "NO_APLICA").map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
              <Field label="Aclaración de la cotización"><input value={f.fx_note} onChange={(e) => set("fx_note", e.target.value)} placeholder="Por ejemplo: BNA vendedor del día hábil anterior" /></Field></>}
            <Field label="Días de gracia antes de la mora"><input inputMode="numeric" value={f.grace_days} onChange={(e) => set("grace_days", e.target.value)} /></Field>
            <Field label="Interés mensual por mora (%)" hint="0 = no se sugiere nada."><input inputMode="decimal" value={f.late_interest_monthly_pct} onChange={(e) => set("late_interest_monthly_pct", e.target.value)} /></Field>
          </div>
          {f.start_date && <p className="hb-hint">Régimen: {REGIME_LABEL[f.start_date > "2023-12-29" ? "LIBRE" : "LEY_27551"]}. {f.start_date <= "2023-12-29" ? "Los contratos de esa fecha siguen la Ley 27.551: las reglas de rescisión consultalas con tu abogado." : ""}</p>}
        </>)}

      {step === 2 && (
        <>
          <div className="g1-grid">
            <Field label="Cómo se ajusta"><select value={f.adjustment_method} onChange={(e) => set("adjustment_method", e.target.value)}>{Object.entries(METHOD_LABEL).filter(([k]) => k !== "MANUAL").map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
            {f.adjustment_method === "INDICE" && <Field label="Índice"><select value={f.index_code} onChange={(e) => set("index_code", e.target.value)}>{lk.indices.map((i) => <option key={i.code} value={i.code}>{i.label}</option>)}</select></Field>}
            {(f.adjustment_method === "INDICE" || f.adjustment_method === "PORCENTAJE") && <Field label="Cada cuántos meses"><input inputMode="numeric" value={f.adjust_every_months} onChange={(e) => set("adjust_every_months", e.target.value)} /></Field>}
            {f.adjustment_method === "PORCENTAJE" && <Field label="Porcentaje de cada ajuste (%)"><input inputMode="decimal" value={f.fixed_pct} onChange={(e) => set("fixed_pct", e.target.value)} /></Field>}
            {f.adjustment_method === "INDICE" && <>
              <Field label="Desfase del índice (meses)" hint="Cuántos meses antes se toma el índice. 0 = al día del ajuste."><input inputMode="numeric" value={f.lag_months} onChange={(e) => set("lag_months", e.target.value)} /></Field>
              <Field label="Base de cálculo"><select value={f.index_base} onChange={(e) => set("index_base", e.target.value)}><option value="ANTERIOR">Sobre el canon del ajuste anterior</option><option value="INICIAL">Sobre el canon inicial</option></select></Field></>}
            <Field label="Redondeo"><select value={f.rounding} onChange={(e) => set("rounding", e.target.value)}><option value="">El de Configuración</option><option value="CENTAVOS">A centavos</option><option value="PESO">Al peso</option></select></Field>
          </div>
          {f.adjustment_method === "ESCALONADO" && (
            <>
              <p className="hb-form-title">Escalones (desde qué mes del contrato rige cada monto)</p>
              {sched.map((r, i) => (
                <div key={i} className="g1-sched-row">
                  <input aria-label="Desde el mes" inputMode="numeric" placeholder="Mes" value={r.desde_mes} onChange={(e) => setSched((s) => s.map((x, j) => (j === i ? { ...x, desde_mes: e.target.value } : x)))} />
                  <input aria-label="Monto" inputMode="decimal" placeholder="Monto mensual" value={r.monto} onChange={(e) => setSched((s) => s.map((x, j) => (j === i ? { ...x, monto: e.target.value } : x)))} />
                  <button type="button" className="g1-mini is-danger" aria-label="Quitar escalón" onClick={() => setSched((s) => s.filter((_, j) => j !== i))}>×</button>
                </div>))}
              <button type="button" className="g1-mini" onClick={() => setSched((s) => [...s, { desde_mes: "", monto: "" }])}>Agregar escalón</button>
            </>)}
          <p className="hb-form-title">Próximos ajustes</p>
          {previewErr && <Note tone="warn">{previewErr}</Note>}
          {preview && (
            <>
              <p className="hb-muted" style={{ margin: "0 0 6px" }}>{preview.scheme}{preview.total ? ` · ${preview.total} ajuste${preview.total === 1 ? "" : "s"} en el plazo` : ""}</p>
              {preview.message && <Note>{preview.message}</Note>}
              <div className="g1-preview">
                {preview.items.map((it) => (
                  <div key={it.due_date} className="g1-preview-row">
                    <strong>{shortDate(it.due_date)}</strong>
                    <span>{it.estimated_rent !== null ? <>Alquiler estimado: <strong>{moneyIn(it.estimated_rent, f.currency)}</strong></> : (it.note || "Sin dato todavía")}
                      {it.formula && <small>{it.formula}</small>}{it.estimated_rent === null && it.status === "ESPERANDO_INDICE" && <small>Cuando se publique el índice lo calculamos y te lo proponemos.</small>}</span>
                    <Pill tone={it.status === "ESPERANDO_INDICE" ? "violet" : "blue"}>{it.status === "ESPERANDO_INDICE" ? "Falta el índice" : "Estimado"}</Pill>
                  </div>))}
              </div>
              <p className="hb-hint">Es una vista previa. Cada ajuste lo confirmás vos cuando llega la fecha: nunca se aplica solo.</p>
            </>)}
        </>)}

      {step === 3 && (
        <>
          <p className="hb-form-title" style={{ marginTop: 0 }}>Honorarios</p>
          <div className="g1-grid">
            <Field label="Comisión de administración (%)" hint="Sobre el alquiler, la cobra la inmobiliaria al propietario."><input inputMode="decimal" value={f.admin_commission_pct} onChange={(e) => set("admin_commission_pct", e.target.value)} /></Field>
            <Field label="Se calcula sobre lo"><select value={f.admin_commission_base} onChange={(e) => set("admin_commission_base", e.target.value)}><option value="COBRADO">Cobrado</option><option value="DEVENGADO">Devengado (lo que debía pagar)</option></select></Field>
            <Field label="Comisión al inquilino (monto)" hint="Una sola vez, al inicio."><input inputMode="decimal" value={f.tenant_commission_amount} onChange={(e) => set("tenant_commission_amount", e.target.value)} placeholder={numText(Number(lk.defaults.tenant_commission_months || 0) * (toNum(f.initial_rent) || 0)) || "0"} /></Field>
            <Field label="Comisión al propietario (monto)"><input inputMode="decimal" value={f.owner_commission_amount} onChange={(e) => set("owner_commission_amount", e.target.value)} /></Field>
          </div>
          <Check checked={f.late_interest_to_owner} onChange={(v) => set("late_interest_to_owner", v)}>El interés por mora corresponde al propietario (si no, queda para la inmobiliaria)</Check>
          <p className="hb-form-title">Depósito en garantía</p>
          <div className="g1-grid">
            <Field label="Cómo se pacta"><select value={f.deposit_mode} onChange={(e) => set("deposit_mode", e.target.value)}>{Object.entries(DEPOSIT_MODE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
            {f.deposit_mode === "FIJO"
              ? <Field label="Monto del depósito"><input inputMode="decimal" value={f.deposit_amount} onChange={(e) => set("deposit_amount", e.target.value)} /></Field>
              : <Field label="Cantidad de meses" hint={toNum(f.initial_rent) && toNum(f.deposit_months) ? `Equivale a ${moneyIn((toNum(f.initial_rent) || 0) * (toNum(f.deposit_months) || 0), f.deposit_currency)} con el alquiler inicial.` : undefined}><input inputMode="decimal" value={f.deposit_months} onChange={(e) => set("deposit_months", e.target.value)} /></Field>}
            <Field label="Moneda del depósito"><select value={f.deposit_currency} onChange={(e) => set("deposit_currency", e.target.value)}><option value="ARS">Pesos ($)</option><option value="USD">Dólares (USD)</option></select></Field>
          </div>
          <p className="hb-form-title">Rescisión anticipada (según tu cláusula)</p>
          <div className="g1-grid">
            <Field label="Porcentaje de indemnización (%)" hint="Para vivienda libre, la referencia legal es 10% (si se rescinde en el primer año, 1,5 meses). Dejá lo que dice tu contrato."><input inputMode="decimal" value={f.early_termination_pct} onChange={(e) => set("early_termination_pct", e.target.value)} /></Field>
            <Field label="Preaviso (días)"><input inputMode="numeric" value={f.early_termination_notice_days} onChange={(e) => set("early_termination_notice_days", e.target.value)} /></Field>
          </div>
          <Note>El sellado estimado se calcula al guardar, con la alícuota que cargaste en Configuración. Es una estimación: confirmala con ATM.</Note>
        </>)}

      {step === 4 && (
        <>
          {hasGuar || canAccess(user, "garantias") ? <Note>Los datos del seguro, aval o inmueble en garantía se cargan en la pestaña Garantías de la ficha, una vez guardado el contrato. Acá podés dejar a las personas garantes.</Note> : null}
          <p className="hb-form-title">Garantes y fiadores</p>
          {guarRows.length === 0 && <p className="hb-muted">Sin garantes por ahora.</p>}
          {guarRows.map((r) => renderPartyRow(r, ["GARANTE", "FIADOR"]))}
          <div className="hb-row">
            <button type="button" className="g1-mini" onClick={() => setParties((ps) => [...ps, { role: "GARANTE", party_id: 0, is_primary: false }])}>Agregar garante</button>
            <button type="button" className="g1-mini" onClick={() => setNewPerson("GARANTE")}>Cargar persona nueva</button>
          </div>
          <p className="hb-form-title">Conceptos que se cobran todos los meses además del alquiler</p>
          {plan.map((r, i) => (
            <div key={i} className="g1-grid3" style={{ marginBottom: 8, alignItems: "end" }}>
              <Field label="Concepto"><select value={r.concept} onChange={(e) => setPlan((p) => p.map((x, j) => (j === i ? { ...x, concept: e.target.value } : x)))}>{Object.entries(PLAN_CONCEPT).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
              <Field label="Lo paga"><select value={r.payer} onChange={(e) => setPlan((p) => p.map((x, j) => (j === i ? { ...x, payer: e.target.value } : x)))}><option value="INQUILINO">El inquilino</option><option value="PROPIETARIO">El propietario</option></select></Field>
              <Field label="Quién lo cobra"><select value={r.collected_by} onChange={(e) => setPlan((p) => p.map((x, j) => (j === i ? { ...x, collected_by: e.target.value } : x)))}><option value="INMOBILIARIA">La inmobiliaria</option><option value="DIRECTO">Se paga directo</option></select></Field>
              <Field label="Importe"><select value={r.mode} onChange={(e) => setPlan((p) => p.map((x, j) => (j === i ? { ...x, mode: e.target.value } : x)))}><option value="FIJO">Monto fijo</option><option value="VARIABLE">Variable (se carga cada mes)</option></select></Field>
              {r.mode === "FIJO" ? <Field label="Monto"><input inputMode="decimal" value={r.amount} onChange={(e) => setPlan((p) => p.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} /></Field> : <div />}
              <div><button type="button" className="g1-mini is-danger" onClick={() => setPlan((p) => p.filter((_, j) => j !== i))}>Quitar</button></div>
            </div>))}
          <button type="button" className="g1-mini" onClick={() => setPlan((p) => [...p, { concept: "EXPENSAS_ORD", payer: "INQUILINO", collected_by: "INMOBILIARIA", mode: "VARIABLE", amount: "", active: true }])}>Agregar concepto</button>
          <Field label="Notas internas"><textarea rows={2} value={f.notes} onChange={(e) => set("notes", e.target.value)} /></Field>

          <p className="hb-form-title">Resumen</p>
          <div className="g1-box">
            <strong>{prop?.label}</strong><br />
            {shortDate(f.start_date)} al {end ? shortDate(end) : "—"} ({f.term_months} meses) · {moneyIn(toNum(f.initial_rent), f.currency)} por mes · vence el día {f.due_day}<br />
            Ajuste: {METHOD_LABEL[f.adjustment_method]}{f.adjustment_method === "INDICE" ? ` ${f.index_code} cada ${f.adjust_every_months} meses` : f.adjustment_method === "PORCENTAJE" ? ` ${f.fixed_pct}% cada ${f.adjust_every_months} meses` : ""}
          </div>
          <p className="g1-section">Al activar</p>
          <p className="hb-muted" style={{ margin: "0 0 8px" }}>«Guardar como borrador» no cambia nada en la cobranza. «Guardar y activar» marca la propiedad como alquilada{hasCob ? " y genera los cargos de los meses corridos (hasta 3 para atrás)" : ""}.</p>
          {started && (
            <Field label="Canon actual (si el contrato ya venía en marcha)" hint="Si el alquiler de hoy ya no es el inicial, cargalo acá: queda en el historial como cambio manual y el calendario sigue desde el próximo ajuste.">
              <input inputMode="decimal" value={f.current_rent} onChange={(e) => set("current_rent", e.target.value)} placeholder={f.initial_rent} /></Field>)}
          {hasGuar && Number(toNum(f.deposit_amount) || 0) + Number(toNum(f.deposit_months) || 0) > 0 && (
            <Field label="¿Ya recibiste el depósito? Fecha (opcional)" hint="Queda registrado en custodia en Garantías."><input type="date" max={todayISO()} value={f.deposit_received_on} onChange={(e) => set("deposit_received_on", e.target.value)} /></Field>)}
          <p className="hb-hint">Estado: {CONTRACT_STATUS.BORRADOR[0]} hasta que lo actives.</p>
        </>)}

      {newPerson && <PartyFormModal defaults={{ is_tenant: newPerson === "INQUILINO", is_guarantor: newPerson === "GARANTE" }} onClose={() => setNewPerson(null)} onSaved={(np) => {
        setLk((l) => (l ? { ...l, parties: [...l.parties, { id: np.id, full_name: np.full_name, doc_number: np.doc_number, is_owner: np.is_owner, is_tenant: np.is_tenant, is_guarantor: np.is_guarantor, has_consent: !!np.consent_at }] } : l));
        setParties((ps) => {
          const idx = ps.findIndex((p) => !p.party_id && (newPerson === "GARANTE" ? p.role === "GARANTE" : p.role === "INQUILINO" || p.role === "COINQUILINO"));
          if (idx >= 0) return ps.map((p, j) => (j === idx ? { ...p, party_id: np.id } : p));
          return [...ps, { role: newPerson === "GARANTE" ? "GARANTE" : ps.some((x) => x.role === "INQUILINO") ? "COINQUILINO" : "INQUILINO", party_id: np.id, is_primary: newPerson !== "GARANTE" && !ps.some((x) => x.role === "INQUILINO") }];
        });
        setNewPerson(null);
      }} />}
    </Modal>
  );
}
