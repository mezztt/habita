// Pantalla «Cumplimiento UIF» (módulo uif, grupo G1): legajos, registro de operaciones, fechas y exportación para el contador.
// Backend: backend/routes/uif.py · pendientes: uif_fechas, uif_legajos. Habita NO presenta nada ante la UIF.
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { appApi, appBlob, getSessionUser, moneyIn, saveBlob, shortDate } from "../../../config";
import { Empty, Loading, Modal, PageHeader, Pill, Tabs, useFlash, useRefreshKey } from "../../../components/ui";
import { Note } from "../../../components/g1/common";
import { OperationModal, ProfileModal } from "../../../components/uif/Modales";
import "../../../g1.css";

type Tab = "resumen" | "legajos" | "operaciones" | "fechas" | "exportar";
const RISK: Record<string, [string, string]> = { BAJO: ["Bajo", "green"], MEDIO: ["Medio", "orange"], ALTO: ["Alto", "red"] };
const NOTICE = "Habita no presenta nada ante la UIF. Registra tus datos y te recuerda las fechas; presentar, clasificar y decidir es tuyo (y de tu contador o tu oficial de cumplimiento).";

interface Overview {
  notice: string; year: number; thresholds: { smvm: number | null; t300: number | null; t700: number | null }; warnings: string[];
  habitual: { party_id: number; party: string | null; operations: number; total_ars: number }[];
  counts: { profiles: number; operations_year: number; reportable_year: number; unreported: number; unusual: number; reviews_overdue: number; without_profile: number };
  unreported: Op[]; next_dates: DateEv[]; signals: string[]; retention_years: number;
}
interface DateEv { date: string; kind: string; label: string; detail: string; days: number }
interface Op {
  id: number; kind: string; kind_label: string; party_id: number; party: string | null; contract_id: number | null; contract_number: number | null; operation_date: string | null;
  amount_ars: number | null; annual_amount_ars: number | null; reportable: boolean; unusual: boolean; unusual_notes: string | null; reported_on: string | null; cash_involved: boolean; can_delete: boolean;
}
interface Prof {
  id: number; party_id: number; party: string | null; doc: string | null; risk: string; is_pep: boolean; repet_checked_on: string | null; pep_checked_on: string | null;
  source_of_funds_text: string | null; beneficial_owner_text: string | null; last_review_on: string | null; next_review_on: string | null; review_overdue: boolean; notes: string | null; can_delete: boolean;
}

function UifPage() {
  const user = getSessionUser();
  const [params, setParams] = useSearchParams();
  const refreshKey = useRefreshKey();
  const flash = useFlash();
  const write = user?.role === "ADMINISTRADOR";
  const [tab, setTab] = useState<Tab>((params.get("tab") as Tab) || "resumen");
  const [ov, setOv] = useState<Overview | null>(null);
  const [profiles, setProfiles] = useState<Prof[] | null>(null);
  const [ops, setOps] = useState<Op[] | null>(null);
  const [dates, setDates] = useState<DateEv[] | null>(null);
  const [kind, setKind] = useState("");
  const [onlyReportable, setOnlyReportable] = useState(false);
  const [q, setQ] = useState("");
  const [pm, setPm] = useState<null | { p?: Prof }>(null);
  const [om, setOm] = useState<null | { o?: Op }>(null);
  const [del, setDel] = useState<null | { type: "p" | "o"; id: number }>(null);

  const loadOv = useCallback(() => { appApi<Overview>("/aml/overview").then(setOv).catch(flash.fail); }, [flash.fail]);
  const loadProfiles = useCallback(() => { appApi<{ items: Prof[] }>(`/aml/profiles?q=${encodeURIComponent(q)}`).then((r) => setProfiles(r.items)).catch(flash.fail); }, [q, flash.fail]);
  const loadOps = useCallback(() => {
    const qs = new URLSearchParams();
    if (kind) qs.set("kind", kind);
    if (onlyReportable) qs.set("reportable", "true");
    appApi<{ items: Op[] }>(`/aml/operations?${qs}`).then((r) => setOps(r.items)).catch(flash.fail);
  }, [kind, onlyReportable, flash.fail]);
  const loadDates = useCallback(() => { appApi<{ items: DateEv[] }>("/aml/calendar").then((r) => setDates(r.items)).catch(flash.fail); }, [flash.fail]);
  useEffect(loadOv, [loadOv, refreshKey]);
  useEffect(() => { if (tab === "legajos") { const t = window.setTimeout(loadProfiles, 200); return () => window.clearTimeout(t); } }, [tab, loadProfiles, refreshKey]);
  useEffect(() => { if (tab === "operaciones") loadOps(); }, [tab, loadOps, refreshKey]);
  useEffect(() => { if (tab === "fechas") loadDates(); }, [tab, loadDates]);
  useEffect(() => { if (params.get("tab")) setParams({}, { replace: true }); }, []); // eslint-disable-line

  const reload = () => { setPm(null); setOm(null); loadOv(); loadProfiles(); loadOps(); };
  async function remove() {
    if (!del) return;
    try { await appApi(del.type === "p" ? `/aml/profiles/${del.id}` : `/aml/operations/${del.id}`, { method: "DELETE" }); flash.show("Borrado"); setDel(null); reload(); } catch (e) { flash.fail(e); setDel(null); }
  }
  async function download(k: "operations" | "profiles") {
    try { saveBlob(await appBlob(`/aml/export.csv?kind=${k}`), `uif-${k === "operations" ? "operaciones" : "legajos"}.csv`); flash.show("Exportación lista"); } catch (e) { flash.fail(e); }
  }
  const dateRow = (e: DateEv) => (
    <div key={e.date + e.kind} className="g1-cal-item"><span className="g1-cal-date">{shortDate(e.date)}</span><span><strong>{e.label}</strong><small>{e.detail}</small></span>
      <Pill tone={e.days < 0 ? "gray" : e.days <= 7 ? "red" : e.days <= 30 ? "orange" : "green"}>{e.days < 0 ? `hace ${-e.days} d` : e.days === 0 ? "hoy" : `en ${e.days} d`}</Pill></div>);

  return (
    <section className="products-page">
      <PageHeader eyebrow="CUMPLIMIENTO UIF" title="Cumplimiento UIF" subtitle="Legajos, operaciones alcanzadas y fechas para el sujeto obligado.">
        {write && tab === "operaciones" && <button className="primary-button" onClick={() => setOm({})}>Registrar una operación</button>}
        {write && tab === "legajos" && <button className="primary-button" onClick={() => setPm({})}>Nuevo legajo</button>}
      </PageHeader>
      {flash.node}
      <div className="g1-notice" role="note"><strong>{NOTICE}</strong></div>
      <Tabs<Tab> value={tab} onChange={setTab} options={[["resumen", "Resumen"], ["legajos", "Legajos"], ["operaciones", "Operaciones"], ["fechas", "Fechas"], ["exportar", "Exportar"]]} />

      {tab === "resumen" && (!ov ? <Loading /> : (
        <>
          {ov.warnings.map((w) => <div key={w} style={{ marginBottom: 10 }}><Note tone="warn">{w}</Note></div>)}
          <div className="hb-kpis">
            <div className="hb-kpi"><span>SMVM cargado</span><strong>{ov.thresholds.smvm ? moneyIn(ov.thresholds.smvm, "ARS") : "Falta"}</strong><small>Se carga en Configuración</small></div>
            <div className="hb-kpi"><span>Umbral de locaciones (300 SMVM)</span><strong>{ov.thresholds.t300 ? moneyIn(ov.thresholds.t300, "ARS") : "—"}</strong><small>Suma anual por cliente</small></div>
            <div className={`hb-kpi ${ov.counts.unreported ? "is-warn" : ""}`}><span>Alcanzadas sin marcar como presentadas</span><strong>{ov.counts.unreported}</strong><small>{ov.counts.reportable_year} alcanzadas este año</small></div>
            <div className={`hb-kpi ${ov.counts.reviews_overdue + ov.counts.without_profile ? "is-warn" : ""}`}><span>Legajos para revisar</span><strong>{ov.counts.reviews_overdue + ov.counts.without_profile}</strong><small>{ov.counts.profiles} legajos en total</small></div>
          </div>
          <div className="hb-grid-2" style={{ marginTop: 16 }}>
            <div className="hb-card">
              <h2>Próximas fechas</h2>
              {ov.next_dates.length === 0 ? <p className="hb-muted">No hay fechas en los próximos 120 días.</p> : ov.next_dates.map(dateRow)}
              <p className="hb-hint">Las fechas son recordatorios según la Resolución UIF 43/2024. Confirmalas con tu contador.</p>
            </div>
            <div className="hb-card">
              <h2>Clientes habituales</h2>
              <p className="hb-muted" style={{ margin: "0 0 8px" }}>Más de una operación en 12 meses por 700 SMVM o más{ov.thresholds.t700 ? ` (${moneyIn(ov.thresholds.t700, "ARS")})` : ""}.</p>
              {ov.habitual.length === 0 ? <p className="hb-muted">Ningún cliente llega a ese nivel{ov.thresholds.smvm ? "" : " (falta cargar el SMVM)"}.</p> : (
                <div className="hb-table-wrap"><table className="hb-table"><tbody>{ov.habitual.map((h) => <tr key={h.party_id}><td><strong>{h.party}</strong></td><td>{h.operations} operaciones</td><td className="num">{moneyIn(h.total_ars, "ARS")}</td></tr>)}</tbody></table></div>)}
            </div>
          </div>
          {ov.unreported.length > 0 && (
            <div className="hb-card" style={{ marginTop: 16 }}>
              <h2>Operaciones alcanzadas pendientes</h2>
              <div className="hb-table-wrap"><table className="hb-table"><tbody>{ov.unreported.map((o) => (
                <tr key={o.id}><td><strong>{o.party}</strong><small>{o.kind_label}{o.contract_number ? ` · contrato N.º ${o.contract_number}` : ""}</small></td><td>{shortDate(o.operation_date)}</td><td className="num">{moneyIn(o.annual_amount_ars, "ARS")}</td></tr>))}</tbody></table></div>
              <p className="hb-hint">Cuando las presentes en el portal de la UIF, cargá la fecha en cada operación.</p>
            </div>)}
          <div className="hb-card" style={{ marginTop: 16 }}>
            <h2>Señales de alerta de ejemplo</h2>
            <p className="hb-muted" style={{ margin: "0 0 8px" }}>Es una lista para tener presente. Habita no marca nada como sospechoso: lo decidís vos.</p>
            <ul style={{ margin: 0, paddingLeft: 18, color: "var(--hb-ink)", fontSize: 13.5, display: "grid", gap: 4 }}>{ov.signals.map((s) => <li key={s}>{s}</li>)}</ul>
          </div>
        </>))}

      {tab === "legajos" && (
        <>
          <div className="g1-filters"><input type="search" placeholder="Buscar por nombre o documento" aria-label="Buscar legajos" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          {!profiles ? <Loading /> : profiles.length === 0 ? <Empty title="Todavía no hay legajos">{write ? "Armá el legajo de cada cliente: riesgo, controles RePET y PEP, origen de fondos." : ""}</Empty> : (
            <div className="hb-table-wrap"><table className="hb-table">
              <thead><tr><th>Cliente</th><th>Riesgo</th><th>Controles</th><th>Revisión</th><th /></tr></thead>
              <tbody>{profiles.map((p) => (
                <tr key={p.id}>
                  <td><strong>{p.party}</strong><small>{p.doc || ""}</small></td>
                  <td><Pill tone={RISK[p.risk][1]}>{RISK[p.risk][0]}</Pill>{p.is_pep && <small className="g1-warn">PEP</small>}</td>
                  <td>RePET: {p.repet_checked_on ? shortDate(p.repet_checked_on) : "sin controlar"}<small>PEP: {p.pep_checked_on ? shortDate(p.pep_checked_on) : "sin controlar"}</small></td>
                  <td>{p.next_review_on ? shortDate(p.next_review_on) : "—"}{p.review_overdue && <small className="g1-late">Revisión vencida</small>}{p.last_review_on && <small>Última: {shortDate(p.last_review_on)}</small>}</td>
                  <td><div className="g1-actions end">{write && <button className="g1-mini" onClick={() => setPm({ p })}>Abrir</button>}{write && p.can_delete && <button className="g1-mini is-danger" onClick={() => setDel({ type: "p", id: p.id })}>Borrar</button>}</div></td>
                </tr>))}</tbody></table></div>)}
          <p className="hb-hint" style={{ marginTop: 10 }}>Los legajos se conservan {ov?.retention_years ?? 10} años: no se pueden borrar antes.</p>
        </>)}

      {tab === "operaciones" && (
        <>
          <div className="g1-filters">
            <div className="hb-seg">{([["", "Todas"], ["LOCACION", "Locaciones"], ["COMPRAVENTA", "Compraventas"]] as [string, string][]).map(([k, l]) => <button key={k} className={kind === k ? "is-on" : ""} onClick={() => setKind(k)}>{l}</button>)}</div>
            <div className="hb-seg"><button className={!onlyReportable ? "is-on" : ""} onClick={() => setOnlyReportable(false)}>Todas</button><button className={onlyReportable ? "is-on" : ""} onClick={() => setOnlyReportable(true)}>Solo alcanzadas</button></div>
          </div>
          {!ops ? <Loading /> : ops.length === 0 ? <Empty title="No hay operaciones registradas">{write ? "Registrá las compraventas y las locaciones de tus clientes para ver cuáles llegan al umbral." : ""}</Empty> : (
            <div className="hb-table-wrap"><table className="hb-table">
              <thead><tr><th>Fecha</th><th>Cliente</th><th className="num">Monto anual</th><th>Alcanzada</th><th>Presentada</th><th /></tr></thead>
              <tbody>{ops.map((o) => (
                <tr key={o.id}>
                  <td>{shortDate(o.operation_date)}<small>{o.kind_label}{o.contract_number ? ` · contrato N.º ${o.contract_number}` : ""}</small></td>
                  <td><strong>{o.party}</strong>{o.unusual && <small className="g1-warn">Anotada como inusual</small>}{o.cash_involved && <small>Con efectivo</small>}</td>
                  <td className="num">{moneyIn(o.annual_amount_ars, "ARS")}</td>
                  <td>{o.reportable ? <Pill tone="orange">Alcanzada</Pill> : <Pill tone="gray">Bajo el umbral</Pill>}</td>
                  <td>{o.reported_on ? shortDate(o.reported_on) : o.reportable ? <span className="g1-warn">Sin marcar</span> : "—"}</td>
                  <td><div className="g1-actions end">{write && <button className="g1-mini" onClick={() => setOm({ o })}>Abrir</button>}{write && o.can_delete && <button className="g1-mini is-danger" onClick={() => setDel({ type: "o", id: o.id })}>Borrar</button>}</div></td>
                </tr>))}</tbody></table></div>)}
          <p className="hb-hint" style={{ marginTop: 10 }}>«Alcanzada» significa que el total anual del cliente llega a 300 veces el SMVM que cargaste (las compraventas siempre). No es una conclusión legal: confirmala con tu contador.</p>
        </>)}

      {tab === "fechas" && (!dates ? <Loading /> : (
        <div className="g1-cal">{dates.map(dateRow)}<p className="hb-hint">Reporte mensual: del 1 al 15 de cada mes. Reporte sistemático anual: del 2 de enero al 15 de marzo. Autoevaluación de riesgos: cada dos años, el 30 de abril. Habita solo te lo recuerda.</p></div>))}

      {tab === "exportar" && (
        <div className="hb-card">
          <h2>Exportar para el contador o el oficial de cumplimiento</h2>
          <p className="hb-muted">Archivos CSV que abre Excel. Cada exportación queda anotada en la auditoría.</p>
          <div className="g1-actions"><button className="secondary-button" onClick={() => download("operations")}>Operaciones (CSV)</button><button className="secondary-button" onClick={() => download("profiles")}>Legajos (CSV)</button></div>
        </div>)}

      {pm && <ProfileModal p={pm.p} onClose={() => setPm(null)} onDone={reload} flash={flash} />}
      {om && <OperationModal o={om.o} onClose={() => setOm(null)} onDone={reload} flash={flash} />}
      {del && (
        <Modal title="¿Borrar este registro?" eyebrow="UIF" onClose={() => setDel(null)} footer={<><button className="secondary-button" onClick={() => setDel(null)}>No, volver</button><button className="primary-button" onClick={remove}>Sí, borrar</button></>}>
          <p className="hb-muted">Ya pasaron los {ov?.retention_years ?? 10} años de conservación. Queda anotado en la auditoría.</p>
        </Modal>)}
    </section>
  );
}

export default UifPage;
