// Pantalla «Garantías» (módulo garantias, grupo G1): garantías con vencimiento calculado y depósitos en custodia con su devolución.
// Backend: backend/routes/garantias.py · pendientes: garantias_por_vencer, depositos_sin_devolver.
import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { appApi, canAccess, getSessionUser, moneyIn, shortDate } from "../../../config";
import { Empty, Loading, Modal, PageHeader, Pill, Tabs, useFlash, useRefreshKey } from "../../../components/ui";
import { DEPOSIT_STATUS, GUARANTEE_KIND, GUARANTEE_STATUS, Note, daysText, openWa, tonePill } from "../../../components/g1/common";
import { DepositModal, GuaranteeModal, ReturnModal } from "../../../components/garantias/Modales";
import "../../../g1.css";

type Tab = "garantias" | "depositos";
interface G {
  id: number; kind: string; kind_label: string; status: string; valid_from: string | null; valid_to: string | null; days_left: number | null;
  contract: { id: number; number: number; status: string; address: string; currency: string; tenant: string | null };
  guarantor?: string | null; guarantor_party_id?: number | null; insurer?: string | null; policy_number?: string | null; insured_amount?: number | null; premium?: number | null;
  property_ref?: string | null; notes?: string | null; wa?: { url: string | null; text: string } | null;
}
interface GList { items: G[]; counts: Record<string, number>; uncovered: { contract_id: number; number: number; address: string; tenant: string | null; reason: string }[]; restricted: boolean }
interface D {
  id: number; status: string; currency: string; amount: number | null; received_on: string | null; returned_on: string | null; returned_amount: number | null; notes: string | null; pending_return: boolean;
  deductions: { concept: string; amount: number }[];
  contract: { id: number; number: number; status: string; address: string; tenant: string | null; end_date: string; deposit_mode: string };
  expected: { amount: number; currency: string; mode: string; months: number } | null;
}
interface DList { items: D[]; counts: Record<string, number>; restricted: boolean }

function GarantiasPage() {
  const user = getSessionUser();
  const [params, setParams] = useSearchParams();
  const refreshKey = useRefreshKey();
  const flash = useFlash();
  const manage = ["ADMINISTRADOR", "ENCARGADO"].includes(user?.role || "");
  const contractId = Number(params.get("contrato")) || null;
  const [tab, setTab] = useState<Tab>(params.get("tab") === "depositos" ? "depositos" : "garantias");
  const [status, setStatus] = useState("");
  const [kind, setKind] = useState("");
  const [q, setQ] = useState("");
  const [onlyExpiring, setOnlyExpiring] = useState(false);
  const [gl, setGl] = useState<GList | null>(null);
  const [dl, setDl] = useState<DList | null>(null);
  const [dStatus, setDStatus] = useState("");
  const [modal, setModal] = useState<null | { type: "g"; g?: G; renew?: boolean; contractId?: number | null } | { type: "d"; d?: D } | { type: "ret"; d: D }>(null);
  const [del, setDel] = useState<null | { kind: "g" | "d"; id: number }>(null);

  const loadG = useCallback(() => {
    const qs = new URLSearchParams();
    if (status) qs.set("status", status);
    if (kind) qs.set("kind", kind);
    if (q.trim()) qs.set("q", q.trim());
    if (contractId) qs.set("contract_id", String(contractId));
    if (onlyExpiring) qs.set("expiring_in", "30");
    appApi<GList>(`/guarantees?${qs}`).then(setGl).catch(flash.fail);
  }, [status, kind, q, contractId, onlyExpiring, flash.fail]);
  const loadD = useCallback(() => {
    const qs = new URLSearchParams();
    if (dStatus) qs.set("status", dStatus);
    if (contractId) qs.set("contract_id", String(contractId));
    appApi<DList>(`/deposits?${qs}`).then(setDl).catch(flash.fail);
  }, [dStatus, contractId, flash.fail]);
  useEffect(() => { const t = window.setTimeout(loadG, 200); return () => window.clearTimeout(t); }, [loadG, refreshKey]);
  useEffect(loadD, [loadD, refreshKey]);
  useEffect(() => { if (params.get("tab")) { const n = new URLSearchParams(params); n.delete("tab"); setParams(n, { replace: true }); } }, []); // eslint-disable-line

  const reload = () => { setModal(null); loadG(); loadD(); };
  async function remove() {
    if (!del) return;
    try { await appApi(del.kind === "g" ? `/guarantees/${del.id}` : `/deposits/${del.id}`, { method: "DELETE" }); flash.show("Borrado"); setDel(null); loadG(); loadD(); } catch (e) { flash.fail(e); setDel(null); }
  }
  async function release(g: G) {
    try { await appApi(`/guarantees/${g.id}/release`, { method: "POST" }); flash.show("Garantía liberada"); loadG(); } catch (e) { flash.fail(e); }
  }

  const pendingDeposits = dl?.items.filter((d) => d.pending_return).length || 0;

  return (
    <section className="products-page">
      <PageHeader eyebrow="GARANTÍAS" title="Garantías y depósitos" subtitle="Seguros, avales, fiadores y depósitos en custodia de cada contrato, con sus vencimientos.">
        {manage && tab === "garantias" && <button className="primary-button" onClick={() => setModal({ type: "g", contractId })} data-tour="garantia-nueva">Nueva garantía</button>}
        {manage && tab === "depositos" && <button className="primary-button" onClick={() => setModal({ type: "d" })}>Registrar depósito</button>}
      </PageHeader>
      {flash.node}
      {contractId && <div className="hb-row" style={{ marginBottom: 10 }}><Pill tone="blue">Filtrando por el contrato #{contractId}</Pill><button className="g1-mini" onClick={() => setParams({})}>Ver todos</button></div>}
      <Tabs<Tab> value={tab} onChange={setTab} options={[["garantias", "Garantías"], ["depositos", `Depósitos${pendingDeposits ? ` (${pendingDeposits} por devolver)` : ""}`]]} />

      {tab === "garantias" && (
        <>
          <div className="g1-filters">
            <input type="search" placeholder="Buscar por contrato, dirección, inquilino o póliza" aria-label="Buscar garantías" value={q} onChange={(e) => setQ(e.target.value)} />
            <select aria-label="Tipo" value={kind} onChange={(e) => setKind(e.target.value)}><option value="">Todos los tipos</option>{Object.entries(GUARANTEE_KIND).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            <div className="hb-seg">
              <button className={status === "" && !onlyExpiring ? "is-on" : ""} onClick={() => { setStatus(""); setOnlyExpiring(false); }}>Todas</button>
              {(["VIGENTE", "POR_VENCER", "VENCIDA", "LIBERADA"] as const).map((k) => <button key={k} className={status === k ? "is-on" : ""} onClick={() => { setStatus(k); setOnlyExpiring(false); }}>{GUARANTEE_STATUS[k][0]}{gl ? ` (${gl.counts[k] || 0})` : ""}</button>)}
            </div>
          </div>
          {gl && gl.uncovered.length > 0 && !status && !kind && !q && (
            <Note tone="warn">{gl.uncovered.length} contrato{gl.uncovered.length === 1 ? "" : "s"} vigente{gl.uncovered.length === 1 ? "" : "s"} sin una garantía vigente: {gl.uncovered.slice(0, 4).map((u) => `N.º ${u.number}`).join(", ")}{gl.uncovered.length > 4 ? "..." : ""}.
              {manage && <> <button className="g1-mini" onClick={() => setModal({ type: "g", contractId: gl.uncovered[0].contract_id })}>Cargar una</button></>}</Note>)}
          {!gl ? <Loading /> : gl.items.length === 0 ? <Empty title="No hay garantías con ese filtro">{manage ? "Cargá el seguro de caución, el aval, el fiador o el inmueble en garantía de cada contrato." : ""}</Empty> : (
            <div className="hb-table-wrap" style={{ marginTop: 10 }}>
              <table className="hb-table">
                <thead><tr><th>Contrato</th><th>Garantía</th><th>Vigencia</th><th>Estado</th><th /></tr></thead>
                <tbody>{gl.items.map((g) => (
                  <tr key={g.id}>
                    <td><strong>{canAccess(user, "contratos") ? <Link to={`/app/contratos?id=${g.contract.id}`}>N.º {g.contract.number}</Link> : `N.º ${g.contract.number}`}</strong><small>{g.contract.address}</small><small>{g.contract.tenant || ""}</small></td>
                    <td><strong>{g.kind_label}</strong>{g.guarantor && <small>{g.guarantor}</small>}{g.insurer && <small>{g.insurer}{g.policy_number ? ` · póliza ${g.policy_number}` : ""}</small>}{g.insured_amount ? <small>Asegurado {moneyIn(g.insured_amount, g.contract.currency)}</small> : null}{g.property_ref && <small>{g.property_ref}</small>}</td>
                    <td>{g.valid_to ? <>{g.valid_from ? shortDate(g.valid_from) + " al " : "Hasta el "}{shortDate(g.valid_to)}{g.days_left !== null && g.status !== "LIBERADA" && <small className={g.days_left < 0 ? "g1-late" : g.days_left <= 30 ? "g1-warn" : ""}>{daysText(g.days_left)}</small>}</> : "Sin vencimiento"}</td>
                    <td>{tonePill(GUARANTEE_STATUS, g.status)}</td>
                    <td><div className="g1-actions end">
                      {g.wa?.url && <button className="g1-mini" onClick={() => openWa(g.wa!.url)} aria-label={`Avisar a ${g.contract.tenant} por WhatsApp`}>WhatsApp</button>}
                      {manage && g.status !== "LIBERADA" && <button className="g1-mini" onClick={() => setModal({ type: "g", g, renew: true })}>Renovar</button>}
                      {manage && <button className="g1-mini" onClick={() => setModal({ type: "g", g })}>Editar</button>}
                      {manage && g.status !== "LIBERADA" && ["RESCINDIDO", "FINALIZADO"].includes(g.contract.status) && <button className="g1-mini" onClick={() => release(g)}>Liberar</button>}
                      {manage && <button className="g1-mini is-danger" onClick={() => setDel({ kind: "g", id: g.id })}>Borrar</button>}
                    </div></td>
                  </tr>))}</tbody>
              </table>
            </div>)}
          {gl?.restricted && <p className="hb-hint">Tu rol ve solo el estado de cada garantía.</p>}
        </>)}

      {tab === "depositos" && (
        <>
          <div className="g1-filters">
            <div className="hb-seg">
              {([["", "Todos"], ["EN_CUSTODIA", "En custodia"], ["DEVUELTO", "Devueltos"], ["PARCIAL", "Con descuentos"], ["APLICADO", "Aplicados a deuda"]] as [string, string][]).map(([k, l]) => (
                <button key={k} className={dStatus === k ? "is-on" : ""} onClick={() => setDStatus(k)}>{l}{k && dl?.counts[k] ? ` (${dl.counts[k]})` : ""}</button>))}
            </div>
          </div>
          {pendingDeposits > 0 && <Note tone="warn">{pendingDeposits} depósito{pendingDeposits === 1 ? "" : "s"} de contratos terminados sin devolver ni aplicar.</Note>}
          {!dl ? <Loading /> : dl.items.length === 0 ? <Empty title="No hay depósitos con ese filtro">Los depósitos se registran al activar el contrato o desde «Registrar depósito».</Empty> : (
            <div className="hb-table-wrap" style={{ marginTop: 10 }}>
              <table className="hb-table">
                <thead><tr><th>Contrato</th><th className="num">Depósito</th><th>Recibido</th><th>Estado</th><th /></tr></thead>
                <tbody>{dl.items.map((d) => (
                  <tr key={d.id}>
                    <td><strong>{canAccess(user, "contratos") ? <Link to={`/app/contratos?id=${d.contract.id}`}>N.º {d.contract.number}</Link> : `N.º ${d.contract.number}`}</strong><small>{d.contract.address}</small><small>{d.contract.tenant || ""}</small></td>
                    <td className="num">{d.amount !== null ? moneyIn(d.amount, d.currency) : "—"}
                      {d.expected && d.status === "EN_CUSTODIA" && d.contract.deposit_mode === "ULTIMO_CANON" && d.expected.amount !== d.amount ? <small>Hoy equivale a {moneyIn(d.expected.amount, d.expected.currency)}</small> : null}
                      {d.returned_amount !== null && d.status !== "EN_CUSTODIA" && <small>Devuelto {moneyIn(d.returned_amount, d.currency)}</small>}</td>
                    <td>{d.received_on ? shortDate(d.received_on) : "—"}{d.returned_on && <small>Devuelto el {shortDate(d.returned_on)}</small>}</td>
                    <td>{tonePill(DEPOSIT_STATUS, d.status)}{d.pending_return && <small className="g1-late">Contrato terminado</small>}
                      {d.deductions.length > 0 && <small>{d.deductions.map((x) => `${x.concept} ${moneyIn(x.amount, d.currency)}`).join(" · ")}</small>}</td>
                    <td><div className="g1-actions end">
                      {manage && d.status === "EN_CUSTODIA" && ["RESCINDIDO", "FINALIZADO"].includes(d.contract.status) && <button className="g1-mini is-primary" onClick={() => setModal({ type: "ret", d })}>Devolver</button>}
                      {manage && d.status === "EN_CUSTODIA" && <button className="g1-mini" onClick={() => setModal({ type: "d", d })}>Editar</button>}
                      {manage && d.status === "EN_CUSTODIA" && <button className="g1-mini is-danger" onClick={() => setDel({ kind: "d", id: d.id })}>Borrar</button>}
                    </div></td>
                  </tr>))}</tbody>
              </table>
            </div>)}
          <p className="hb-hint" style={{ marginTop: 10 }}>El depósito se devuelve cuando el contrato terminó. Los descuentos tienen que estar respaldados por comprobantes; Habita guarda el detalle pero no decide qué corresponde descontar.</p>
        </>)}

      {modal?.type === "g" && <GuaranteeModal g={modal.g} renew={modal.renew} contractId={modal.contractId} onClose={() => setModal(null)} onDone={reload} flash={flash} />}
      {modal?.type === "d" && <DepositModal d={modal.d} onClose={() => setModal(null)} onDone={reload} flash={flash} />}
      {modal?.type === "ret" && <ReturnModal d={modal.d} onClose={() => setModal(null)} onDone={reload} flash={flash} />}
      {del && (
        <Modal title="¿Borrar este registro?" eyebrow="GARANTÍAS" onClose={() => setDel(null)} footer={<><button className="secondary-button" onClick={() => setDel(null)}>No, volver</button><button className="primary-button" onClick={remove}>Sí, borrar</button></>}>
          <p className="hb-muted">Usalo solo para una carga equivocada. Queda registrado en la auditoría. Para cerrar una garantía de un contrato terminado, usá «Liberar».</p>
        </Modal>)}
    </section>
  );
}

export default GarantiasPage;
