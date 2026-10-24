// Pantalla «Reportes» (módulo reportes, grupo G2): cobranza, mora, vencimientos, rentabilidad, vacancia y embudo. Exporta a CSV.
// Backend: backend/routes/reportes.py
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { appApi, currentPeriod, downloadFile, moneyIn, periodLabel, shiftPeriod, shortDate } from "../../../config";
import { Empty, Field, Loading, PageHeader, Pill, useFlash } from "../../../components/ui";
import "../../../g2.css";

interface Cat { key: string; label: string; desc: string; available: boolean; needs: string | null }
interface Col { key: string; label: string; kind: string }
interface Report { title: string; columns: Col[]; rows: Record<string, any>[]; totals: Record<string, any>; groups?: any[]; notes?: string }

const iso = (d: Date) => d.toISOString().slice(0, 10);
const TOTAL_LABEL: Record<string, string> = { due: "Esperado", paid: "Cobrado", balance: "Pendiente", previous: "Meses anteriores", pct: "% cobrado", b0: "0 a 30 días", b1: "31 a 60", b2: "61 a 90", b3: "Más de 90", total: "Total", admin: "Administración", start: "Inicio", count: "Cantidad" };

function cell(c: Col, row: Record<string, any>): string {
  const v = row[c.key];
  if (v === null || v === undefined || v === "") return "—";
  if (c.kind === "money") return moneyIn(Number(v), String(row.currency || "ARS"));
  if (c.kind === "pct") return `${v}%`;
  if (c.kind === "date") return shortDate(String(v));
  return String(v);
}

function ReportesPage() {
  const { fail, node } = useFlash();
  const [cats, setCats] = useState<Cat[] | null>(null);
  const [key, setKey] = useState("");
  const now = new Date();
  const [period, setPeriod] = useState(currentPeriod());
  const [asOf, setAsOf] = useState(iso(now));
  const [from, setFrom] = useState(iso(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [to, setTo] = useState(iso(now));
  const [days, setDays] = useState("120");
  const [data, setData] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { appApi<{ items: Cat[] }>("/reports").then((r) => { setCats(r.items); const first = r.items.find((x) => x.available); if (first) setKey(first.key); }).catch(fail); }, [fail]);

  const query = useCallback((fmt?: string) => {
    const q = new URLSearchParams();
    if (key === "collection") q.set("period", period);
    if (key === "arrears") q.set("as_of", asOf);
    if (key === "profitability" || key === "funnel") { q.set("from", from); q.set("to", to); }
    if (key === "expirations") q.set("days", days || "120");
    if (fmt) q.set("format", fmt);
    const s = q.toString();
    return `/reports/${key}${s ? "?" + s : ""}`;
  }, [key, period, asOf, from, to, days]);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    setLoading(true); setData(null);
    appApi<Report>(query()).then((r) => { if (!cancelled) setData(r); }).catch((e) => { if (!cancelled) fail(e); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [key, query, fail]);

  async function csv() { try { await downloadFile(query("csv"), `${key}.csv`); } catch (e) { fail(e); } }

  const totals = data ? Object.entries(data.totals || {}) : [];
  const hasWa = !!data?.rows.some((r) => r.wa_url);
  const hasPath = !!data?.rows.some((r) => r.path);
  return (
    <section className="products-page">
      <PageHeader eyebrow="REPORTES" title="Reportes" subtitle="Cobranza, mora, vencimientos y rentabilidad, listos para mirar o bajar a una planilla." />
      {node}
      {!cats ? <Loading /> : cats.length === 0 ? <Empty title="Tu rol no tiene reportes">Pedile al titular que te habilite los que necesites.</Empty> : (
        <>
          <div className="g2-report-cards">
            {cats.map((c) => (
              <button key={c.key} className={`g2-report-card ${key === c.key ? "is-on" : ""}`} disabled={!c.available} aria-pressed={key === c.key} onClick={() => setKey(c.key)}>
                <strong>{c.label}</strong><span>{c.desc}</span>
                {!c.available && <span>Necesita el módulo {c.needs}.</span>}
              </button>
            ))}
          </div>
          {key && (
            <div className="g2-filters">
              {key === "collection" && <div className="g2-period"><button aria-label="Mes anterior" onClick={() => setPeriod(shiftPeriod(period, -1))}>‹</button><strong>{periodLabel(period)}</strong><button aria-label="Mes siguiente" onClick={() => setPeriod(shiftPeriod(period, 1))}>›</button></div>}
              {key === "arrears" && <Field label="Deuda al día"><input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} /></Field>}
              {(key === "profitability" || key === "funnel") && <>
                <Field label="Desde"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
                <Field label="Hasta"><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field></>}
              {key === "expirations" && <Field label="Próximos (días)"><input type="number" min={1} max={730} value={days} onChange={(e) => setDays(e.target.value)} /></Field>}
              <button className="secondary-button" onClick={csv} disabled={!data}>Bajar a planilla (CSV)</button>
            </div>
          )}
          {loading && <Loading />}
          {data && (
            <div className="hb-stack">
              <h2 style={{ margin: 0, fontSize: 18 }}>{data.title}</h2>
              {totals.length > 0 && (
                <div className="hb-kpis">
                  {totals.map(([k, v]) => typeof v === "object" && v !== null ? (
                    <div key={k} className="hb-kpi"><span>Totales en {k}</span>
                      <small>{Object.entries(v).map(([kk, vv]) => `${TOTAL_LABEL[kk] || kk}: ${kk === "pct" ? vv + "%" : moneyIn(Number(vv), k)}`).join(" · ")}</small></div>
                  ) : <div key={k} className="hb-kpi"><span>{TOTAL_LABEL[k] || k}</span><strong>{String(v)}</strong></div>)}
                </div>
              )}
              {data.rows.length === 0 ? <Empty title="No hay datos para este reporte">Probá con otro período.</Empty> : (
                <div className="hb-table-wrap">
                  <table className="hb-table">
                    <thead><tr>{data.columns.map((c) => <th key={c.key} className={c.kind === "money" || c.kind === "int" || c.kind === "pct" ? "num" : ""}>{c.label}</th>)}{hasWa && <th />}{hasPath && <th />}</tr></thead>
                    <tbody>
                      {data.rows.map((r, i) => (
                        <tr key={i}>
                          {data.columns.map((c) => <td key={c.key} className={c.kind === "money" || c.kind === "int" || c.kind === "pct" ? "num" : ""}>{cell(c, r)}</td>)}
                          {hasWa && <td className="num">{r.wa_url && <a className="g2-mini" href={r.wa_url} target="_blank" rel="noopener noreferrer" aria-label={`Avisar a ${r.tenant} por WhatsApp`}>WhatsApp</a>}</td>}
                          {hasPath && <td className="num">{r.path && <Link className="g2-mini" to={r.path}>Abrir</Link>}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {data.groups && data.groups.length > 0 && (
                <div className="hb-card"><div className="hb-card-head"><div><h2>Por propietario</h2></div></div>
                  <div className="hb-table-wrap"><table className="hb-table"><thead><tr><th>Propietario</th><th className="num">Esperado</th><th className="num">Cobrado</th><th className="num">Mora</th><th className="num">% cobrado</th></tr></thead>
                    <tbody>{data.groups.map((g, i) => <tr key={i}><td>{g.owner} <Pill tone="gray">{g.currency}</Pill></td><td className="num">{moneyIn(g.due, g.currency)}</td><td className="num">{moneyIn(g.paid, g.currency)}</td><td className="num">{moneyIn(g.late, g.currency)}</td><td className="num">{g.pct}%</td></tr>)}</tbody></table></div></div>
              )}
              {data.notes && <p className="hb-hint">{data.notes}</p>}
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default ReportesPage;
