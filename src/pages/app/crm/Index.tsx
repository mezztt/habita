// Pantalla «Interesados» (módulo crm): tablero de consultas hasta el contrato.
// Backend: backend/routes/crm.py
import { useCallback, useEffect, useMemo, useState } from "react";
import { appApi, getSessionUser, isReadOnly, moneyIn, phoneText, shortDate, dateTime } from "../../../config";
import { Empty, Field, Loading, Modal, PageHeader, Pill, Seg, useFlash, numOrNull, strOrNull } from "../../../components/ui";
import { WaButton, LEAD_STATUS, SOURCE, OPERATION, PROPERTY_KIND, fromInputDateTime } from "../../../components/g3/common";
import type { PropertyOpt, AgentOpt } from "../../../components/g3/common";
import "../../../g3.css";

interface Lead {
  id: number; full_name: string; phone_area: string | null; phone_number: string | null; wa_url: string | null; email: string | null; source: string; interest: string;
  budget_max: number | null; budget_currency: string; rooms_min: number | null; zone_text: string | null; status: string; lost_reason: string | null; agent_id: number | null; agent_name: string | null;
  next_followup_at: string | null; followup_overdue: boolean; has_consent: boolean; created_at: string; inquiry_property: string | null; duplicates: number; uncontacted_24h: boolean;
  converted_contract_id: number | null; converted_party_id: number | null;
}
interface LeadDetail extends Lead {
  notes: { id: number; kind: string; text: string; user: string | null; created_at: string }[];
  properties: (PropertyOpt & { link_status: string; link_note: string | null })[];
  visits: { id: number; property: string; starts_at: string; status: string; feedback: string | null }[];
  possible_duplicates: { id: number; full_name: string; status: string; phone_number: string | null }[];
}
interface Lookups { agents: AgentOpt[]; properties: PropertyOpt[]; modules: string[]; me: number }
interface Match { items: (PropertyOpt & { reasons: string[]; flags: string[] })[]; total: number; discarded: number }

const BOARD: [string, string[]][] = [["Nuevos", ["NUEVO"]], ["Contactados", ["CONTACTADO"]], ["Visita", ["VISITA_AGENDADA", "VISITO"]], ["Oferta", ["OFERTA"]], ["Cerrados", ["GANADO", "PERDIDO"]]];
const NOTE_KIND: Record<string, string> = { NOTA: "Nota", LLAMADA: "Llamada", WHATSAPP: "WhatsApp", VISITA: "Visita" };

function CrmPage() {
  const user = getSessionUser();
  const canWrite = !isReadOnly(user) && (user?.role === "ADMINISTRADOR" || user?.role === "AGENTE");
  const { show, fail, node: flash } = useFlash();
  const [rows, setRows] = useState<Lead[] | null>(null);
  const [look, setLook] = useState<Lookups | null>(null);
  const [view, setView] = useState<"tablero" | "lista">("tablero");
  const [q, setQ] = useState(""); const [agent, setAgent] = useState("");
  const [creating, setCreating] = useState(false); const [openId, setOpenId] = useState<number | null>(null);

  const load = useCallback(() => { appApi<Lead[]>("/leads").then(setRows).catch(fail); }, [fail]);
  useEffect(() => { load(); appApi<Lookups>("/leads/lookups").then(setLook).catch(fail); }, [load, fail]);
  const shown = useMemo(() => (rows || []).filter((l) => (!agent || (agent === "none" ? !l.agent_id : String(l.agent_id) === agent)) &&
    (!q.trim() || `${l.full_name} ${l.phone_number || ""} ${l.email || ""} ${l.zone_text || ""}`.toLowerCase().includes(q.trim().toLowerCase()))), [rows, q, agent]);

  return (
    <section className="products-page">
      <PageHeader eyebrow="INTERESADOS" title="Interesados" subtitle="Quién consultó, qué busca y cuándo hay que volver a llamarlo.">
        {canWrite && <button className="primary-button" onClick={() => setCreating(true)}>+ Nueva consulta</button>}
      </PageHeader>
      <div className="hb-toolbar">
        <div className="hb-filters">
          <input className="hb-search" placeholder="Buscar nombre, teléfono o zona" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar" />
          {look && user?.role !== "AGENTE" && <select value={agent} onChange={(e) => setAgent(e.target.value)} aria-label="Agente"><option value="">Todos los agentes</option><option value="none">Sin asignar</option>{look.agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>}
        </div>
        <Seg value={view} onChange={setView} options={[["tablero", "Tablero"], ["lista", "Lista"]]} />
      </div>
      {!rows ? <Loading /> : rows.length === 0 ? <Empty title="Todavía no hay interesados">Las consultas de tu web de propiedades llegan solas acá. También podés cargar una con «Nueva consulta».</Empty> : view === "tablero" ? (
        <div className="g3-board">
          {BOARD.map(([title, sts]) => {
            const col = shown.filter((l) => sts.includes(l.status));
            return (
              <div className="g3-col" key={title}><h3>{title}<span>{col.length}</span></h3>
                {col.length === 0 && <div className="g3-empty-col">Nadie</div>}
                {col.map((l) => <LeadCard key={l.id} l={l} onOpen={() => setOpenId(l.id)} />)}</div>
            );
          })}
        </div>
      ) : (
        <div className="hb-table-wrap"><table className="hb-table">
          <thead><tr><th>Nombre</th><th>Teléfono</th><th>Busca</th><th>Origen</th><th>Agente</th><th>Seguimiento</th><th>Estado</th></tr></thead>
          <tbody>{shown.map((l) => (<tr key={l.id} className="is-click" onClick={() => setOpenId(l.id)}>
            <td><strong>{l.full_name}</strong>{l.duplicates > 0 && <small>Posible duplicado</small>}</td><td>{phoneText(l.phone_area, l.phone_number)}</td>
            <td>{l.zone_text || "—"}{l.budget_max ? <small>Hasta {moneyIn(l.budget_max, l.budget_currency)}</small> : null}</td><td>{SOURCE[l.source]}</td><td>{l.agent_name || "Sin asignar"}</td>
            <td>{l.next_followup_at ? <span style={l.followup_overdue ? { color: "var(--hb-red-text)", fontWeight: 700 } : undefined}>{dateTime(l.next_followup_at)}</span> : "—"}</td>
            <td><Pill tone={LEAD_STATUS[l.status][1]}>{LEAD_STATUS[l.status][0]}</Pill></td></tr>))}</tbody></table></div>
      )}
      {creating && look && <LeadForm look={look} onClose={() => setCreating(false)} onSaved={(id, warn) => { setCreating(false); load(); setOpenId(id); show(warn || "Consulta cargada"); }} />}
      {openId !== null && look && <LeadModal id={openId} look={look} canWrite={canWrite} onClose={() => { setOpenId(null); load(); }} onFlash={show} onFail={fail} onOpen={setOpenId} />}
      {flash}
    </section>
  );
}

function LeadCard({ l, onOpen }: { l: Lead; onOpen: () => void }) {
  return (
    <button type="button" className={`g3-card ${l.followup_overdue || l.uncontacted_24h ? "is-late" : ""}`} onClick={onOpen}>
      <strong>{l.full_name}</strong>
      <small>{l.inquiry_property || l.zone_text || SOURCE[l.source]}{l.budget_max ? ` · hasta ${moneyIn(l.budget_max, l.budget_currency)}` : ""}</small>
      <small>{l.agent_name || "Sin asignar"} · {shortDate(l.created_at)}</small>
      <div className="hb-row">
        {l.uncontacted_24h && <Pill tone="red">Sin contactar</Pill>}
        {l.followup_overdue && <Pill tone="red">Seguimiento vencido</Pill>}
        {!l.followup_overdue && l.next_followup_at && <Pill tone="blue">Llamar {shortDate(l.next_followup_at)}</Pill>}
        {l.duplicates > 0 && <Pill tone="orange">Duplicado?</Pill>}
        {l.source === "WEB" && <Pill tone="brand">Web</Pill>}
      </div>
    </button>
  );
}

function LeadForm({ look, onClose, onSaved }: { look: Lookups; onClose: () => void; onSaved: (id: number, warn?: string) => void }) {
  const [f, setF] = useState({ full_name: "", phone_area: "", phone_number: "", email: "", source: "WHATSAPP", interest: "ALQUILER", budget_max: "", budget_currency: "ARS", rooms_min: "", zone_text: "", property_id: "", note: "", consent: false });
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const set = (k: string, v: string | boolean) => setF((x) => ({ ...x, [k]: v }));
  async function save() {
    setBusy(true); setError("");
    try {
      const r = await appApi<Lead & { possible_duplicates: unknown[]; phone_warning: string | null }>("/leads", { method: "POST", body: {
        full_name: f.full_name, phone_area: strOrNull(f.phone_area), phone_number: strOrNull(f.phone_number), email: strOrNull(f.email), source: f.source, interest: f.interest,
        budget_max: numOrNull(f.budget_max), budget_currency: f.budget_currency, rooms_min: numOrNull(f.rooms_min), zone_text: strOrNull(f.zone_text), property_id: numOrNull(f.property_id), note: strOrNull(f.note), consent: f.consent } });
      onSaved(r.id, r.possible_duplicates.length ? "Ojo: ya hay otro interesado con este celular. Revisá si es el mismo y fusionalos." : r.phone_warning || undefined);
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar"); } finally { setBusy(false); }
  }
  return (
    <Modal eyebrow="NUEVA CONSULTA" title="Nueva consulta" onClose={onClose} size="wide" footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={busy || f.full_name.trim().length < 2} onClick={save}>{busy ? "Guardando..." : "Guardar"}</button></>}>
      <div className="product-form g3-grid">
        <Field label="Nombre" wide><input value={f.full_name} onChange={(e) => set("full_name", e.target.value)} autoFocus /></Field>
        <Field label="Código de área (sin 0)"><input inputMode="numeric" value={f.phone_area} onChange={(e) => set("phone_area", e.target.value)} placeholder="261" /></Field>
        <Field label="Celular (sin 15)"><input inputMode="numeric" value={f.phone_number} onChange={(e) => set("phone_number", e.target.value)} placeholder="5551234" /></Field>
        <Field label="Email" wide><input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} /></Field>
        <Field label="Cómo llegó"><select value={f.source} onChange={(e) => set("source", e.target.value)}>{Object.entries(SOURCE).filter(([k]) => k !== "WEB").map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Busca"><select value={f.interest} onChange={(e) => set("interest", e.target.value)}><option value="ALQUILER">Alquilar</option><option value="COMPRA">Comprar</option></select></Field>
        <Field label="Presupuesto máximo"><input inputMode="decimal" value={f.budget_max} onChange={(e) => set("budget_max", e.target.value)} /></Field>
        <Field label="Moneda"><select value={f.budget_currency} onChange={(e) => set("budget_currency", e.target.value)}><option value="ARS">Pesos ($)</option><option value="USD">Dólares (USD)</option></select></Field>
        <Field label="Ambientes (mínimo)"><input inputMode="numeric" value={f.rooms_min} onChange={(e) => set("rooms_min", e.target.value)} /></Field>
        <Field label="Zona"><input value={f.zone_text} onChange={(e) => set("zone_text", e.target.value)} placeholder="Ej.: Centro, Godoy Cruz" /></Field>
        <Field label="Consultó por la propiedad" wide><select value={f.property_id} onChange={(e) => set("property_id", e.target.value)}><option value="">Ninguna en particular</option>{look.properties.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.address}</option>)}</select></Field>
        <Field label="Nota" wide><textarea rows={2} value={f.note} onChange={(e) => set("note", e.target.value)} /></Field>
        <div className="hb-inline-checks wide"><label><input type="checkbox" checked={f.consent} onChange={(e) => set("consent", e.target.checked)} /> La persona aceptó que guardemos sus datos para atender su consulta (Ley 25.326)</label></div>
        {error && <div className="hb-note hb-note-error wide" role="alert">{error}</div>}
      </div>
    </Modal>
  );
}

function LeadModal({ id, look, canWrite, onClose, onFlash, onFail, onOpen }: { id: number; look: Lookups; canWrite: boolean; onClose: () => void; onFlash: (t: string) => void; onFail: (e: unknown) => void; onOpen: (id: number) => void }) {
  const [d, setD] = useState<LeadDetail | null>(null);
  const [noteKind, setNoteKind] = useState("LLAMADA"); const [noteText, setNoteText] = useState(""); const [follow, setFollow] = useState("");
  const [match, setMatch] = useState<Match | null>(null); const [fx, setFx] = useState("");
  const [lost, setLost] = useState(false); const [lostReason, setLostReason] = useState("");
  const [convert, setConvert] = useState(false);
  const refresh = useCallback(() => { appApi<LeadDetail>(`/leads/${id}`).then(setD).catch(onFail); }, [id, onFail]);
  useEffect(() => { refresh(); }, [refresh]);
  if (!d) return <Modal title="Interesado" onClose={onClose}><Loading /></Modal>;
  const closed = d.status === "GANADO" || d.status === "PERDIDO";
  const hasContracts = look.modules.includes("contratos");

  async function put(body: unknown, msg?: string) { try { await appApi(`/leads/${id}`, { method: "PUT", body }); refresh(); if (msg) onFlash(msg); } catch (e) { onFail(e); } }
  async function addNote() {
    try { await appApi(`/leads/${id}/notes`, { method: "POST", body: { kind: noteKind, text: noteText, next_followup_at: fromInputDateTime(follow) } }); setNoteText(""); setFollow(""); refresh(); onFlash("Nota guardada"); } catch (e) { onFail(e); }
  }
  async function doMatch() { try { setMatch(await appApi<Match>(`/leads/${id}/match`, { method: "POST", body: { fx_rate: numOrNull(fx) } })); } catch (e) { onFail(e); } }
  async function link(pid: number, status: string) { try { await appApi(`/leads/${id}/properties`, { method: "POST", body: { property_id: pid, status } }); refresh(); onFlash("Guardada en su lista"); } catch (e) { onFail(e); } }
  async function merge(target: number) {
    if (!window.confirm("¿Fusionar este interesado dentro del otro? Se pasan sus notas, propiedades y visitas.")) return;
    try { await appApi(`/leads/${id}/merge`, { method: "POST", body: { target_id: target } }); onFlash("Fusionados"); onOpen(target); } catch (e) { onFail(e); }
  }

  return (
    <Modal eyebrow={`INTERESADO · ${d.interest === "ALQUILER" ? "ALQUILER" : "COMPRA"}`} title={d.full_name} onClose={onClose} size="xl">
      <div className="hb-row"><Pill tone={LEAD_STATUS[d.status][1]}>{LEAD_STATUS[d.status][0]}</Pill><Pill tone="gray">{SOURCE[d.source]}</Pill>{d.has_consent ? <Pill tone="green">Aceptó el uso de datos</Pill> : <Pill tone="orange">Sin consentimiento registrado</Pill>}</div>
      <dl className="g3-kv">
        <dt>Teléfono</dt><dd>{phoneText(d.phone_area, d.phone_number)} <WaButton url={d.wa_url} label="WhatsApp" className="hb-link" /></dd>
        {d.email && <><dt>Email</dt><dd>{d.email}</dd></>}
        <dt>Busca</dt><dd>{[d.zone_text, d.rooms_min ? `${d.rooms_min}+ amb.` : null, d.budget_max ? `hasta ${moneyIn(d.budget_max, d.budget_currency)}` : null].filter(Boolean).join(" · ") || "Sin datos"}</dd>
        {d.inquiry_property && <><dt>Consultó por</dt><dd>{d.inquiry_property}</dd></>}
        <dt>Agente</dt><dd>{canWrite ? <select value={d.agent_id || ""} aria-label="Agente" onChange={(e) => e.target.value ? put({ agent_id: Number(e.target.value) }, "Asignado") : put({ clear_agent: true })}><option value="">Sin asignar</option>{look.agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select> : d.agent_name || "Sin asignar"}</dd>
        <dt>Próximo contacto</dt><dd>{d.next_followup_at ? dateTime(d.next_followup_at) : "—"}</dd>
        {d.lost_reason && <><dt>Motivo de pérdida</dt><dd>{d.lost_reason}</dd></>}
      </dl>

      {d.possible_duplicates.length > 0 && (
        <div className="hb-note hb-note-warn">Hay otro interesado con este mismo celular: {d.possible_duplicates.map((x) => (
          <span key={x.id}> <b>{x.full_name}</b> {canWrite && <button className="hb-link" onClick={() => merge(x.id)}>fusionar dentro de este</button>}</span>))}. {canWrite && "Para dejar este como principal, abrí el otro y fusioná desde ahí."}</div>
      )}
      {d.converted_contract_id && <div className="hb-note hb-note-info">Convertido en inquilino. El contrato quedó en borrador en Contratos.</div>}

      {canWrite && !closed && (
        <>
          <div className="g3-section">Etapa</div>
          <div className="hb-row">
            {(["NUEVO", "CONTACTADO", "VISITA_AGENDADA", "VISITO", "OFERTA"] as const).map((s) => <button key={s} className={d.status === s ? "primary-button g3-small" : "secondary-button g3-small"} aria-pressed={d.status === s} onClick={() => put({ status: s })}>{LEAD_STATUS[s][0]}</button>)}
            <button className="secondary-button g3-small" onClick={() => setLost(true)}>Se perdió</button>
            <button className="primary-button g3-small" onClick={() => setConvert(true)}>Ganado: convertir en inquilino</button>
          </div>
        </>
      )}

      <div className="g3-section">Propiedades</div>
      {d.properties.length === 0 ? <p className="hb-muted">Todavía no hay propiedades asociadas.</p> : (
        <ul className="hb-list">{d.properties.map((p) => (<li key={p.id}><div className="hb-list-main"><strong>{p.code} · {p.address}</strong><small>{PROPERTY_KIND[p.kind]} · {p.list_price ? moneyIn(p.list_price, p.list_currency) : "Sin precio"}</small></div>
          <Pill tone={p.link_status === "INTERESA" ? "brand" : p.link_status === "VISITADA" ? "green" : "gray"}>{p.link_status === "INTERESA" ? "Le interesa" : p.link_status === "VISITADA" ? "Visitada" : "Descartada"}</Pill>
          {canWrite && p.link_status === "INTERESA" && <button className="hb-link" onClick={() => link(p.id, "DESCARTADA")}>Descartar</button>}</li>))}</ul>
      )}
      <div className="hb-row" style={{ marginTop: 8 }}>
        <button className="secondary-button" onClick={doMatch}>Sugerir propiedades</button>
        {d.budget_max && <input className="hb-search" style={{ minWidth: 0, width: 190 }} inputMode="decimal" placeholder="Cotización (opcional)" value={fx} onChange={(e) => setFx(e.target.value)} aria-label="Cotización pesos por dólar" />}
      </div>
      {match && (
        <div style={{ marginTop: 10 }}>
          {match.items.length === 0 ? <Empty title="Ninguna disponible encaja">Se descartaron {match.discarded}. Probá ampliar zona o presupuesto.</Empty> : (
            <ul className="hb-list">{match.items.map((p) => (<li key={p.id}><div className="hb-list-main"><strong>{p.code} · {p.address}</strong>
              <small>{OPERATION[p.operation]} · {p.list_price ? moneyIn(p.list_price, p.list_currency) : "Sin precio"}{p.reasons.length ? ` · ${p.reasons.join(", ")}` : ""}</small>
              {p.flags.map((fl) => <small key={fl} style={{ color: "var(--hb-orange-text)" }}>{fl}</small>)}</div>
              {canWrite && <button className="secondary-button g3-small" onClick={() => link(p.id, "INTERESA")}>Guardar</button>}</li>))}</ul>
          )}
        </div>
      )}

      {d.visits.length > 0 && <><div className="g3-section">Visitas</div><ul className="hb-list">{d.visits.map((v) => <li key={v.id}><div className="hb-list-main"><strong>{v.property}</strong><small>{dateTime(v.starts_at)}{v.feedback ? ` · ${v.feedback}` : ""}</small></div><Pill tone="gray">{v.status.toLowerCase()}</Pill></li>)}</ul></>}

      <div className="g3-section">Seguimiento</div>
      {canWrite && (
        <div className="product-form g3-grid">
          <Field label="Tipo"><select value={noteKind} onChange={(e) => setNoteKind(e.target.value)}>{Object.entries(NOTE_KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
          <Field label="Próximo contacto (opcional)"><input type="datetime-local" value={follow} onChange={(e) => setFollow(e.target.value)} /></Field>
          <Field label="Qué pasó" wide><textarea rows={2} value={noteText} onChange={(e) => setNoteText(e.target.value)} /></Field>
          <div className="wide"><button className="primary-button" disabled={!noteText.trim()} onClick={addNote}>Guardar nota</button></div>
        </div>
      )}
      {d.notes.length === 0 ? <p className="hb-muted">Sin notas todavía.</p> : <ul className="hb-list">{d.notes.map((n) => (<li key={n.id}><div className="hb-list-main"><strong>{NOTE_KIND[n.kind]} · {n.user || "Web"}</strong><small style={{ whiteSpace: "pre-line" }}>{n.text}</small></div><small className="hb-muted">{dateTime(n.created_at)}</small></li>))}</ul>}

      {lost && <Modal title="¿Por qué se perdió?" onClose={() => setLost(false)} footer={<><button className="secondary-button" onClick={() => setLost(false)}>Volver</button><button className="primary-button" disabled={lostReason.trim().length < 3} onClick={async () => { await put({ status: "PERDIDO", lost_reason: lostReason }, "Marcado como perdido"); setLost(false); }}>Confirmar</button></>}>
        <div className="product-form"><Field label="Motivo"><input value={lostReason} onChange={(e) => setLostReason(e.target.value)} placeholder="Precio, zona, eligió otra..." autoFocus /></Field></div></Modal>}
      {convert && <ConvertForm lead={d} look={look} hasContracts={hasContracts} onClose={() => setConvert(false)} onDone={(msg) => { setConvert(false); refresh(); onFlash(msg); }} onFail={onFail} />}
    </Modal>
  );
}

function ConvertForm({ lead, look, hasContracts, onClose, onDone, onFail }: { lead: LeadDetail; look: Lookups; hasContracts: boolean; onClose: () => void; onDone: (m: string) => void; onFail: (e: unknown) => void }) {
  const [make, setMake] = useState(hasContracts);
  const first = lead.properties.find((p) => p.link_status !== "DESCARTADA");
  const [prop, setProp] = useState(first ? String(first.id) : "");
  const [start, setStart] = useState(new Date().toISOString().slice(0, 10)); const [term, setTerm] = useState("24"); const [rent, setRent] = useState("");
  async function go() {
    try { const r = await appApi<{ detail: string }>(`/leads/${lead.id}/convert`, { method: "POST", body: { create_contract: make, property_id: numOrNull(prop), start_date: start, term_months: numOrNull(term) || 24, initial_rent: numOrNull(rent) } }); onDone(r.detail); } catch (e) { onFail(e); }
  }
  return (
    <Modal eyebrow="GANADO" title="Convertir en inquilino" onClose={onClose} footer={<><button className="secondary-button" onClick={onClose}>Volver</button><button className="primary-button" disabled={make && !prop} onClick={go}>Convertir</button></>}>
      <div className="product-form">
        <p>Se crea la persona «{lead.full_name}» como inquilino{make ? " y un contrato en borrador para completar en Contratos" : ""}.</p>
        {hasContracts && <div className="hb-inline-checks"><label><input type="checkbox" checked={make} onChange={(e) => setMake(e.target.checked)} /> Abrir un contrato en borrador</label></div>}
        {make && <>
          <Field label="Propiedad"><select value={prop} onChange={(e) => setProp(e.target.value)}><option value="">Elegí una</option>{look.properties.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.address}</option>)}</select></Field>
          <Field label="Inicio"><input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></Field>
          <Field label="Plazo (meses)"><input inputMode="numeric" value={term} onChange={(e) => setTerm(e.target.value)} /></Field>
          <Field label="Alquiler inicial" hint="Vacío: usa el precio de la propiedad"><input inputMode="decimal" value={rent} onChange={(e) => setRent(e.target.value)} /></Field></>}
      </div>
    </Modal>
  );
}

export default CrmPage;
