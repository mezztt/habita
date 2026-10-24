// Web pública «Portal» del inquilino o propietario (módulo web_portal, grupo G2). Acceso por link personal con token, sin cuenta.
// Backend: backend/routes/web_portal.py (prefijo /public/portal/{token}/...). Solo muestra los datos de esa persona.
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { moneyIn, publicApi, shortDate, dateTime } from "../../config";
import { Consent, Shell } from "../../components/public/Shell";
import type { Agency } from "../../components/public/Shell";
import { printReceipt, printSettlement, periodName } from "../print/printG2";
import "../../g2.css";

interface Bal { debt: number; overdue: number; credit: number; net: number }
interface TCharge { id: number; period: string | null; concept_label: string; description: string; amount: number; currency: string; due_date: string; balance: number; days_late: number }
interface TReceipt { id: number; number_text: string; issued_on: string; total: number; currency: string; method_label?: string }
interface TContract { id: number; number: number; address: string; currency: string; rent: number; end_date: string; next_adjustment_date: string | null; balances: Record<string, Bal>; charges: TCharge[]; receipts: TReceipt[] }
interface NoticeRow { id: number; kind: string; text: string; created_at: string; handled: boolean }
interface OProp { id: number; code: string; address: string; status: string; share_pct: number; contract: { number: number; end_date: string; currency: string; rent: number } | null }
interface OSet { id: number; period: string; currency: string; status: string; gross_collected: number; commission_total: number; commission_iva: number; deductions_total: number; net_amount: number; paid_on: string | null }
interface ORepair { id: number; title: string; description: string; property: string; status_label: string; quote_amount: number | null; currency: string; can_decide: boolean; owner_approval: string; decided_at: string | null }
interface Data {
  kind: "INQUILINO" | "PROPIETARIO"; person: { full_name: string }; agency: Agency; expires_at: string; payment_alias: string | null; repairs_enabled: boolean;
  contracts?: TContract[]; notices?: NoticeRow[]; properties?: OProp[]; settlements?: OSet[]; repairs?: ORepair[];
}

const NOTICE_LABEL: Record<string, string> = { PAGUE: "Aviso de pago", REPARACION: "Reparación", CONSULTA: "Consulta" };

function Portal() {
  const { token = "" } = useParams();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(() => {
    publicApi<Data>(`/public/portal/${encodeURIComponent(token)}`).then(setData).catch((e) => setError(e instanceof Error ? e.message : "No pudimos abrir tu portal"));
  }, [token]);
  useEffect(load, [load]);

  const heading = data ? `Hola, ${data.person.full_name.split(/[\s,]+/)[0]}` : "Tu portal";
  const intro = data ? (data.kind === "INQUILINO" ? "Acá ves lo que tenés para pagar, tus recibos y podés avisar si hay algo para reparar." : "Acá ves tus propiedades, tus liquidaciones y las reparaciones que esperan tu respuesta.") : "Consultá tus datos con tu link personal.";
  const expired = error.length > 0;
  return (
    <Shell title="Portal" agency={data?.agency || null} heading={heading} intro={intro} source="portal"
      error={expired ? `${error}. Si el link venció o lo revocaron, pedile a la inmobiliaria uno nuevo.` : undefined}>
      {!data && !expired && <div className="pb-card"><p className="r3-pub-legal">Cargando tu información...</p></div>}
      {msg && <div className="pb-msg" role="status">{msg}</div>}
      {data?.kind === "INQUILINO" && <Tenant token={token} data={data} onSent={(m) => { setMsg(m); load(); }} />}
      {data?.kind === "PROPIETARIO" && <Owner token={token} data={data} onDone={(m) => { setMsg(m); load(); }} />}
      {data && <p className="r3-pub-legal" style={{ textAlign: "center" }}>Este link es personal: no lo compartas. Vence el {shortDate(data.expires_at)}. Los comprobantes no son facturas.</p>}
    </Shell>
  );
}

function Tenant({ token, data, onSent }: { token: string; data: Data; onSent: (m: string) => void }) {
  const contracts = data.contracts || [];
  const [kind, setKind] = useState("PAGUE");
  const [contractId, setContractId] = useState<number | "">(contracts[0]?.id ?? "");
  const [text, setText] = useState("");
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function send() {
    setErr("");
    if (text.trim().length < 3) { setErr("Contanos un poco más"); return; }
    if (!ok) { setErr("Tenés que aceptar para poder avisar"); return; }
    setBusy(true);
    try {
      const r = await publicApi<{ detail: string }>(`/public/portal/${encodeURIComponent(token)}/notice`, { method: "POST", body: { kind, contract_id: contractId || null, text: text.trim() } });
      setText(""); setOk(false); onSent(r.detail);
    } catch (e) { setErr(e instanceof Error ? e.message : "No pudimos enviar el aviso"); } finally { setBusy(false); }
  }
  async function receipt(id: number) {
    try { printReceipt(await publicApi(`/public/portal/${encodeURIComponent(token)}/receipts/${id}/pdf`)); } catch (e) { setErr(e instanceof Error ? e.message : "No pudimos abrir el recibo"); }
  }
  return (
    <>
      {contracts.length === 0 && <div className="pb-card"><p className="r3-pub-legal">No tenés contratos vigentes asociados a este link.</p></div>}
      {contracts.map((c) => (
        <div key={c.id} className="pb-card">
          <span className="pb-step-label">Contrato N.º {c.number}</span>
          <h2>{c.address}</h2>
          <p>Alquiler {moneyIn(c.rent, c.currency)} · vence el {shortDate(c.end_date)}{c.next_adjustment_date ? ` · próximo ajuste ${shortDate(c.next_adjustment_date)}` : ""}</p>
          <div className="g2-portal-kpis">
            {Object.entries(c.balances).length === 0 && <div className="g2-portal-kpi"><span>Saldo</span><strong>{moneyIn(0, c.currency)}</strong></div>}
            {Object.entries(c.balances).map(([cur, b]) => (
              <div key={cur} className={`g2-portal-kpi ${b.overdue > 0 ? "is-late" : ""}`}>
                <span>{b.overdue > 0 ? "Vencido" : b.net > 0 ? "A pagar" : "Estás al día"} ({cur})</span>
                <strong>{moneyIn(b.net > 0 ? b.net : 0, cur)}</strong>
              </div>))}
          </div>
          {c.charges.length > 0 && (
            <div className="g2-portal-scroll"><table className="g2-portal-table">
              <thead><tr><th>Concepto</th><th>Vence</th><th className="num">Saldo</th></tr></thead>
              <tbody>{c.charges.map((x) => (
                <tr key={x.id}><td>{x.concept_label}{x.period ? ` ${periodName(x.period)}` : ""}{x.days_late > 0 && <small style={{ display: "block", color: "#8a2622", fontWeight: 700 }}>{x.days_late} días de atraso</small>}</td>
                  <td>{shortDate(x.due_date)}</td><td className="num">{moneyIn(x.balance, x.currency)}</td></tr>))}</tbody>
            </table></div>)}
          {data.payment_alias && c.charges.length > 0 && <p className="r3-pub-legal">Podés pagar por transferencia al alias <strong>{data.payment_alias}</strong> y avisarnos abajo.</p>}
          <h2 style={{ marginTop: 18 }}>Tus recibos</h2>
          {c.receipts.length === 0 ? <p className="r3-pub-legal">Todavía no hay recibos.</p> : (
            <div className="g2-portal-scroll"><table className="g2-portal-table"><tbody>{c.receipts.map((r) => (
              <tr key={r.id}><td>{r.number_text}<small style={{ display: "block", color: "#465858" }}>{shortDate(r.issued_on)}</small></td><td className="num">{moneyIn(r.total, r.currency)}</td>
                <td className="num"><button className="pb-btn pb-btn-ghost g2-portal-small" onClick={() => receipt(r.id)}>Imprimir</button></td></tr>))}</tbody></table></div>)}
        </div>
      ))}

      <div className="pb-card">
        <span className="pb-step-label">Avisos</span>
        <h2>Avisanos algo</h2>
        <p>Es un mensaje a la inmobiliaria: no cambia tu saldo. Lo revisan ellos.</p>
        {err && <div className="pb-error" role="alert">{err}</div>}
        <div className="pb-row">
          <div className="pb-field"><label htmlFor="pt-kind">Qué querés avisar</label>
            <select id="pt-kind" value={kind} onChange={(e) => setKind(e.target.value)}>
              <option value="PAGUE">Ya pagué</option>
              {data.repairs_enabled && <option value="REPARACION">Hay algo para reparar</option>}
              <option value="CONSULTA">Tengo una consulta</option></select></div>
          {contracts.length > 1 && <div className="pb-field"><label htmlFor="pt-con">Contrato</label>
            <select id="pt-con" value={contractId} onChange={(e) => setContractId(Number(e.target.value))}>{contracts.map((c) => <option key={c.id} value={c.id}>N.º {c.number} · {c.address}</option>)}</select></div>}
        </div>
        <div className="pb-field"><label htmlFor="pt-text">Contanos</label>
          <textarea id="pt-text" rows={4} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} placeholder={kind === "PAGUE" ? "Por ejemplo: transferí el día 5, a nombre de..." : kind === "REPARACION" ? "Qué pasó y dónde" : "Tu consulta"} /></div>
        <Consent checked={ok} onChange={setOk} />
        <button className="pb-btn" disabled={busy} onClick={send}>{busy ? "Enviando..." : "Enviar aviso"}</button>
        {(data.notices || []).length > 0 && (
          <div style={{ marginTop: 18 }}>
            <h2>Tus últimos avisos</h2>
            {(data.notices || []).map((n) => <p key={n.id} className="r3-pub-legal" style={{ color: "#0f1d1d" }}><strong>{NOTICE_LABEL[n.kind] || n.kind}</strong> · {dateTime(n.created_at)} · {n.handled ? "Atendido" : "Pendiente"}<br />{n.text}</p>)}
          </div>)}
      </div>
    </>
  );
}

function Owner({ token, data, onDone }: { token: string; data: Data; onDone: (m: string) => void }) {
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<Record<number, string>>({});
  const repairs = data.repairs || [];

  async function settlement(id: number) {
    try { printSettlement(await publicApi(`/public/portal/${encodeURIComponent(token)}/settlements/${id}`)); } catch (e) { setErr(e instanceof Error ? e.message : "No pudimos abrir la liquidación"); }
  }
  async function decide(id: number, decision: "APROBAR" | "RECHAZAR") {
    setBusy(true); setErr("");
    try {
      await publicApi(`/public/portal/${encodeURIComponent(token)}/maintenance/${id}/decision`, { method: "POST", body: { decision, note: note[id]?.trim() || null } });
      onDone(decision === "APROBAR" ? "Aprobaste el presupuesto. Avisamos a la inmobiliaria." : "Rechazaste el presupuesto. Avisamos a la inmobiliaria.");
    } catch (e) { setErr(e instanceof Error ? e.message : "No pudimos registrar tu respuesta"); } finally { setBusy(false); }
  }
  return (
    <>
      {err && <div className="pb-error" role="alert">{err}</div>}
      {repairs.some((r) => r.can_decide) && (
        <div className="pb-card">
          <span className="pb-step-label">Necesitamos tu respuesta</span>
          <h2>Presupuestos para aprobar</h2>
          {repairs.filter((r) => r.can_decide).map((r) => (
            <div key={r.id} style={{ borderTop: "1px solid #cedddd", paddingTop: 12, marginTop: 12 }}>
              <strong>{r.title}</strong>
              <p className="r3-pub-legal" style={{ color: "#0f1d1d" }}>{r.property}{r.description ? ` · ${r.description}` : ""}</p>
              <p style={{ margin: "6px 0", fontSize: 20, fontWeight: 800 }}>{r.quote_amount !== null ? moneyIn(r.quote_amount, r.currency) : "Sin importe"}</p>
              <div className="pb-field"><label htmlFor={`n${r.id}`}>Comentario (opcional)</label><input id={`n${r.id}`} maxLength={300} value={note[r.id] || ""} onChange={(e) => setNote({ ...note, [r.id]: e.target.value })} /></div>
              <div className="g2-portal-actions">
                <button className="pb-btn g2-portal-small" disabled={busy} onClick={() => decide(r.id, "APROBAR")}>Aprobar</button>
                <button className="pb-btn pb-btn-ghost g2-portal-small" disabled={busy} onClick={() => decide(r.id, "RECHAZAR")}>Rechazar</button>
              </div>
            </div>))}
        </div>)}

      <div className="pb-card">
        <span className="pb-step-label">Tus propiedades</span>
        {(data.properties || []).length === 0 ? <p className="r3-pub-legal">No hay propiedades asociadas a este link.</p> : (
          <div className="g2-portal-scroll"><table className="g2-portal-table"><thead><tr><th>Propiedad</th><th>Alquiler</th><th>Contrato hasta</th></tr></thead>
            <tbody>{(data.properties || []).map((p) => (
              <tr key={p.id}><td>{p.address}<small style={{ display: "block", color: "#465858" }}>{p.code}{p.share_pct < 100 ? ` · tu parte ${p.share_pct}%` : ""}</small></td>
                <td>{p.contract ? moneyIn(p.contract.rent, p.contract.currency) : "Sin alquilar"}</td><td>{p.contract ? shortDate(p.contract.end_date) : "—"}</td></tr>))}</tbody></table></div>)}
      </div>

      <div className="pb-card">
        <span className="pb-step-label">Liquidaciones</span>
        {(data.settlements || []).length === 0 ? <p className="r3-pub-legal">Todavía no hay liquidaciones cerradas.</p> : (
          <div className="g2-portal-scroll"><table className="g2-portal-table"><thead><tr><th>Mes</th><th className="num">Neto</th><th>Estado</th><th /></tr></thead>
            <tbody>{(data.settlements || []).map((s) => (
              <tr key={s.id}><td>{periodName(s.period)}</td><td className="num">{moneyIn(s.net_amount, s.currency)}</td><td>{s.status === "PAGADA" ? `Pagada el ${shortDate(s.paid_on)}` : "Por pagar"}</td>
                <td className="num"><button className="pb-btn pb-btn-ghost g2-portal-small" onClick={() => settlement(s.id)}>Ver o imprimir</button></td></tr>))}</tbody></table></div>)}
      </div>

      {repairs.length > 0 && (
        <div className="pb-card">
          <span className="pb-step-label">Reparaciones</span>
          <div className="g2-portal-scroll"><table className="g2-portal-table"><tbody>{repairs.map((r) => (
            <tr key={r.id}><td>{r.title}<small style={{ display: "block", color: "#465858" }}>{r.property}</small></td>
              <td>{r.status_label}{r.owner_approval !== "PENDIENTE" && r.decided_at ? <small style={{ display: "block", color: "#465858" }}>{r.owner_approval === "APROBADO" ? "Aprobaste" : "Rechazaste"} el {shortDate(r.decided_at)}</small> : null}</td>
              <td className="num">{r.quote_amount !== null ? moneyIn(r.quote_amount, r.currency) : "—"}</td></tr>))}</tbody></table></div>
        </div>)}
      <p className="r3-pub-legal" style={{ textAlign: "center" }}>Tratamos tus datos según nuestra <Link to="/legal/privacidad">Política de privacidad</Link>.</p>
    </>
  );
}

export default Portal;
