// Pantalla «Contratos» (módulo contratos, grupo G1): lista con semáforo, asistente «Nuevo contrato», «Ajustes del mes» y la ficha de cada contrato.
// Backend: backend/routes/contratos.py. La ficha vive dentro de esta pantalla (?id=); los Pendientes del Inicio llegan con ?tab=ajustes, ?estado= o ?filtro=.
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { appApi, currentPeriod, getSessionUser, moneyIn, periodLabel, shiftPeriod, shortDate } from "../../../config";
import { Empty, Loading, PageHeader, Pill, Tabs, useFlash, useRefreshKey } from "../../../components/ui";
import { CONTRACT_STATUS, TRAFFIC } from "../../../components/g1/common";
import { AjusteCard } from "../../../components/contratos/Ajustes";
import type { Adj } from "../../../components/contratos/Ajustes";
import { FichaContrato } from "../../../components/contratos/FichaContrato";
import { NuevoContrato } from "../../../components/contratos/NuevoContrato";
import "../../../g1.css";

interface Row {
  id: number; number: number; status: string; property: { id: number; code: string; address: string }; owner_name: string | null; tenant: { id: number; name: string; extra: number } | null;
  start_date: string; end_date: string; days_left: number | null; currency: string; current_rent: number; next_adjustment_date: string | null; adjustment_text: string; adjustment_status: string | null;
  traffic: string; traffic_reasons: string[]; guarantee: string | null; has_renewal: boolean; stamp_unpaid: boolean; arca_missing: boolean;
}
type Tab = "contratos" | "ajustes";
const FILTERS: [string, string][] = [["ACTIVOS", "Activos"], ["POR_VENCER", "Por vencer"], ["VENCIDO", "Vencidos"], ["BORRADOR", "Borradores"], ["TERMINADOS", "Terminados"], ["", "Todos"]];

function ContratosPage() {
  const user = getSessionUser();
  const [params, setParams] = useSearchParams();
  const refreshKey = useRefreshKey();
  const flash = useFlash();
  const manage = ["ADMINISTRADOR", "ENCARGADO"].includes(user?.role || "");
  const openId = Number(params.get("id")) || null;
  const [tab, setTab] = useState<Tab>(params.get("tab") === "ajustes" ? "ajustes" : "contratos");
  const [filter, setFilter] = useState(params.get("estado") || "ACTIVOS");
  const [special, setSpecial] = useState(params.get("filtro") || "");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<{ items: Row[]; counts: Record<string, number> } | null>(null);
  const [wizard, setWizard] = useState<{ property: number | null } | null>(params.get("nuevo") ? { property: Number(params.get("propiedad")) || null } : null);
  const [month, setMonth] = useState(currentPeriod());
  const [adj, setAdj] = useState<{ items: Adj[]; counts: Record<string, number> } | null>(null);
  const [adjFilter, setAdjFilter] = useState("");

  const load = useCallback(() => {
    const qs = new URLSearchParams();
    if (filter === "ACTIVOS" || filter === "POR_VENCER" || filter === "VENCIDO" || filter === "BORRADOR") qs.set("status", filter);
    if (q.trim()) qs.set("q", q.trim());
    appApi<{ items: Row[]; counts: Record<string, number> }>(`/contracts?${qs}`).then(setRows).catch(flash.fail);
  }, [filter, q, flash.fail]);
  const loadAdj = useCallback(() => { appApi<{ items: Adj[]; counts: Record<string, number> }>(`/adjustments?month=${month}`).then(setAdj).catch(flash.fail); }, [month, flash.fail]);
  useEffect(() => { const t = window.setTimeout(load, 200); return () => window.clearTimeout(t); }, [load, refreshKey]);
  useEffect(() => { if (tab === "ajustes") loadAdj(); }, [tab, loadAdj, refreshKey]);
  useEffect(() => { if (params.get("nuevo") || params.get("estado") || params.get("filtro") || params.get("tab")) { const n = new URLSearchParams(); if (params.get("id")) n.set("id", params.get("id")!); setParams(n, { replace: true }); } }, []); // eslint-disable-line

  function open(id: number | null) { setParams(id ? { id: String(id) } : {}); }

  if (openId) {
    return (
      <section className="products-page">
        {flash.node}
        <FichaContrato id={openId} flash={flash} onBack={() => open(null)} onChanged={() => { load(); if (tab === "ajustes") loadAdj(); }} onOpen={open} />
      </section>);
  }

  let list = rows?.items || [];
  if (filter === "TERMINADOS") list = list.filter((r) => ["RESCINDIDO", "FINALIZADO"].includes(r.status));
  if (special === "sellado") list = list.filter((r) => r.stamp_unpaid);
  if (special === "arca") list = list.filter((r) => r.arca_missing);
  const counts = rows?.counts || {};
  const shownAdj = (adj?.items || []).filter((a) => !adjFilter || a.status === adjFilter);

  return (
    <section className="products-page">
      <PageHeader eyebrow="CONTRATOS" title="Contratos y ajustes" subtitle="Plazos, alquiler actual, ajustes por confirmar y vencimientos de cada contrato.">
        {manage && <button className="primary-button" onClick={() => setWizard({ property: null })} data-tour="contrato-nuevo">Nuevo contrato</button>}
      </PageHeader>
      {flash.node}
      <Tabs<Tab> value={tab} onChange={setTab} options={[["contratos", "Contratos"], ["ajustes", "Ajustes del mes"]]} />

      {tab === "contratos" && (
        <>
          <div className="g1-filters">
            <input type="search" placeholder="Buscar por dirección, inquilino, propietario o número" aria-label="Buscar contratos" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="hb-seg">
              {FILTERS.map(([k, l]) => <button key={k} className={filter === k && !special ? "is-on" : ""} onClick={() => { setFilter(k); setSpecial(""); }}>{l}{k === "BORRADOR" && counts.BORRADOR ? ` (${counts.BORRADOR})` : ""}</button>)}
            </div>
          </div>
          {special && <div className="hb-row" style={{ marginBottom: 10 }}><Pill tone="orange">{special === "sellado" ? "Sellado sin pagar" : "Sin registrar en ARCA"}</Pill><button className="g1-mini" onClick={() => setSpecial("")}>Quitar filtro</button></div>}
          {!rows ? <Loading /> : list.length === 0 ? (
            <Empty title={Object.values(counts).reduce((a, b) => a + b, 0) ? "Ningún contrato con ese filtro" : "Todavía no hay contratos"}>
              {manage ? "Armá el primero con «Nuevo contrato»." : "Cuando se carguen, aparecen acá."}</Empty>
          ) : (
            <div className="hb-table-wrap" data-tour="contratos-tabla">
              <table className="hb-table">
                <thead><tr><th>Contrato</th><th>Inquilino</th><th>Plazo</th><th className="num">Alquiler</th><th>Próximo ajuste</th><th>Estado</th></tr></thead>
                <tbody>
                  {list.map((r) => {
                    const [stLabel, stTone] = CONTRACT_STATUS[r.status] || [r.status, "gray"];
                    const [trLabel, trTone] = TRAFFIC[r.traffic] || ["", "gray"];
                    return (
                      <tr key={r.id} className="is-click" onClick={() => open(r.id)}>
                        <td><strong>N.º {r.number}</strong><small>{r.property.address}</small>{r.owner_name && <small>Prop.: {r.owner_name}</small>}</td>
                        <td>{r.tenant ? r.tenant.name : "—"}{r.tenant && r.tenant.extra > 0 && <small>y {r.tenant.extra} más</small>}</td>
                        <td>{shortDate(r.start_date)} al {shortDate(r.end_date)}{r.days_left !== null && <small className={r.days_left < 0 ? "g1-late" : r.days_left <= 60 ? "g1-warn" : ""}>{r.days_left >= 0 ? `faltan ${r.days_left} días` : `venció hace ${-r.days_left} días`}</small>}</td>
                        <td className="num">{moneyIn(r.current_rent, r.currency)}</td>
                        <td>{r.next_adjustment_date ? shortDate(r.next_adjustment_date) : "—"}<small>{r.adjustment_text}</small>{r.adjustment_status === "PROPUESTO" && <small className="g1-warn">Ajuste para confirmar</small>}{r.adjustment_status === "ESPERANDO_INDICE" && <small className="g1-warn">Esperando el índice</small>}</td>
                        <td><Pill tone={stTone}>{stLabel}</Pill>{["VIGENTE", "POR_VENCER", "VENCIDO"].includes(r.status) && <small><span className={`g1-dot ${trTone}`} />{trLabel}{r.traffic_reasons[0] ? ` · ${r.traffic_reasons[0]}` : ""}</small>}
                          {r.has_renewal && <small>Con renovación</small>}</td>
                      </tr>);
                  })}
                </tbody>
              </table>
            </div>)}
        </>)}

      {tab === "ajustes" && (
        <>
          <div className="g1-filters">
            <div className="g2-period" style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: 3, border: "1px solid var(--hb-line)", borderRadius: 12, background: "var(--hb-surface)" }}>
              <button className="g1-mini" aria-label="Mes anterior" onClick={() => setMonth(shiftPeriod(month, -1))}>‹</button>
              <strong style={{ minWidth: 130, textAlign: "center", color: "var(--hb-ink)" }}>{periodLabel(month)}</strong>
              <button className="g1-mini" aria-label="Mes siguiente" onClick={() => setMonth(shiftPeriod(month, 1))}>›</button>
            </div>
            <div className="hb-seg">
              {([["", "Todos"], ["PROPUESTO", "Por confirmar"], ["ESPERANDO_INDICE", "Esperando índice"], ["PREVISTO", "Previstos"], ["APLICADO", "Aplicados"], ["DESCARTADO", "Descartados"]] as [string, string][]).map(([k, l]) => (
                <button key={k} className={adjFilter === k ? "is-on" : ""} onClick={() => setAdjFilter(k)}>{l}{k && adj?.counts[k] ? ` (${adj.counts[k]})` : ""}</button>))}
            </div>
          </div>
          {!adj ? <Loading /> : shownAdj.length === 0 ? <Empty title="No hay ajustes con ese filtro">{adjFilter ? "Probá con «Todos»." : "Ningún contrato ajusta este mes."}</Empty> : (
            <div className="hb-stack">{shownAdj.map((a) => <AjusteCard key={`${a.id ?? "p"}-${a.contract.id}-${a.due_date}`} adj={a} canEdit={manage} flash={flash} onChanged={() => { loadAdj(); load(); }} />)}</div>)}
          <p className="hb-hint" style={{ marginTop: 12 }}>Un ajuste nunca se aplica solo: lo confirmás vos. Al confirmarlo cambia el alquiler, avanza la fecha y, si ya cobraste meses con el valor viejo, se generan cargos por la diferencia. El aviso al inquilino se abre por WhatsApp y lo enviás vos.</p>
        </>)}

      {wizard && <NuevoContrato initialProperty={wizard.property} onClose={() => setWizard(null)} onDone={(id, activated) => { setWizard(null); flash.show(activated ? "Contrato creado y activado" : "Contrato guardado como borrador"); load(); open(id); }} />}
    </section>
  );
}

export default ContratosPage;
