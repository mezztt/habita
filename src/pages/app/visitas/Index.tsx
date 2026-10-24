// Pantalla «Visitas» (módulo visitas): agenda por día o semana con confirmación por WhatsApp.
// Backend: backend/routes/visitas.py
import { useCallback, useEffect, useState } from "react";
import { addDays, appApi, dayKey, dayLabel, getSessionUser, hhmm, parseDay, toLocalISO } from "../../../config";
import { Empty, Field, Loading, Modal, PageHeader, Pill, Seg, useFlash, numOrNull, strOrNull } from "../../../components/ui";
import { WaButton, VISIT_STATUS } from "../../../components/g3/common";
import type { PropertyOpt, AgentOpt } from "../../../components/g3/common";
import "../../../g3.css";

interface Visit {
  id: number; property_id: number; property: string; property_code: string; property_status: string; keys_location: string | null; lead_id: number | null; visitor_name: string | null;
  visitor_phone: string | null; agent_id: number | null; agent_name: string | null; starts_at: string; ends_at: string; duration_min: number; status: string; keys_pickup_note: string | null;
  feedback: string | null; needs_confirmation: boolean; wa: { url: string | null; has_phone: boolean }; warnings?: string[];
}
interface Lookups { agents: AgentOpt[]; properties: PropertyOpt[]; leads: { id: number; full_name: string; phone_number: string | null; inquiry_property_id: number | null }[]; me: number; has_crm: boolean }

function VisitasPage() {
  const user = getSessionUser();
  const canWrite = user?.role === "ADMINISTRADOR" || user?.role === "AGENTE";
  const { show, fail, node: flash } = useFlash();
  const [mode, setMode] = useState<"dia" | "semana">("dia");
  const [day, setDay] = useState(dayKey(new Date()));
  const [agent, setAgent] = useState("");
  const [rows, setRows] = useState<Visit[] | null>(null);
  const [look, setLook] = useState<Lookups | null>(null);
  const [edit, setEdit] = useState<Visit | "new" | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);

  const start = mode === "semana" ? weekStart(day) : day;
  const days = mode === "semana" ? 7 : 1;
  const load = useCallback(() => {
    const qs = new URLSearchParams({ date: start, days: String(days) });
    if (agent) qs.set("agent_id", agent);
    appApi<Visit[]>(`/visits?${qs}`).then(setRows).catch(fail);
  }, [start, days, agent, fail]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { appApi<Lookups>("/visits/lookups").then(setLook).catch(fail); }, [fail]);

  const shift = (n: number) => setDay(dayKey(addDays(parseDay(day), n * (mode === "semana" ? 7 : 1))));
  const open = rows?.find((v) => v.id === openId) || null;
  const list = (k: string) => (rows || []).filter((v) => v.starts_at.slice(0, 10) === k);
  const keys = Array.from({ length: days }, (_, i) => dayKey(addDays(parseDay(start), i)));

  return (
    <section className="products-page">
      <PageHeader eyebrow="VISITAS" title="Agenda de visitas" subtitle="Quién visita qué propiedad, con qué agente y dónde está la llave.">
        {canWrite && <button className="primary-button" onClick={() => setEdit("new")}>+ Agendar visita</button>}
      </PageHeader>
      <div className="hb-toolbar">
        <div className="hb-row">
          <button className="secondary-button" onClick={() => shift(-1)} aria-label="Anterior">‹</button>
          <button className="secondary-button" onClick={() => setDay(dayKey(new Date()))}>Hoy</button>
          <button className="secondary-button" onClick={() => shift(1)} aria-label="Siguiente">›</button>
          <strong>{mode === "dia" ? dayLabel(parseDay(day), false) : `Semana del ${parseDay(start).toLocaleDateString("es-AR")}`}</strong>
        </div>
        <div className="hb-row">
          {look && user?.role !== "AGENTE" && <select className="hb-select" value={agent} onChange={(e) => setAgent(e.target.value)} aria-label="Agente"><option value="">Todos los agentes</option>{look.agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>}
          <Seg value={mode} onChange={setMode} options={[["dia", "Día"], ["semana", "Semana"]]} />
        </div>
      </div>
      {!rows ? <Loading /> : mode === "dia" ? (
        list(day).length === 0 ? <Empty title="Sin visitas este día">{canWrite ? "Agendá una con «Agendar visita»." : "No hay visitas agendadas."}</Empty> :
          <div className="hb-stack">{list(day).map((v) => <VisitRow key={v.id} v={v} onOpen={() => setOpenId(v.id)} />)}</div>
      ) : (
        <div className="g3-days">{keys.map((k) => (
          <div key={k} className={`g3-day ${k === dayKey(new Date()) ? "is-today" : ""}`}><h3>{dayLabel(parseDay(k))}</h3>
            {list(k).map((v) => <button key={v.id} type="button" className={`g3-visit st-${v.status}`} onClick={() => setOpenId(v.id)}><b>{hhmm(v.starts_at)} · {v.visitor_name || "Sin nombre"}</b><small>{v.property_code} · {v.agent_name || "Sin agente"}</small></button>)}
            {list(k).length === 0 && <div className="g3-empty-col">—</div>}</div>))}</div>
      )}
      {open && <VisitModal v={open} canWrite={canWrite} onClose={() => setOpenId(null)} onEdit={() => { setEdit(open); setOpenId(null); }} onChanged={load} onFlash={show} onFail={fail} />}
      {edit && look && <VisitForm look={look} visit={edit === "new" ? null : edit} defaultDay={day} onClose={() => setEdit(null)} onSaved={(w) => { setEdit(null); load(); show(w || "Visita guardada"); }} />}
      {flash}
    </section>
  );
}

function weekStart(key: string): string {
  const d = parseDay(key); const dow = (d.getDay() + 6) % 7;
  return dayKey(addDays(d, -dow));
}

function VisitRow({ v, onOpen }: { v: Visit; onOpen: () => void }) {
  const [label, tone] = VISIT_STATUS[v.status];
  return (
    <button type="button" className={`g3-visit st-${v.status}`} onClick={onOpen} style={{ padding: "12px 14px" }}>
      <div className="hb-spread"><b>{hhmm(v.starts_at)}–{hhmm(v.ends_at)} · {v.visitor_name || "Sin nombre"}</b><span className="hb-row">{v.needs_confirmation && <Pill tone="red">Sin confirmar</Pill>}<Pill tone={tone}>{label}</Pill></span></div>
      <small>{v.property_code} · {v.property} · {v.agent_name || "Sin agente"}</small>
    </button>
  );
}

function VisitModal({ v, canWrite, onClose, onEdit, onChanged, onFlash, onFail }: { v: Visit; canWrite: boolean; onClose: () => void; onEdit: () => void; onChanged: () => void; onFlash: (t: string) => void; onFail: (e: unknown) => void }) {
  const [wa, setWa] = useState<{ url: string | null; has_phone: boolean } | null>(null);
  const [mode, setMode] = useState<null | "done" | "cancel">(null);
  const [text, setText] = useState(""); const [res, setRes] = useState("REALIZADA");
  const [label, tone] = VISIT_STATUS[v.status];
  const active = v.status === "AGENDADA" || v.status === "CONFIRMADA";
  async function confirm() { try { const r = await appApi<Visit & { whatsapp: { url: string | null; has_phone: boolean } }>(`/visits/${v.id}/confirm`, { method: "POST" }); setWa(r.whatsapp); onChanged(); onFlash("Visita confirmada"); } catch (e) { onFail(e); } }
  async function finish() {
    try { await appApi(`/visits/${v.id}/${mode === "done" ? "done" : "cancel"}`, { method: "POST", body: mode === "done" ? { status: res, feedback: strOrNull(text) } : { reason: strOrNull(text) } }); setMode(null); onChanged(); onClose(); onFlash("Listo"); } catch (e) { onFail(e); }
  }
  return (
    <Modal eyebrow={`${new Date(v.starts_at).toLocaleDateString("es-AR")} · ${hhmm(v.starts_at)}–${hhmm(v.ends_at)}`} title={v.visitor_name || "Visita"} onClose={onClose}>
      <div className="hb-row"><Pill tone={tone}>{label}</Pill>{v.property_status !== "DISPONIBLE" && <Pill tone="orange">La propiedad no figura disponible</Pill>}</div>
      <dl className="g3-kv">
        <dt>Propiedad</dt><dd>{v.property_code} · {v.property}</dd><dt>Agente</dt><dd>{v.agent_name || "Sin agente"}</dd>
        <dt>Llave</dt><dd>{v.keys_pickup_note || v.keys_location || "Sin dato"}</dd>
        {v.visitor_phone && <><dt>Teléfono</dt><dd>{v.visitor_phone}</dd></>}{v.feedback && <><dt>Devolución</dt><dd>{v.feedback}</dd></>}</dl>
      {canWrite && active && !mode && (
        <div className="g3-actions">
          {v.status === "AGENDADA" && <button className="primary-button" onClick={confirm}>Confirmar</button>}
          <WaButton url={(wa || v.wa).url} label="WhatsApp de confirmación" hint="Falta el celular de la persona" />
          <button className="secondary-button" onClick={() => setMode("done")}>Marcar realizada</button>
          <button className="secondary-button" onClick={onEdit}>Cambiar horario</button>
          <button className="hb-link hb-link-danger" onClick={() => setMode("cancel")}>Cancelar</button>
        </div>
      )}
      {mode && (
        <div className="product-form" style={{ marginTop: 14 }}>
          {mode === "done" && <Field label="Resultado"><select value={res} onChange={(e) => setRes(e.target.value)}><option value="REALIZADA">Se hizo la visita</option><option value="AUSENTE">No vino</option></select></Field>}
          <Field label={mode === "done" ? "¿Cómo le fue? (devolución)" : "Motivo (opcional)"}><textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} /></Field>
          <div className="g3-actions"><button className="secondary-button" onClick={() => setMode(null)}>Volver</button><button className="primary-button" onClick={finish}>Guardar</button></div>
        </div>
      )}
      {wa && !wa.has_phone && <div className="hb-note hb-note-warn">Esta persona no tiene un celular completo: no se puede armar el WhatsApp.</div>}
    </Modal>
  );
}

function VisitForm({ look, visit, defaultDay, onClose, onSaved }: { look: Lookups; visit: Visit | null; defaultDay: string; onClose: () => void; onSaved: (warn?: string) => void }) {
  const [f, setF] = useState({
    property_id: visit ? String(visit.property_id) : "", lead_id: visit?.lead_id ? String(visit.lead_id) : "", visitor_name: visit?.visitor_name || "", visitor_phone: visit?.visitor_phone || "",
    agent_id: String(visit?.agent_id || look.me), date: visit ? visit.starts_at.slice(0, 10) : defaultDay, time: visit ? hhmm(visit.starts_at) : "10:00", duration: String(visit?.duration_min || 30), keys: visit?.keys_pickup_note || "",
  });
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));
  async function save() {
    setBusy(true); setError("");
    try {
      const starts_at = toLocalISO(new Date(`${f.date}T${f.time}:00`));
      const body = { property_id: numOrNull(f.property_id), lead_id: numOrNull(f.lead_id), visitor_name: strOrNull(f.visitor_name), visitor_phone: strOrNull(f.visitor_phone), agent_id: numOrNull(f.agent_id), starts_at, duration_min: numOrNull(f.duration) || 30, keys_pickup_note: strOrNull(f.keys) };
      const r = await appApi<Visit>(visit ? `/visits/${visit.id}` : "/visits", { method: visit ? "PUT" : "POST", body: visit ? { ...body, lead_id: undefined } : body });
      onSaved(r.warnings && r.warnings.length ? r.warnings.join(" ") : undefined);
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar"); } finally { setBusy(false); }
  }
  return (
    <Modal eyebrow={visit ? "CAMBIAR VISITA" : "AGENDAR VISITA"} title={visit ? "Cambiar visita" : "Agendar visita"} onClose={onClose} size="wide"
      footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={busy || !f.property_id || (!f.lead_id && !f.visitor_name.trim())} onClick={save}>{busy ? "Guardando..." : "Guardar"}</button></>}>
      <div className="product-form g3-grid">
        <Field label="Propiedad" wide><select value={f.property_id} onChange={(e) => set("property_id", e.target.value)} autoFocus><option value="">Elegí una propiedad</option>{look.properties.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.address}{p.status !== "DISPONIBLE" ? ` (${p.status.toLowerCase()})` : ""}</option>)}</select></Field>
        {!visit && look.has_crm && <Field label="Interesado" wide><select value={f.lead_id} onChange={(e) => { const l = look.leads.find((x) => String(x.id) === e.target.value); set("lead_id", e.target.value); if (l?.inquiry_property_id && !f.property_id) set("property_id", String(l.inquiry_property_id)); }}><option value="">Otra persona (escribir nombre)</option>{look.leads.map((l) => <option key={l.id} value={l.id}>{l.full_name}{l.phone_number ? ` · ${l.phone_number}` : ""}</option>)}</select></Field>}
        {!f.lead_id && <><Field label="Nombre de quien visita"><input value={f.visitor_name} onChange={(e) => set("visitor_name", e.target.value)} /></Field><Field label="Celular (con código de área)"><input inputMode="tel" value={f.visitor_phone} onChange={(e) => set("visitor_phone", e.target.value)} placeholder="2615551234" /></Field></>}
        <Field label="Día"><input type="date" value={f.date} onChange={(e) => set("date", e.target.value)} /></Field>
        <Field label="Hora"><input type="time" value={f.time} onChange={(e) => set("time", e.target.value)} /></Field>
        <Field label="Duración (minutos)"><input inputMode="numeric" value={f.duration} onChange={(e) => set("duration", e.target.value)} /></Field>
        <Field label="Agente"><select value={f.agent_id} onChange={(e) => set("agent_id", e.target.value)}>{look.agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select></Field>
        <Field label="Dónde se retira la llave" wide hint="Vacío: usa el dato de la propiedad"><input value={f.keys} onChange={(e) => set("keys", e.target.value)} /></Field>
        {error && <div className="hb-note hb-note-error wide" role="alert">{error}</div>}
      </div>
    </Modal>
  );
}

export default VisitasPage;
