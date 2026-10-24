// Pantalla «Documentos» (módulo documentos, grupo G1): archivo de documentos con vencimiento y calendario unificado de vencimientos.
// Backend: backend/routes/documentos.py · pendiente: documentos_por_vencer.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { API_URL, appApi, getSessionUser, shortDate } from "../../../config";
import { Empty, Loading, Modal, PageHeader, Pill, Tabs, useFlash, useRefreshKey } from "../../../components/ui";
import { CAL_KIND, DOC_ENTITY, DOC_KIND, dueTone, daysText } from "../../../components/g1/common";
import { DocumentModal } from "../../../components/documentos/DocumentModal";
import "../../../g1.css";

type Tab = "lista" | "calendario";
interface Doc {
  id: number; entity_type: string; entity_label: string; entity_id: number | null; entity_name: string | null; name: string; kind: string; kind_label: string; number: string | null;
  issued_on: string | null; expires_on: string | null; days_left: number | null; tone: string | null; file_id: number | null; file_path: string | null; private: boolean; notes: string | null;
}
interface Ev { date: string; kind: string; label: string; detail: string; path: string; days: number; tone: string }

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function DocumentosPage() {
  const user = getSessionUser();
  const [params, setParams] = useSearchParams();
  const refreshKey = useRefreshKey();
  const flash = useFlash();
  const manage = ["ADMINISTRADOR", "ENCARGADO"].includes(user?.role || "");
  const [tab, setTab] = useState<Tab>(params.get("tab") === "calendario" ? "calendario" : "lista");
  const [entity, setEntity] = useState(params.get("entidad") || "");
  const entityId = Number(params.get("entidad_id")) || null;
  const [kind, setKind] = useState("");
  const [onlyExpiring, setOnlyExpiring] = useState(params.get("vence") === "30");
  const [q, setQ] = useState("");
  const [data, setData] = useState<{ items: Doc[]; counts: { total: number; vencidos: number; por_vencer: number } } | null>(null);
  const [cal, setCal] = useState<Ev[] | null>(null);
  const [calDays, setCalDays] = useState(120);
  const [edit, setEdit] = useState<null | { doc?: Doc; preset?: { entity: string; id: number | null } }>(
    params.get("nuevo") && manage ? { preset: { entity: params.get("entidad") || "PROPERTY", id: Number(params.get("entidad_id")) || null } } : null);
  const [del, setDel] = useState<Doc | null>(null);

  const load = useCallback(() => {
    const qs = new URLSearchParams();
    if (entity) qs.set("entity", entity);
    if (entityId) qs.set("entity_id", String(entityId));
    if (kind) qs.set("kind", kind);
    if (onlyExpiring) qs.set("expiring_in", "30");
    if (q.trim()) qs.set("q", q.trim());
    appApi<{ items: Doc[]; counts: { total: number; vencidos: number; por_vencer: number } }>(`/documents?${qs}`).then(setData).catch(flash.fail);
  }, [entity, entityId, kind, onlyExpiring, q, flash.fail]);
  const loadCal = useCallback(() => { appApi<{ items: Ev[] }>(`/documents/calendar?days=${calDays}`).then((r) => setCal(r.items)).catch(flash.fail); }, [calDays, flash.fail]);
  useEffect(() => { const t = window.setTimeout(load, 200); return () => window.clearTimeout(t); }, [load, refreshKey]);
  useEffect(() => { if (tab === "calendario") loadCal(); }, [tab, loadCal, refreshKey]);
  useEffect(() => { if (params.get("nuevo") || params.get("vence") || params.get("tab")) { const n = new URLSearchParams(params); ["nuevo", "vence", "tab"].forEach((k) => n.delete(k)); setParams(n, { replace: true }); } }, []); // eslint-disable-line

  const byMonth = useMemo(() => {
    const out = new Map<string, Ev[]>();
    for (const e of cal || []) { const k = e.date.slice(0, 7); out.set(k, [...(out.get(k) || []), e]); }
    return [...out.entries()];
  }, [cal]);

  async function remove() {
    if (!del) return;
    try { await appApi(`/documents/${del.id}`, { method: "DELETE" }); flash.show("Documento borrado"); setDel(null); load(); } catch (e) { flash.fail(e); setDel(null); }
  }

  return (
    <section className="products-page">
      <PageHeader eyebrow="DOCUMENTOS" title="Documentos y vencimientos" subtitle="Escrituras, contratos escaneados, pólizas y matrícula, con aviso antes de que venzan.">
        {manage && <button className="primary-button" onClick={() => setEdit({})} data-tour="documento-nuevo">Subir un documento</button>}
      </PageHeader>
      {flash.node}
      <Tabs<Tab> value={tab} onChange={setTab} options={[["lista", "Documentos"], ["calendario", "Calendario de vencimientos"]]} />

      {tab === "lista" && (
        <>
          {data && (data.counts.vencidos > 0 || data.counts.por_vencer > 0) && (
            <div className="hb-kpis">
              <button className={`hb-kpi ${data.counts.vencidos ? "is-alert" : ""}`} onClick={() => setOnlyExpiring(true)}><span>Vencidos</span><strong>{data.counts.vencidos}</strong><small>Renovalos o reemplazalos</small></button>
              <button className={`hb-kpi ${data.counts.por_vencer ? "is-warn" : ""}`} onClick={() => setOnlyExpiring(true)}><span>Vencen en 30 días</span><strong>{data.counts.por_vencer}</strong><small>Tocá para verlos</small></button>
            </div>)}
          <div className="g1-filters">
            <input type="search" placeholder="Buscar por nombre, número o a qué pertenece" aria-label="Buscar documentos" value={q} onChange={(e) => setQ(e.target.value)} />
            <select aria-label="Pertenece a" value={entity} onChange={(e) => { setEntity(e.target.value); if (entityId) setParams({}); }}><option value="">Todo</option>{Object.entries(DOC_ENTITY).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            <select aria-label="Tipo" value={kind} onChange={(e) => setKind(e.target.value)}><option value="">Todos los tipos</option>{Object.entries(DOC_KIND).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            <div className="hb-seg"><button className={!onlyExpiring ? "is-on" : ""} onClick={() => setOnlyExpiring(false)}>Todos</button><button className={onlyExpiring ? "is-on" : ""} onClick={() => setOnlyExpiring(true)}>Vencen en 30 días</button></div>
          </div>
          {entityId && <div className="hb-row" style={{ marginBottom: 10 }}><Pill tone="blue">Documentos de {DOC_ENTITY[entity]?.toLowerCase()} #{entityId}</Pill><button className="g1-mini" onClick={() => { setParams({}); setEntity(""); }}>Ver todos</button></div>}
          {!data ? <Loading /> : data.items.length === 0 ? <Empty title={data.counts.total ? "Ningún documento con ese filtro" : "Todavía no cargaste documentos"}>{manage ? "Subí la escritura, las pólizas de seguro, la matrícula del corredor." : ""}</Empty> : (
            <div className="hb-table-wrap"><table className="hb-table">
              <thead><tr><th>Documento</th><th>Pertenece a</th><th>Vencimiento</th><th /></tr></thead>
              <tbody>{data.items.map((d) => (
                <tr key={d.id}>
                  <td><strong>{d.name}</strong><small>{d.kind_label}{d.number ? ` · ${d.number}` : ""}</small></td>
                  <td>{d.entity_label}<small>{d.entity_name || ""}</small></td>
                  <td>{d.expires_on ? <>{shortDate(d.expires_on)} <Pill tone={dueTone(d.tone)}>{d.days_left !== null && d.days_left < 0 ? "Vencido" : d.days_left !== null && d.days_left <= 30 ? "Por vencer" : "Vigente"}</Pill><small>{daysText(d.days_left)}</small></> : "No vence"}</td>
                  <td><div className="g1-actions end">
                    {d.file_path ? <a className="g1-mini" href={API_URL + d.file_path} target="_blank" rel="noopener noreferrer">Abrir</a> : <span className="hb-hint">Sin archivo</span>}
                    {manage && <button className="g1-mini" onClick={() => setEdit({ doc: d })}>Editar</button>}
                    {manage && <button className="g1-mini is-danger" onClick={() => setDel(d)}>Borrar</button>}
                  </div></td>
                </tr>))}</tbody></table></div>)}
        </>)}

      {tab === "calendario" && (
        <>
          <div className="g1-filters">
            <div className="hb-seg">{[60, 120, 365].map((n) => <button key={n} className={calDays === n ? "is-on" : ""} onClick={() => setCalDays(n)}>{n === 365 ? "Un año" : `${n} días`}</button>)}</div>
            <span className="hb-hint">Contratos, ajustes, garantías, pólizas, documentos, matrícula, sellado y fechas UIF, según los módulos que tengas.</span>
          </div>
          {!cal ? <Loading /> : cal.length === 0 ? <Empty title="No hay vencimientos en este período">Cuando cargues contratos, garantías o documentos con fecha, aparecen acá.</Empty> : (
            <div className="g1-cal">
              {byMonth.map(([m, evs]) => (
                <div key={m} className="g1-cal-month">
                  <h3>{MONTHS[Number(m.slice(5)) - 1]} {m.slice(0, 4)}</h3>
                  {evs.map((e, i) => {
                    const inner = (
                      <>
                        <span className="g1-cal-date">{shortDate(e.date).slice(0, 5)}</span>
                        <span><strong>{e.label}</strong>{e.detail && <small>{e.detail}</small>}</span>
                        <span className="hb-row" style={{ justifyContent: "flex-end" }}><Pill tone="gray">{CAL_KIND[e.kind] || e.kind}</Pill><Pill tone={dueTone(e.tone)}>{e.days < 0 ? `hace ${-e.days} d` : e.days === 0 ? "hoy" : `en ${e.days} d`}</Pill></span>
                      </>);
                    return e.path ? <Link key={i} className="g1-cal-item" to={e.path}>{inner}</Link> : <div key={i} className="g1-cal-item">{inner}</div>;
                  })}
                </div>))}
            </div>)}
        </>)}

      {edit && <DocumentModal doc={edit.doc} preset={edit.preset} onClose={() => setEdit(null)} onDone={() => { setEdit(null); load(); if (tab === "calendario") loadCal(); }} flash={flash} />}
      {del && (
        <Modal title="¿Borrar el documento?" eyebrow="DOCUMENTOS" onClose={() => setDel(null)} footer={<><button className="secondary-button" onClick={() => setDel(null)}>No, volver</button><button className="primary-button" onClick={remove}>Sí, borrar</button></>}>
          <p className="hb-muted">Se borra «{del.name}» de la lista. Queda anotado en la auditoría.</p>
        </Modal>)}
    </section>
  );
}

export default DocumentosPage;
