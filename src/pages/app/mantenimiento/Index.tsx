// Pantalla «Reparaciones» (módulo mantenimiento): tablero de reclamos y proveedores.
// Backend: backend/routes/mantenimiento.py
import { useCallback, useEffect, useMemo, useState } from "react";
import { appApi, getSessionUser, isReadOnly, moneyIn, phoneText, shortDate, dateTime } from "../../../config";
import { Empty, Field, Loading, Modal, PageHeader, Pill, Tabs, useFlash, numOrNull, strOrNull } from "../../../components/ui";
import { PhotoGrid, PhotoUploader, WaButton, MAINT_STATUS, PRIORITY, WHO_PAYS, REPORTED_BY, TRADES } from "../../../components/g3/common";
import type { PropertyOpt, ContractOpt, PersonOpt } from "../../../components/g3/common";
import "../../../g3.css";

interface Row { id: number; property: string; property_code: string; title: string; priority: string; status: string; supplier_name: string | null; quote_amount: number | null; final_amount: number | null; currency: string; who_pays: string; owner_approval: string; created_at: string; photo_count: number; reported_by: string }
interface Wa { name: string; url: string | null; has_phone: boolean }
interface Detail extends Row {
  property_id: number; contract_id: number | null; description: string | null; reporter_name: string | null; contract_number: number | null; supplier_id: number | null;
  owner_approval_at: string | null; owner_approval_note: string | null; urgent_override_note: string | null; needs_approval: boolean; scheduled_for: string | null; charge_id: number | null;
  photos: { id: number; url: string | null; caption: string | null; stage: string; file_url: string }[];
  wa: { owner?: Wa | null; tenant?: Wa | null; supplier?: Wa | null }; owners: { id: number; full_name: string }[]; imputation?: string;
}
interface Lookups { properties: PropertyOpt[]; contracts: ContractOpt[]; suppliers: { id: number; name: string; trade: string }[]; tenants: PersonOpt[]; owner_approval_limit: number }
interface Supplier { id: number; name: string; trade: string; phone_area: string | null; phone_number: string | null; email: string | null; cuit_text: string | null; notes: string | null; rating_notes: string | null; active: boolean; open_requests: number }

const COLUMNS: [string, string[]][] = [
  ["Nuevos", ["NUEVO"]], ["Presupuesto y aprobación", ["PRESUPUESTO", "ESPERANDO_APROBACION"]],
  ["Aprobados y en curso", ["APROBADO", "EN_CURSO"]], ["Resueltos", ["RESUELTO"]],
];

function MantenimientoPage() {
  const user = getSessionUser();
  const ro = isReadOnly(user);
  const canManage = user?.role === "ADMINISTRADOR" || user?.role === "ENCARGADO";
  const { show, fail, node: flash } = useFlash();
  const [tab, setTab] = useState<"reclamos" | "proveedores">("reclamos");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [look, setLook] = useState<Lookups | null>(null);
  const [q, setQ] = useState("");
  const [prio, setPrio] = useState("");
  const [showClosed, setShowClosed] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(() => { appApi<Row[]>("/maintenance").then(setRows).catch(fail); }, [fail]);
  useEffect(() => { load(); appApi<Lookups>("/maintenance/lookups").then(setLook).catch(fail); }, [load, fail]);

  const visible = useMemo(() => (rows || []).filter((r) =>
    (!prio || r.priority === prio) && (!q.trim() || (r.title + " " + r.property).toLowerCase().includes(q.trim().toLowerCase()))), [rows, prio, q]);
  const closed = visible.filter((r) => r.status === "CERRADO" || r.status === "CANCELADO");

  return (
    <section className="products-page">
      <PageHeader eyebrow="REPARACIONES" title="Reparaciones" subtitle="Reclamos, presupuestos y seguimiento hasta la resolución.">
        {!ro && tab === "reclamos" && <button className="primary-button" onClick={() => setCreating(true)}>+ Nuevo reclamo</button>}
      </PageHeader>
      <Tabs value={tab} onChange={setTab} options={[["reclamos", "Reclamos"], ["proveedores", "Proveedores"]]} />

      {tab === "reclamos" && (
        <>
          <div className="hb-toolbar">
            <div className="hb-filters">
              <input className="hb-search" placeholder="Buscar por título o propiedad" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar" />
              <select value={prio} onChange={(e) => setPrio(e.target.value)} aria-label="Prioridad">
                <option value="">Todas las prioridades</option>
                {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v[0]}</option>)}
              </select>
            </div>
            <label className="hb-inline-checks"><input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} /> Ver cerrados y cancelados ({closed.length})</label>
          </div>
          {!rows ? <Loading /> : rows.length === 0 ? <Empty title="Todavía no hay reclamos">Cuando un inquilino o propietario avise de una reparación, cargala con «Nuevo reclamo» y seguila hasta resolverla.</Empty> : (
            <div className="g3-board">
              {COLUMNS.map(([title, sts]) => {
                const col = visible.filter((r) => sts.includes(r.status));
                return (
                  <div className="g3-col" key={title}>
                    <h3>{title}<span>{col.length}</span></h3>
                    {col.length === 0 && <div className="g3-empty-col">Sin reclamos</div>}
                    {col.map((r) => <RequestCard key={r.id} r={r} onOpen={() => setOpenId(r.id)} />)}
                  </div>
                );
              })}
              {showClosed && (
                <div className="g3-col"><h3>Cerrados<span>{closed.length}</span></h3>
                  {closed.map((r) => <RequestCard key={r.id} r={r} onOpen={() => setOpenId(r.id)} />)}</div>
              )}
            </div>
          )}
        </>
      )}
      {tab === "proveedores" && <Suppliers canEdit={canManage} onFlash={show} onFail={fail} />}

      {creating && look && <NewRequest look={look} canAssign={canManage} onClose={() => setCreating(false)}
        onSaved={(id) => { setCreating(false); load(); setOpenId(id); show("Reclamo cargado"); }} />}
      {openId !== null && look && <RequestModal id={openId} look={look} canManage={canManage} ro={ro} onClose={() => setOpenId(null)} onChanged={load} onFlash={show} onFail={fail} />}
      {flash}
    </section>
  );
}

function RequestCard({ r, onOpen }: { r: Row; onOpen: () => void }) {
  const [sl, st] = MAINT_STATUS[r.status] || [r.status, "gray"];
  const [pl, pt] = PRIORITY[r.priority] || [r.priority, "gray"];
  return (
    <button type="button" className={`g3-card ${r.priority === "URGENTE" && r.status !== "RESUELTO" ? "is-late" : ""}`} onClick={onOpen}>
      <strong>{r.title}</strong>
      <small>{r.property_code} · {r.property}</small>
      <small>{shortDate(r.created_at)}{r.supplier_name ? ` · ${r.supplier_name}` : ""}</small>
      <div className="hb-row"><Pill tone={pt}>{pl}</Pill><Pill tone={st}>{sl}</Pill>
        {r.quote_amount !== null && <Pill tone="gray">{moneyIn(r.final_amount ?? r.quote_amount, r.currency)}</Pill>}</div>
    </button>
  );
}

function NewRequest({ look, canAssign, onClose, onSaved }: { look: Lookups; canAssign: boolean; onClose: () => void; onSaved: (id: number) => void }) {
  const [f, setF] = useState({ property_id: "", contract_id: "", reported_by: "INQUILINO", title: "", description: "", priority: "NORMAL", supplier_id: "", who_pays: "A_DEFINIR", reporter_party_id: "" });
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));
  const contracts = look.contracts.filter((c) => String(c.property_id) === f.property_id);
  async function save() {
    setBusy(true); setError("");
    try {
      const r = await appApi<Detail>("/maintenance", { method: "POST", body: {
        property_id: numOrNull(f.property_id), contract_id: numOrNull(f.contract_id), reported_by: f.reported_by, title: f.title, description: strOrNull(f.description),
        priority: f.priority, supplier_id: canAssign ? numOrNull(f.supplier_id) : null, who_pays: f.who_pays, reporter_party_id: numOrNull(f.reporter_party_id) } });
      onSaved(r.id);
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar"); } finally { setBusy(false); }
  }
  return (
    <Modal eyebrow="NUEVO RECLAMO" title="Nuevo reclamo" onClose={onClose} size="wide"
      footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={busy || !f.property_id || f.title.trim().length < 3} onClick={save}>{busy ? "Guardando..." : "Guardar"}</button></>}>
      <div className="product-form g3-grid">
        <Field label="Propiedad" wide><select value={f.property_id} onChange={(e) => { set("property_id", e.target.value); set("contract_id", ""); }} autoFocus>
          <option value="">Elegí una propiedad</option>{look.properties.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.address}</option>)}</select></Field>
        <Field label="¿Qué pasó?" wide><input value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="Ej.: Pérdida de agua en el baño" /></Field>
        <Field label="Detalle" wide><textarea rows={3} value={f.description} onChange={(e) => set("description", e.target.value)} /></Field>
        <Field label="Lo avisó"><select value={f.reported_by} onChange={(e) => set("reported_by", e.target.value)}>{Object.entries(REPORTED_BY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Prioridad"><select value={f.priority} onChange={(e) => set("priority", e.target.value)}>{Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v[0]}</option>)}</select></Field>
        {f.reported_by === "INQUILINO" && <Field label="Inquilino que avisó"><select value={f.reporter_party_id} onChange={(e) => set("reporter_party_id", e.target.value)}><option value="">—</option>{look.tenants.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}</select></Field>}
        {contracts.length > 0 && <Field label="Contrato" hint="Si la propiedad está alquilada se liga sola"><select value={f.contract_id} onChange={(e) => set("contract_id", e.target.value)}><option value="">Automático</option>{contracts.map((c) => <option key={c.id} value={c.id}>N.º {c.number} · {c.tenant || "sin inquilino"}</option>)}</select></Field>}
        {canAssign && <Field label="Proveedor"><select value={f.supplier_id} onChange={(e) => set("supplier_id", e.target.value)}><option value="">Sin asignar</option>{look.suppliers.map((s) => <option key={s.id} value={s.id}>{s.name} ({TRADES[s.trade] || s.trade})</option>)}</select></Field>}
        <Field label="¿Quién paga?"><select value={f.who_pays} onChange={(e) => set("who_pays", e.target.value)}>{Object.entries(WHO_PAYS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        {error && <div className="hb-note hb-note-error wide" role="alert">{error}</div>}
      </div>
    </Modal>
  );
}

function RequestModal({ id, look, canManage, ro, onClose, onChanged, onFlash, onFail }: {
  id: number; look: Lookups; canManage: boolean; ro: boolean; onClose: () => void; onChanged: () => void; onFlash: (t: string) => void; onFail: (e: unknown) => void;
}) {
  const [d, setD] = useState<Detail | null>(null);
  const [form, setForm] = useState<null | "quote" | "resolve" | "approve" | "reject" | "start" | "cancel">(null);
  const refresh = useCallback(() => { appApi<Detail>(`/maintenance/${id}`).then(setD).catch(onFail); }, [id, onFail]);
  useEffect(() => { refresh(); }, [refresh]);
  function done(x: Detail, msg: string) { setD(x); setForm(null); onChanged(); onFlash(msg); }
  async function act(path: string, body: unknown, msg: string) {
    try { done(await appApi<Detail>(`/maintenance/${id}/${path}`, { method: "POST", body }), msg); } catch (e) { onFail(e); }
  }
  if (!d) return <Modal title="Reclamo" onClose={onClose}><Loading /></Modal>;
  const [sl, st] = MAINT_STATUS[d.status] || [d.status, "gray"];
  const [pl, pt] = PRIORITY[d.priority] || [d.priority, "gray"];
  const open = !["RESUELTO", "CERRADO", "CANCELADO"].includes(d.status);
  const editable = !ro && d.status !== "CERRADO";
  return (
    <Modal eyebrow={`RECLAMO · ${d.property_code}`} title={d.title} onClose={onClose} size="xl">
      <div className="hb-row"><Pill tone={st}>{sl}</Pill><Pill tone={pt}>{pl}</Pill><span className="hb-muted">{d.property}</span></div>
      {d.description && <p style={{ whiteSpace: "pre-line" }}>{d.description}</p>}
      <dl className="g3-kv">
        <dt>Lo avisó</dt><dd>{REPORTED_BY[d.reported_by]}{d.reporter_name ? ` · ${d.reporter_name}` : ""}</dd>
        <dt>Cargado</dt><dd>{dateTime(d.created_at)}</dd>
        {d.contract_number && <><dt>Contrato</dt><dd>N.º {d.contract_number}</dd></>}
        <dt>Proveedor</dt><dd>{d.supplier_name || "Sin asignar"}</dd>
        <dt>Quién paga</dt><dd>{WHO_PAYS[d.who_pays]}</dd>
        <dt>Presupuesto</dt><dd>{d.quote_amount !== null ? moneyIn(d.quote_amount, d.currency) : "Sin cargar"}</dd>
        {d.final_amount !== null && <><dt>Costo final</dt><dd>{moneyIn(d.final_amount, d.currency)}</dd></>}
        {d.owner_approval !== "NO_REQUERIDA" && <><dt>Propietario</dt><dd>{d.owner_approval === "PENDIENTE" ? "Esperando su respuesta" : d.owner_approval === "APROBADA" ? "Aprobó" : "Rechazó"}{d.owner_approval_at ? ` el ${dateTime(d.owner_approval_at)}` : ""}{d.owner_approval_note ? ` · ${d.owner_approval_note}` : ""}</dd></>}
        {d.urgent_override_note && <><dt>Urgente sin aprobación</dt><dd>{d.urgent_override_note}</dd></>}
        {d.scheduled_for && <><dt>Programado</dt><dd>{dateTime(d.scheduled_for)}</dd></>}
      </dl>
      {d.imputation && <div className="hb-note hb-note-info">{d.imputation}</div>}
      {d.status === "RESUELTO" && d.who_pays === "PROPIETARIO" && <div className="hb-note hb-note-info">El costo se descuenta en la próxima liquidación del propietario.</div>}
      {d.charge_id && <div className="hb-note hb-note-info">Se generó un cargo «Reparación» en la cuenta del inquilino.</div>}

      <div className="g3-section">Avisar por WhatsApp</div>
      <div className="hb-row">
        {d.wa.owner && <WaButton url={d.wa.owner.url} label={d.owner_approval === "PENDIENTE" ? `Pedir aprobación a ${d.wa.owner.name}` : `Avisar a ${d.wa.owner.name}`} />}
        {d.wa.tenant && <WaButton url={d.wa.tenant.url} label={`Avisar al inquilino`} />}
        {d.wa.supplier && <WaButton url={d.wa.supplier.url} label={`Escribir a ${d.wa.supplier.name}`} />}
        {!d.wa.owner && !d.wa.tenant && !d.wa.supplier && <span className="hb-muted">No hay propietario, inquilino ni proveedor con celular cargado.</span>}
      </div>
      <p className="hb-hint">Se abre WhatsApp con el mensaje armado; lo enviás vos. Habita no manda nada solo.</p>

      <div className="g3-section">Fotos</div>
      <PhotoGrid photos={d.photos} onRemove={editable ? async (p) => { try { setD(await appApi<Detail>(`/maintenance/${id}/photos/${p.id}`, { method: "DELETE" })); } catch (e) { onFail(e); } } : undefined} />
      {d.photos.length === 0 && <p className="hb-muted">Todavía no hay fotos.</p>}
      {editable && (
        <div className="hb-row">
          {(["ANTES", "DESPUES", "FACTURA"] as const).map((stage) => (
            <PhotoUploader key={stage} compact label={`Foto: ${stage === "ANTES" ? "antes" : stage === "DESPUES" ? "después" : "factura"}`}
              onFile={async (file_url) => { setD(await appApi<Detail>(`/maintenance/${id}/photos`, { method: "POST", body: { file_url, stage } })); onChanged(); }} />
          ))}
        </div>
      )}

      {!ro && canManage && open && (
        <div className="g3-actions">
          <button className="secondary-button" onClick={() => setForm("quote")}>{d.quote_amount === null ? "Cargar presupuesto" : "Cambiar presupuesto"}</button>
          {d.status === "ESPERANDO_APROBACION" && <>
            <button className="primary-button" onClick={() => setForm("approve")}>Registrar: el propietario aprobó</button>
            <button className="secondary-button" onClick={() => setForm("reject")}>El propietario rechazó</button></>}
          {d.status !== "EN_CURSO" && <button className="secondary-button" onClick={() => setForm("start")}>Empezar el trabajo</button>}
          <button className="primary-button" onClick={() => setForm("resolve")}>Marcar resuelto</button>
          <button className="hb-link hb-link-danger" onClick={() => setForm("cancel")}>Cancelar reclamo</button>
        </div>
      )}
      {!ro && canManage && d.status === "RESUELTO" && <div className="g3-actions"><button className="primary-button" onClick={() => act("close", undefined, "Reclamo cerrado")}>Cerrar reclamo</button></div>}

      {form === "quote" && <QuoteForm d={d} look={look} onClose={() => setForm(null)} onSubmit={(b) => act("quote", b, "Presupuesto guardado")} />}
      {(form === "approve" || form === "reject") && <NoteForm title={form === "approve" ? "El propietario aprobó" : "El propietario rechazó"} label="Nota (cómo respondió, por qué)" confirm="Registrar"
        onClose={() => setForm(null)} onSubmit={(note) => act(form, { note: strOrNull(note) }, "Decisión registrada")} />}
      {form === "start" && <StartForm d={d} onClose={() => setForm(null)} onSubmit={(b) => act("start", b, "Trabajo en curso")} />}
      {form === "resolve" && <ResolveForm d={d} onClose={() => setForm(null)} onSubmit={(b) => act("resolve", b, "Reclamo resuelto")} />}
      {form === "cancel" && <NoteForm title="Cancelar el reclamo" label="Motivo" required confirm="Cancelar reclamo" onClose={() => setForm(null)} onSubmit={(reason) => act("cancel", { reason }, "Reclamo cancelado")} />}
    </Modal>
  );
}

function NoteForm({ title, label, confirm, required, onClose, onSubmit }: { title: string; label: string; confirm: string; required?: boolean; onClose: () => void; onSubmit: (v: string) => void }) {
  const [v, setV] = useState("");
  return (
    <Modal title={title} onClose={onClose} footer={<><button className="secondary-button" onClick={onClose}>Volver</button><button className="primary-button" disabled={required && v.trim().length < 3} onClick={() => onSubmit(v)}>{confirm}</button></>}>
      <div className="product-form"><Field label={label}><textarea rows={3} value={v} onChange={(e) => setV(e.target.value)} autoFocus /></Field></div>
    </Modal>
  );
}

function QuoteForm({ d, look, onClose, onSubmit }: { d: Detail; look: Lookups; onClose: () => void; onSubmit: (b: unknown) => void }) {
  const [amount, setAmount] = useState(d.quote_amount !== null ? String(d.quote_amount) : "");
  const [currency, setCurrency] = useState(d.currency || "ARS");
  const [supplier, setSupplier] = useState(d.supplier_id ? String(d.supplier_id) : "");
  const [who, setWho] = useState(d.who_pays);
  return (
    <Modal eyebrow="PRESUPUESTO" title="Cargar presupuesto" onClose={onClose} footer={<><button className="secondary-button" onClick={onClose}>Volver</button>
      <button className="primary-button" disabled={numOrNull(amount) === null} onClick={() => onSubmit({ quote_amount: numOrNull(amount), currency, supplier_id: numOrNull(supplier), who_pays: who === "A_DEFINIR" ? null : who })}>Guardar</button></>}>
      <div className="product-form g3-grid">
        <Field label="Importe"><input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus /></Field>
        <Field label="Moneda"><select value={currency} onChange={(e) => setCurrency(e.target.value)}><option value="ARS">Pesos ($)</option><option value="USD">Dólares (USD)</option></select></Field>
        <Field label="Proveedor"><select value={supplier} onChange={(e) => setSupplier(e.target.value)}><option value="">Sin asignar</option>{look.suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
        <Field label="¿Quién paga?"><select value={who} onChange={(e) => setWho(e.target.value)}>{Object.entries(WHO_PAYS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <div className="hb-note hb-note-info wide">{look.owner_approval_limit > 0 ? `Si paga el propietario y supera ${moneyIn(look.owner_approval_limit, "ARS")}, queda esperando su aprobación.` : "Si paga el propietario, queda esperando su aprobación (el tope está en $0, así que siempre se pide)."}</div>
      </div>
    </Modal>
  );
}

function StartForm({ d, onClose, onSubmit }: { d: Detail; onClose: () => void; onSubmit: (b: unknown) => void }) {
  const [when, setWhen] = useState(""); const [note, setNote] = useState("");
  const blocked = d.needs_approval && d.owner_approval !== "APROBADA";
  return (
    <Modal title="Empezar el trabajo" onClose={onClose} footer={<><button className="secondary-button" onClick={onClose}>Volver</button>
      <button className="primary-button" disabled={blocked && (d.priority !== "URGENTE" || note.trim().length < 3)} onClick={() => onSubmit({ scheduled_for: when ? when + ":00" : null, urgent_override_note: strOrNull(note) })}>Empezar</button></>}>
      <div className="product-form">
        <Field label="Fecha y hora de la visita (opcional)"><input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></Field>
        {blocked && (d.priority === "URGENTE"
          ? <Field label="Es urgente: motivo para empezar sin la aprobación del propietario"><textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} /></Field>
          : <div className="hb-note hb-note-warn">Falta la aprobación del propietario. Solo una reparación urgente puede empezar sin ella.</div>)}
      </div>
    </Modal>
  );
}

function ResolveForm({ d, onClose, onSubmit }: { d: Detail; onClose: () => void; onSubmit: (b: unknown) => void }) {
  const [amount, setAmount] = useState(d.quote_amount !== null ? String(d.quote_amount) : "");
  const [who, setWho] = useState(d.who_pays); const [currency, setCurrency] = useState(d.currency || "ARS"); const [fx, setFx] = useState("");
  return (
    <Modal eyebrow="RESOLVER" title="Marcar resuelto" onClose={onClose} footer={<><button className="secondary-button" onClick={onClose}>Volver</button>
      <button className="primary-button" disabled={numOrNull(amount) === null || who === "A_DEFINIR" || (who === "INQUILINO" && currency === "USD" && numOrNull(fx) === null)}
        onClick={() => onSubmit({ final_amount: numOrNull(amount), who_pays: who, currency, fx_rate: currency === "USD" ? numOrNull(fx) : null })}>Resolver</button></>}>
      <div className="product-form g3-grid">
        <Field label="Costo final"><input inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} autoFocus /></Field>
        <Field label="Moneda"><select value={currency} onChange={(e) => setCurrency(e.target.value)}><option value="ARS">Pesos ($)</option><option value="USD">Dólares (USD)</option></select></Field>
        <Field label="¿Quién paga?" wide><select value={who} onChange={(e) => setWho(e.target.value)}>{Object.entries(WHO_PAYS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        {who === "INQUILINO" && currency === "USD" && <Field label="Cotización (pesos por dólar)" wide><input inputMode="decimal" value={fx} onChange={(e) => setFx(e.target.value)} /></Field>}
        <div className="hb-note hb-note-info wide">{who === "INQUILINO" ? "Se crea un cargo «Reparación» en la cuenta del inquilino." : who === "PROPIETARIO" ? "Se descuenta en la próxima liquidación del propietario." : who === "INMOBILIARIA" ? "Lo absorbe la inmobiliaria: no se imputa a nadie." : "Definí quién paga para poder resolver."}</div>
      </div>
    </Modal>
  );
}

function Suppliers({ canEdit, onFlash, onFail }: { canEdit: boolean; onFlash: (t: string) => void; onFail: (e: unknown) => void }) {
  const [rows, setRows] = useState<Supplier[] | null>(null);
  const [edit, setEdit] = useState<Supplier | "new" | null>(null);
  const load = useCallback(() => { appApi<Supplier[]>("/suppliers").then(setRows).catch(onFail); }, [onFail]);
  useEffect(() => { load(); }, [load]);
  return (
    <>
      {canEdit && <div className="hb-toolbar"><span className="hb-muted">Gremio y contacto de quienes hacen los arreglos.</span><button className="primary-button" onClick={() => setEdit("new")}>+ Nuevo proveedor</button></div>}
      {!rows ? <Loading /> : rows.length === 0 ? <Empty title="Sin proveedores">Cargá plomeros, electricistas y demás para asignarlos a los reclamos.</Empty> : (
        <div className="hb-table-wrap"><table className="hb-table">
          <thead><tr><th>Nombre</th><th>Rubro</th><th>Teléfono</th><th>Reclamos abiertos</th></tr></thead>
          <tbody>{rows.map((s) => (
            <tr key={s.id} className={canEdit ? "is-click" : ""} onClick={() => canEdit && setEdit(s)}>
              <td><strong>{s.name}</strong>{s.rating_notes && <small>{s.rating_notes}</small>}</td><td>{TRADES[s.trade] || s.trade}</td>
              <td>{phoneText(s.phone_area, s.phone_number)}</td><td className="num">{s.open_requests}</td></tr>))}</tbody></table></div>
      )}
      {edit && <SupplierForm s={edit === "new" ? null : edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); onFlash("Proveedor guardado"); }} onDeactivated={() => { setEdit(null); load(); onFlash("Proveedor desactivado"); }} />}
    </>
  );
}

function SupplierForm({ s, onClose, onSaved, onDeactivated }: { s: Supplier | null; onClose: () => void; onSaved: () => void; onDeactivated: () => void }) {
  const [f, setF] = useState({ name: s?.name || "", trade: s?.trade || "OTRO", phone_area: s?.phone_area || "", phone_number: s?.phone_number || "", email: s?.email || "", cuit_text: s?.cuit_text || "", notes: s?.notes || "", rating_notes: s?.rating_notes || "" });
  const [error, setError] = useState("");
  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));
  async function save() {
    try {
      const body = { name: f.name, trade: f.trade, phone_area: strOrNull(f.phone_area), phone_number: strOrNull(f.phone_number), email: strOrNull(f.email), cuit_text: strOrNull(f.cuit_text), notes: strOrNull(f.notes), rating_notes: strOrNull(f.rating_notes), active: true };
      await appApi(s ? `/suppliers/${s.id}` : "/suppliers", { method: s ? "PUT" : "POST", body });
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar"); }
  }
  return (
    <Modal eyebrow="PROVEEDOR" title={s ? s.name : "Nuevo proveedor"} onClose={onClose}
      footer={<>{s && <button className="hb-link hb-link-danger" onClick={async () => { try { await appApi(`/suppliers/${s.id}`, { method: "DELETE" }); onDeactivated(); } catch (e) { setError(e instanceof Error ? e.message : "Error"); } }}>Desactivar</button>}
        <button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={f.name.trim().length < 2} onClick={save}>Guardar</button></>}>
      <div className="product-form g3-grid">
        <Field label="Nombre" wide><input value={f.name} onChange={(e) => set("name", e.target.value)} autoFocus /></Field>
        <Field label="Rubro"><select value={f.trade} onChange={(e) => set("trade", e.target.value)}>{Object.entries(TRADES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="CUIT (opcional)"><input value={f.cuit_text} onChange={(e) => set("cuit_text", e.target.value)} /></Field>
        <Field label="Código de área (sin 0)"><input inputMode="numeric" value={f.phone_area} onChange={(e) => set("phone_area", e.target.value)} /></Field>
        <Field label="Número (sin 15)"><input inputMode="numeric" value={f.phone_number} onChange={(e) => set("phone_number", e.target.value)} /></Field>
        <Field label="Email" wide><input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} /></Field>
        <Field label="Cómo trabaja (nota interna)" wide><input value={f.rating_notes} onChange={(e) => set("rating_notes", e.target.value)} /></Field>
        <Field label="Notas" wide><textarea rows={2} value={f.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
        {error && <div className="hb-note hb-note-error wide" role="alert">{error}</div>}
      </div>
    </Modal>
  );
}

export default MantenimientoPage;
