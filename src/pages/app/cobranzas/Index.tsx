// Pantalla «Cobranza» (módulo cobranzas, grupo G2): planilla del mes, cuenta del contrato, cobro con recibo, avisos del portal.
// Backend: backend/routes/cobranzas.py
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { appApi, canAccess, currentPeriod, getSessionUser, isReadOnly, moneyIn, periodLabel, shiftPeriod, shortDate, dateTime } from "../../../config";
import { Empty, Loading, Modal, PageHeader, Pill, Tabs, Field, useFlash, useRefreshKey } from "../../../components/ui";
import { CuentaContrato } from "../../../components/cobranzas/Cuenta";
import { PortalLinkButton, PortalLinksList } from "../../../components/cobranzas/PortalLinks";
import "../../../g2.css";

interface Row {
  contract_id: number; number: number; address: string; currency: string; tenant: { id: number; full_name: string; wa_phone: string | null } | null;
  generated: boolean; due: number; paid: number; balance: number; previous: number; credit: number; total_balance: number; days_late: number;
  state: string; needs_amount: number; needs_fx: boolean; due_date: string | null; wa: { url: string | null; text: string } | null;
}
interface Sheet {
  period: string; rows: Row[]; ungenerated: number;
  totals: Record<string, { due: number; paid: number; balance: number; previous: number; pct: number }>;
  counts: Record<string, number>;
}
interface Notice { id: number; kind: string; text: string; created_at: string; handled_at: string | null; party_id: number; party_name: string; wa_phone: string | null; contract_id: number | null; contract_number: number | null; address: string }

type Tab = "mes" | "avisos" | "portal";
type Filter = "" | "PENDIENTES" | "VENCIDOS" | "PAGADOS" | "SIN_GENERAR";
const STATE_LABEL: Record<string, [string, string]> = {
  PAGADO: ["Pagado", "green"], PENDIENTE: ["Pendiente", "orange"], VENCIDO: ["Vencido", "red"], SIN_GENERAR: ["Sin generar", "gray"],
  AL_DIA: ["Al día", "green"], SIN_IMPORTE: ["Falta cargar importe", "orange"],
};
const NOTICE_KIND: Record<string, string> = { PAGUE: "Avisó que pagó", REPARACION: "Reparación", CONSULTA: "Consulta" };

function CobranzasPage() {
  const user = getSessionUser();
  const [params, setParams] = useSearchParams();
  const refreshKey = useRefreshKey();
  const { show, fail, node } = useFlash();
  const hasPortal = canAccess(user, "web_portal");
  const readOnly = isReadOnly(user);
  const [tab, setTab] = useState<Tab>((params.get("tab") as Tab) || "mes");
  const [period, setPeriod] = useState(currentPeriod());
  const [filter, setFilter] = useState<Filter>(params.get("filtro") === "vencidos" ? "VENCIDOS" : "");
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [account, setAccount] = useState<number | null>(null);
  const [genOpen, setGenOpen] = useState(params.get("generar") === "1");
  const [fx, setFx] = useState("");
  const [busy, setBusy] = useState(false);
  const [notices, setNotices] = useState<Notice[] | null>(null);

  const load = useCallback(() => { appApi<Sheet>(`/collections?period=${period}`).then(setSheet).catch(fail); }, [period, fail]);
  const loadNotices = useCallback(() => { appApi<Notice[]>("/tenant-notices?status=pending").then(setNotices).catch(fail); }, [fail]);
  useEffect(load, [load, refreshKey]);
  useEffect(loadNotices, [loadNotices, refreshKey]);
  useEffect(() => { if (params.get("generar") || params.get("filtro") || params.get("tab")) setParams({}, { replace: true }); }, []); // eslint-disable-line

  async function generate() {
    setBusy(true);
    try {
      const f = Number(fx.replace(",", "."));
      const r = await appApi<{ created: number; contracts: number; without_fx: number }>(`/collections/generate?period=${period}`, { method: "POST", body: fx.trim() && f > 0 ? { fx_rate: f } : {} });
      setGenOpen(false);
      show(r.created ? `Se generaron ${r.created} cargos en ${r.contracts} contratos` : "No faltaba generar nada: ya estaba todo" + (r.without_fx ? "" : ""));
      if (r.without_fx) show(`Hay ${r.without_fx} cargo(s) en dólares sin cotización: cargala desde la cuenta del contrato`, true);
      load();
    } catch (e) { fail(e); } finally { setBusy(false); }
  }
  async function handle(n: Notice, handled: boolean) {
    try { await appApi(`/tenant-notices/${n.id}`, { method: "PATCH", body: { handled } }); loadNotices(); } catch (e) { fail(e); }
  }

  const rows = (sheet?.rows || []).filter((r) => {
    if (!filter) return true;
    if (filter === "PENDIENTES") return r.state === "PENDIENTE";
    if (filter === "VENCIDOS") return r.state === "VENCIDO";
    if (filter === "PAGADOS") return r.state === "PAGADO" || r.state === "AL_DIA";
    return r.state === "SIN_GENERAR";
  });
  const hasUsd = (sheet?.rows || []).some((r) => r.currency === "USD");

  return (
    <section className="products-page">
      <PageHeader eyebrow="COBRANZA" title="Cobranza" subtitle="Cargos del mes, cobros con recibo numerado y avisos por WhatsApp.">
        {tab === "mes" && !readOnly && <button className="primary-button" onClick={() => setGenOpen(true)} data-tour="cobranza-generar">Generar cobranza del mes</button>}
      </PageHeader>
      {node}
      <Tabs<Tab> value={tab} onChange={setTab} options={[["mes", "Cobranza del mes"], ["avisos", `Avisos del portal${notices && notices.length ? ` (${notices.length})` : ""}`], ...(hasPortal ? [["portal", "Links del portal"] as [Tab, string]] : [])]} />

      {tab === "mes" && (
        <>
          <div className="g2-filters">
            <div className="g2-period"><button aria-label="Mes anterior" onClick={() => setPeriod(shiftPeriod(period, -1))}>‹</button><strong>{periodLabel(period)}</strong><button aria-label="Mes siguiente" onClick={() => setPeriod(shiftPeriod(period, 1))}>›</button></div>
            <div className="hb-seg">
              {([["", "Todos"], ["PENDIENTES", "Pendientes"], ["VENCIDOS", "Vencidos"], ["PAGADOS", "Pagados"]] as [Filter, string][]).map(([k, l]) => (
                <button key={k} className={filter === k ? "is-on" : ""} onClick={() => setFilter(k)}>{l}</button>))}
            </div>
          </div>
          {!sheet ? <Loading /> : (
            <>
              <div className="hb-kpis">
                {Object.entries(sheet.totals).length === 0 && <div className="hb-kpi"><span>Cobrado</span><strong>$ 0</strong><small>Todavía no hay cargos este mes</small></div>}
                {Object.entries(sheet.totals).map(([cur, t]) => (
                  <div key={cur} className="hb-kpi"><span>Cobrado ({cur})</span><strong>{moneyIn(t.paid, cur)}</strong><small>{t.pct}% de {moneyIn(t.due, cur)} esperado</small></div>))}
                {Object.entries(sheet.totals).map(([cur, t]) => t.previous > 0 && (
                  <div key={cur + "p"} className="hb-kpi is-alert"><span>Deuda de meses anteriores ({cur})</span><strong>{moneyIn(t.previous, cur)}</strong><small>{sheet.counts.VENCIDO || 0} contrato(s) vencidos</small></div>))}
                {sheet.ungenerated > 0 && <button className="hb-kpi is-warn" onClick={() => setGenOpen(true)}><span>Sin generar</span><strong>{sheet.ungenerated}</strong><small>Tocá para generar la cobranza</small></button>}
              </div>
              {rows.length === 0 ? <Empty title={sheet.rows.length ? "Ningún contrato con ese filtro" : "No hay contratos para cobrar"}>
                {sheet.rows.length ? "Probá con otro filtro." : "Cuando tengas contratos vigentes, generá la cobranza del mes y aparecen acá."}</Empty> : (
                <div className="hb-table-wrap">
                  <table className="hb-table">
                    <thead><tr><th>Contrato</th><th>Inquilino</th><th className="num">Debe</th><th className="num">Pagó</th><th className="num">Saldo</th><th>Estado</th><th /></tr></thead>
                    <tbody>
                      {rows.map((r) => {
                        const [label, tone] = STATE_LABEL[r.state] || [r.state, "gray"];
                        return (
                          <tr key={r.contract_id} className="is-click" onClick={() => setAccount(r.contract_id)}>
                            <td><strong>N.º {r.number}</strong><small>{r.address}</small></td>
                            <td>{r.tenant?.full_name || "—"}</td>
                            <td className="num">{r.generated ? moneyIn(r.due, r.currency) : "—"}{r.due_date && <small>vence {shortDate(r.due_date)}</small>}</td>
                            <td className="num">{moneyIn(r.paid, r.currency)}</td>
                            <td className="num">{moneyIn(r.total_balance, r.currency)}{r.previous > 0 && <small className="g2-late">incluye {moneyIn(r.previous, r.currency)} anterior</small>}{r.credit > 0 && <small className="g2-ok">{moneyIn(r.credit, r.currency)} a favor</small>}</td>
                            <td><Pill tone={tone}>{label}</Pill>{r.days_late > 0 && <small className="g2-late">{r.days_late} días de mora</small>}{r.needs_fx && <small>Falta cotización</small>}</td>
                            <td className="num" onClick={(e) => e.stopPropagation()}><div className="g2-actions">
                              <button className="g2-mini" onClick={() => setAccount(r.contract_id)}>Ver cuenta</button>
                              {r.wa?.url && <a className="g2-mini" href={r.wa.url} target="_blank" rel="noopener noreferrer" aria-label={`Avisar a ${r.tenant?.full_name} por WhatsApp`}>WhatsApp</a>}
                            </div></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="hb-hint">Los recibos son internos: no son facturas. Cada WhatsApp se abre con el mensaje armado y lo mandás vos.</p>
            </>
          )}
        </>
      )}

      {tab === "avisos" && (!notices ? <Loading /> : notices.length === 0 ? <Empty title="No hay avisos sin atender">Cuando un inquilino avise un pago o una reparación desde su portal, aparece acá.</Empty> : (
        <div className="hb-stack">
          {notices.map((n) => (
            <div key={n.id} className="hb-card">
              <div className="hb-card-head"><div><h2>{NOTICE_KIND[n.kind] || n.kind} · {n.party_name}</h2><p>{n.contract_number ? `Contrato N.º ${n.contract_number} · ${n.address} · ` : ""}{dateTime(n.created_at)}</p></div></div>
              <p style={{ margin: "0 0 10px", color: "var(--hb-ink)" }}>{n.text}</p>
              <div className="g2-actions" style={{ justifyContent: "flex-start" }}>
                {n.contract_id && <button className="g2-mini" onClick={() => setAccount(n.contract_id)}>Ver cuenta</button>}
                {n.kind === "REPARACION" && canAccess(user, "mantenimiento") && <span className="hb-hint">Pasalo a reclamo desde Reparaciones.</span>}
                {!readOnly && <button className="g2-mini is-primary" onClick={() => handle(n, true)}>Marcar como atendido</button>}
              </div>
            </div>
          ))}
        </div>
      ))}

      {tab === "portal" && hasPortal && <PortalLinksList />}

      {account !== null && (
        <Modal title="Cuenta del contrato" eyebrow="COBRANZA" size="xl" onClose={() => setAccount(null)}>
          <CuentaContrato contractId={account} onChanged={() => { load(); loadNotices(); }} />
          {hasPortal && sheet && (() => { const t = sheet.rows.find((r) => r.contract_id === account)?.tenant; return t ? <div style={{ marginTop: 12 }}><PortalLinkButton partyId={t.id} kind="INQUILINO" name={t.full_name} label="Link del portal del inquilino" /></div> : null; })()}
        </Modal>
      )}

      {genOpen && (
        <Modal title={`Generar cobranza de ${periodLabel(period)}`} eyebrow="COBRANZA" onClose={() => setGenOpen(false)} footer={<>
          <button className="secondary-button" onClick={() => setGenOpen(false)}>Cancelar</button>
          <button className="primary-button" disabled={busy} onClick={generate}>Generar</button></>}>
          <p className="hb-muted">Crea el alquiler y los conceptos fijos del mes para cada contrato. Si ya estaban generados no se repiten, así que podés correrlo las veces que quieras.</p>
          {hasUsd && <Field label="Cotización del dólar (opcional)" hint="Para los contratos en USD. La cargás vos; si la dejás vacía la completás después en cada cuenta."><input inputMode="decimal" value={fx} onChange={(e) => setFx(e.target.value)} placeholder="Por ejemplo 1250" /></Field>}
        </Modal>
      )}
    </section>
  );
}

export default CobranzasPage;
