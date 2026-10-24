// Ficha del contrato: Resumen, Cuenta (cobranza), Ajustes, Garantías, Documentos, Mantenimiento e Inspecciones.
import { Fragment, useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { appApi, canAccess, getSessionUser, moneyIn, shortDate } from "../../config";
import { Empty, Field, Loading, Modal, Pill, Tabs } from "../ui";
import { CuentaContrato } from "../cobranzas/Cuenta";
import { printContract } from "../../pages/print/printG1";
import {
  CONTRACT_STATUS, DEPOSIT_MODE_LABEL, DEPOSIT_STATUS, DOC_KIND, FX_RULE_LABEL, GUARANTEE_KIND, GUARANTEE_STATUS, METHOD_LABEL, Note, PLAN_CONCEPT, PURPOSE_LABEL, REGIME_LABEL, ROLE_LABEL,
  TRAFFIC, tonePill, todayISO, toNum,
} from "../g1/common";
import { AjusteCard } from "./Ajustes";
import type { Adj } from "./Ajustes";
import { AdminDataModal, FinishModal, PartiesModal, PlanModal, RenewModal, RentChangeModal, RescindModal } from "./Acciones";
import { NuevoContrato } from "./NuevoContrato";

type Tab = "resumen" | "cuenta" | "ajustes" | "garantias" | "documentos" | "mantenimiento" | "inspecciones";
type Flash = { show: (t: string, e?: boolean) => void; fail: (e: unknown) => void };
type Modal_ = null | "renew" | "rescind" | "finish" | "rent" | "admin" | "parties" | "plan" | "edit" | "activate" | "delete";

export function FichaContrato({ id, flash, onBack, onChanged, onOpen }: { id: number; flash: Flash; onBack: () => void; onChanged: () => void; onOpen: (id: number) => void }) {
  const user = getSessionUser();
  const manage = ["ADMINISTRADOR", "ENCARGADO"].includes(user?.role || "");
  const [c, setC] = useState<any>(null);
  const [tab, setTab] = useState<Tab>("resumen");
  const [modal, setModal] = useState<Modal_>(null);
  const load = useCallback(() => { appApi(`/contracts/${id}`).then(setC).catch(flash.fail); }, [id, flash.fail]);
  useEffect(load, [load]);
  if (!c) return <Loading />;

  const has = (m: string) => canAccess(user, m);
  const active = ["VIGENTE", "POR_VENCER", "VENCIDO"].includes(c.status);
  const draft = c.status === "BORRADOR";
  const [stLabel, stTone] = CONTRACT_STATUS[c.status] || [c.status, "gray"];
  const [trLabel, trTone] = TRAFFIC[c.traffic] || ["", "gray"];
  const done = () => { setModal(null); load(); onChanged(); };

  async function print() {
    try { printContract(await appApi(`/contracts/${id}/pdf`)); } catch (e) { flash.fail(e); }
  }

  const tabs: [Tab, string][] = [["resumen", "Resumen"]];
  if (!draft && has("cobranzas")) tabs.push(["cuenta", "Cuenta"]);
  tabs.push(["ajustes", `Ajustes${c.pending_adjustment ? " (1)" : ""}`]);
  if (c.guarantees) tabs.push(["garantias", "Garantías"]);
  if (c.documents) tabs.push(["documentos", "Documentos"]);
  if (c.maintenance) tabs.push(["mantenimiento", "Mantenimiento"]);
  if (c.inspections) tabs.push(["inspecciones", "Inspecciones"]);

  return (
    <div>
      <button className="g1-back" onClick={onBack}>← Volver a contratos</button>
      <div className="g1-ficha-head">
        <div>
          <h2>Contrato N.º {c.number} · {c.property.address}</h2>
          <div className="hb-row">
            <Pill tone={stTone}>{stLabel}</Pill>
            {active && <span className="g1-trl"><span className={`g1-dot ${trTone}`} />{trLabel}</span>}
            <span className="hb-muted">{c.property.code} · {PURPOSE_LABEL[c.purpose]} · {REGIME_LABEL[c.regime]}</span>
          </div>
          {c.traffic_reasons?.length > 0 && <p className="hb-muted" style={{ margin: "6px 0 0" }}>{c.traffic_reasons.join(" · ")}</p>}
          {c.renewal && <p className="hb-muted" style={{ margin: "6px 0 0" }}>Renovación: <button className="g1-back" style={{ margin: 0 }} onClick={() => onOpen(c.renewal.id)}>contrato N.º {c.renewal.number}</button></p>}
          {c.renewed_from && <p className="hb-muted" style={{ margin: "6px 0 0" }}>Renueva el <button className="g1-back" style={{ margin: 0 }} onClick={() => onOpen(c.renewed_from.id)}>contrato N.º {c.renewed_from.number}</button></p>}
        </div>
        <div className="g1-actions">
          <button className="secondary-button" onClick={print}>Imprimir ficha</button>
          {manage && draft && <button className="secondary-button" onClick={() => setModal("edit")}>Editar borrador</button>}
          {manage && draft && <button className="primary-button" onClick={() => setModal("activate")}>Activar</button>}
          {manage && active && <button className="primary-button" onClick={() => setModal("renew")} disabled={!!c.renewal && c.renewal.status === "BORRADOR"}>Renovar</button>}
        </div>
      </div>

      <Tabs<Tab> value={tab} onChange={setTab} options={tabs} />

      {tab === "resumen" && (
        <div className="hb-grid-2">
          <div className="hb-card">
            <h2>Condiciones</h2>
            <dl className="g1-kv">
              <dt>Plazo</dt><dd>{shortDate(c.start_date)} al {shortDate(c.end_date)} ({c.term_months} meses){c.days_left !== null && c.days_left !== undefined ? ` · ${c.days_left >= 0 ? `faltan ${c.days_left} días` : `venció hace ${-c.days_left} días`}` : ""}</dd>
              <dt>Vence el día</dt><dd>{c.due_day} de cada mes</dd>
              <dt>Alquiler inicial</dt><dd>{moneyIn(c.initial_rent, c.currency)}</dd>
              <dt>Alquiler actual</dt><dd><strong>{moneyIn(c.current_rent, c.currency)}</strong></dd>
              {c.currency === "USD" && <><dt>Cotización</dt><dd>{FX_RULE_LABEL[c.fx_rule]}{c.fx_note ? ` · ${c.fx_note}` : ""}</dd></>}
              <dt>Ajuste</dt><dd>{c.adjustment_text || METHOD_LABEL[c.adjustment_method]}</dd>
              <dt>Próximo ajuste</dt><dd>{c.next_adjustment_date ? shortDate(c.next_adjustment_date) : "—"}</dd>
              {!c.restricted && <>
                <dt>Mora</dt><dd>{c.late_interest_monthly_pct ? `${c.late_interest_monthly_pct}% mensual` : "Sin interés"} · {c.grace_days} días de gracia</dd>
                <dt>Comisión de administración</dt><dd>{c.admin_commission_pct}% sobre lo {c.admin_commission_base === "COBRADO" ? "cobrado" : "devengado"}</dd>
                <dt>Comisión al inquilino</dt><dd>{c.tenant_commission_amount ? `${moneyIn(c.tenant_commission_amount, c.currency)}${c.tenant_commission_paid_at ? ` · cobrada el ${shortDate(c.tenant_commission_paid_at)}` : " · sin cobrar"}` : "—"}</dd>
                <dt>Depósito</dt><dd>{c.deposit_amount ? `${moneyIn(c.deposit_amount, c.deposit_currency)} (${DEPOSIT_MODE_LABEL[c.deposit_mode]}${c.deposit_months ? `, ${c.deposit_months} meses` : ""})` : "—"}</dd>
                <dt>Rescisión anticipada</dt><dd>{c.early_termination_pct ? `${c.early_termination_pct}%` : "—"}{c.early_termination_notice_days ? ` · preaviso ${c.early_termination_notice_days} días` : ""}</dd>
                <dt>Sellado</dt><dd>{c.stamp?.calculable ? `Estimado ${moneyIn(c.stamp.total, c.currency)} (inquilino ${moneyIn(c.stamp.tenant_amount, c.currency)})` : (c.stamp?.message || "—")}{c.stamp_paid_on ? ` · pagado el ${shortDate(c.stamp_paid_on)}` : active && c.stamp?.calculable && c.stamp.total > 0 ? " · sin pagar" : ""}</dd>
                <dt>ARCA</dt><dd>{c.arca_registered ? `Registrado${c.arca_number ? " · " + c.arca_number : ""}${c.arca_date ? " · " + shortDate(c.arca_date) : ""}` : c.regime === "LEY_27551" ? "Sin registrar" : "No registrado"}</dd>
                {c.notes && <><dt>Notas</dt><dd>{c.notes}</dd></>}
              </>}
            </dl>
            {c.stamp?.note && <p className="hb-hint">{c.stamp.note}</p>}
          </div>
          <div className="hb-card">
            <h2>Personas</h2>
            <dl className="g1-kv">
              {(["INQUILINO", "COINQUILINO", "GARANTE", "FIADOR"] as const).flatMap((role) => (c.parties?.[role] || []).map((p: any) => (
                <Fragment key={role + p.id}><dt>{ROLE_LABEL[role]}</dt><dd><strong>{p.full_name}</strong>{p.doc_number ? ` · ${p.doc_type || ""} ${p.doc_number}` : ""}
                  {p.wa_phone && <> <a className="g1-mini" href={`https://wa.me/${p.wa_phone}`} target="_blank" rel="noopener noreferrer" aria-label={`Escribirle a ${p.full_name} por WhatsApp`}>WhatsApp</a></>}
                  {p.has_consent === false && <><br /><span className="g1-warn">Falta el consentimiento de datos</span></>}</dd></Fragment>)))}
              {(c.owners || []).map((o: any) => <Fragment key={"o" + o.id}><dt>Propietario</dt><dd><strong>{o.full_name}</strong> ({o.share_pct}%)</dd></Fragment>)}
            </dl>
            {manage && !["RESCINDIDO", "FINALIZADO"].includes(c.status) && <div className="g1-actions"><button className="g1-mini" onClick={() => setModal("parties")}>Cambiar personas</button></div>}
            {c.charge_plan && (
              <>
                <p className="g1-section">Conceptos mensuales</p>
                {c.charge_plan.length === 0 ? <p className="hb-muted">Solo se cobra el alquiler.</p> : (
                  <div className="g1-chips">{c.charge_plan.map((r: any) => <span key={r.id} className="hb-chip">{PLAN_CONCEPT[r.concept] || r.concept}{r.amount ? ` ${moneyIn(r.amount, c.currency)}` : ""}{r.active ? "" : " (pausado)"}</span>)}</div>)}
                {manage && !["RESCINDIDO", "FINALIZADO"].includes(c.status) && <div className="g1-actions" style={{ marginTop: 8 }}><button className="g1-mini" onClick={() => setModal("plan")}>Cambiar conceptos</button></div>}
              </>)}
          </div>
          {c.status === "RESCINDIDO" && (
            <div className="hb-card"><h2>Rescisión</h2><dl className="g1-kv"><dt>Fecha</dt><dd>{shortDate(c.rescinded_on)}</dd><dt>Motivo</dt><dd>{c.rescinded_reason || "—"}</dd></dl></div>)}
          {manage && (active || draft) && (
            <div className="hb-card">
              <h2>Acciones</h2>
              <div className="g1-actions">
                {active && <button className="g1-mini" onClick={() => setModal("rent")}>Cambiar el canon</button>}
                <button className="g1-mini" onClick={() => setModal("admin")}>Datos administrativos</button>
                {active && <button className="g1-mini" onClick={() => setModal("finish")}>Finalizar</button>}
                {active && <button className="g1-mini is-danger" onClick={() => setModal("rescind")}>Rescindir</button>}
                {draft && <button className="g1-mini is-danger" onClick={() => setModal("delete")}>Borrar el borrador</button>}
              </div>
              <p className="hb-hint">Nada se borra: un contrato activado se rescinde o se finaliza y queda en el historial.</p>
            </div>)}
          {manage && !draft && !active && (
            <div className="hb-card"><h2>Acciones</h2><div className="g1-actions"><button className="g1-mini" onClick={() => setModal("admin")}>Datos administrativos</button></div></div>)}
        </div>)}

      {tab === "cuenta" && <div className="hb-card"><CuentaContrato contractId={id} onChanged={() => { load(); onChanged(); }} /></div>}

      {tab === "ajustes" && (
        <div className="hb-stack">
          {c.pending_adjustment && <AjusteCard adj={c.pending_adjustment as Adj} canEdit={manage} flash={flash} showContract={false} onChanged={() => { load(); onChanged(); }} />}
          {c.adjustments.filter((a: any) => !["PROPUESTO", "ESPERANDO_INDICE"].includes(a.status)).length === 0 && !c.pending_adjustment
            ? <Empty title="Todavía no hay ajustes">{c.adjustment_method === "SIN_AJUSTE" ? "Este contrato no se ajusta." : c.next_adjustment_date ? `El próximo es el ${shortDate(c.next_adjustment_date)}.` : ""}</Empty> : (
              <div className="hb-table-wrap"><table className="hb-table">
                <thead><tr><th>Fecha</th><th>Tipo</th><th className="num">Antes</th><th className="num">Después</th><th>Estado</th></tr></thead>
                <tbody>{c.adjustments.filter((a: any) => !["PROPUESTO", "ESPERANDO_INDICE"].includes(a.status)).map((a: any) => (
                  <tr key={a.id}><td>{shortDate(a.due_date)}</td><td>{METHOD_LABEL[a.method] || a.method}{a.index_code ? ` ${a.index_code}` : ""}{a.formula_text && <small>{a.formula_text}</small>}{a.note && <small>{a.note}</small>}</td>
                    <td className="num">{a.previous_rent !== null ? moneyIn(a.previous_rent, c.currency) : "—"}</td><td className="num">{a.new_rent !== null ? moneyIn(a.new_rent, c.currency) : "—"}</td>
                    <td>{a.status === "APLICADO" ? <Pill tone="green">Aplicado</Pill> : <Pill tone="gray">Descartado</Pill>}</td></tr>))}</tbody></table></div>)}
        </div>)}

      {tab === "garantias" && c.guarantees && (
        <div className="hb-card">
          {c.guarantees.length === 0 ? <Empty title="Sin garantías cargadas">Cargá el seguro, el aval, el fiador o el inmueble en garantía.</Empty> : (
            <div className="hb-table-wrap"><table className="hb-table"><thead><tr><th>Garantía</th><th>Vence</th><th>Estado</th></tr></thead>
              <tbody>{c.guarantees.map((g: any) => <tr key={g.id}><td><strong>{GUARANTEE_KIND[g.kind] || g.kind}</strong>{g.insurer && <small>{g.insurer}{g.policy_number ? ` · póliza ${g.policy_number}` : ""}</small>}</td>
                <td>{g.valid_to ? shortDate(g.valid_to) : "—"}</td><td>{tonePill(GUARANTEE_STATUS, g.status)}</td></tr>)}</tbody></table></div>)}
          {c.deposits?.length > 0 && <><p className="g1-section">Depósito</p>{c.deposits.map((d: any) => <p key={d.id} style={{ color: "var(--hb-ink)", margin: "4px 0" }}>{moneyIn(d.amount, d.currency)} {tonePill(DEPOSIT_STATUS, d.status)} {d.received_on ? `recibido el ${shortDate(d.received_on)}` : ""}</p>)}</>}
          {has("garantias") && <div style={{ marginTop: 12 }}><Link className="secondary-button" to={`/app/garantias?contrato=${id}`}>Abrir en Garantías</Link></div>}
        </div>)}

      {tab === "documentos" && c.documents && (
        <div className="hb-card">
          {c.documents.length === 0 ? <Empty title="Sin documentos">El contrato escaneado, el anexo, las pólizas.</Empty> : (
            <div className="hb-table-wrap"><table className="hb-table"><thead><tr><th>Documento</th><th>Tipo</th><th>Vence</th></tr></thead>
              <tbody>{c.documents.map((d: any) => <tr key={d.id}><td><strong>{d.name}</strong></td><td>{DOC_KIND[d.kind] || d.kind}</td><td>{d.expires_on ? shortDate(d.expires_on) : "—"}</td></tr>)}</tbody></table></div>)}
          {has("documentos") && <div style={{ marginTop: 12 }}><Link className="secondary-button" to={`/app/documentos?entidad=CONTRACT&entidad_id=${id}${manage ? "&nuevo=1" : ""}`}>{manage ? "Subir un documento" : "Ver en Documentos"}</Link></div>}
        </div>)}

      {tab === "mantenimiento" && c.maintenance && (
        <div className="hb-card">
          {c.maintenance.length === 0 ? <Empty title="Sin reparaciones registradas" /> : (
            <div className="hb-table-wrap"><table className="hb-table"><thead><tr><th>Reclamo</th><th>Prioridad</th><th>Estado</th></tr></thead>
              <tbody>{c.maintenance.map((m: any) => <tr key={m.id}><td><strong>{m.title}</strong></td><td>{m.priority}</td><td>{m.status}</td></tr>)}</tbody></table></div>)}
          {has("mantenimiento") && <div style={{ marginTop: 12 }}><Link className="secondary-button" to="/app/mantenimiento">Abrir Reparaciones</Link></div>}
        </div>)}

      {tab === "inspecciones" && c.inspections && (
        <div className="hb-card">
          {c.inspections.length === 0 ? <Empty title="Sin inspecciones" /> : (
            <div className="hb-table-wrap"><table className="hb-table"><thead><tr><th>Tipo</th><th>Fecha</th><th>Estado</th></tr></thead>
              <tbody>{c.inspections.map((m: any) => <tr key={m.id}><td><strong>{m.kind}</strong></td><td>{shortDate(m.done_on)}</td><td>{m.status}</td></tr>)}</tbody></table></div>)}
          {has("inspecciones") && <div style={{ marginTop: 12 }}><Link className="secondary-button" to="/app/inspecciones">Abrir Inspecciones</Link></div>}
        </div>)}

      {modal === "renew" && <RenewModal c={c} onClose={() => setModal(null)} onDone={done} flash={flash} onOpen={onOpen} />}
      {modal === "rescind" && <RescindModal c={c} onClose={() => setModal(null)} onDone={done} flash={flash} />}
      {modal === "finish" && <FinishModal c={c} onClose={() => setModal(null)} onDone={done} flash={flash} />}
      {modal === "rent" && <RentChangeModal c={c} onClose={() => setModal(null)} onDone={done} flash={flash} />}
      {modal === "admin" && <AdminDataModal c={c} onClose={() => setModal(null)} onDone={done} flash={flash} />}
      {modal === "parties" && <PartiesModal c={c} onClose={() => setModal(null)} onDone={done} flash={flash} />}
      {modal === "plan" && <PlanModal c={c} onClose={() => setModal(null)} onDone={done} flash={flash} />}
      {modal === "edit" && <NuevoContrato draft={c} onClose={() => setModal(null)} onDone={() => { flash.show("Borrador guardado"); done(); }} />}
      {modal === "activate" && <ActivateModal c={c} hasDeposits={c.deposits !== undefined} onClose={() => setModal(null)} onDone={(msg) => { flash.show(msg); done(); }} flash={flash} />}
      {modal === "delete" && <DeleteDraft c={c} onClose={() => setModal(null)} onDone={() => { flash.show("Borrador borrado"); onChanged(); onBack(); }} />}
    </div>
  );
}

function ActivateModal({ c, hasDeposits, onClose, onDone }: { c: any; hasDeposits: boolean; onClose: () => void; onDone: (m: string) => void; flash: Flash }) {
  const [rent, setRent] = useState("");
  const [dep, setDep] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const started = c.start_date < todayISO();
  async function go() {
    setBusy(true); setErr("");
    try {
      const r = await appApi<{ charges_created: number; skipped_adjustments: number; finished_previous: number | null }>(`/contracts/${c.id}/activate`, { method: "POST", body: { current_rent: toNum(rent), deposit_received_on: dep || null } });
      onDone(`Contrato activado${r.charges_created ? ` y se generaron ${r.charges_created} cargos` : ""}${r.finished_previous ? `. El contrato N.º ${r.finished_previous} pasó a finalizado` : ""}`);
    } catch (e) { setErr(e instanceof Error ? e.message : "No se pudo activar"); } finally { setBusy(false); }
  }
  return (
    <Modal title="Activar el contrato" eyebrow={`CONTRATO N.º ${c.number}`} onClose={onClose} footer={<>
      <button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={busy} onClick={go}>{busy ? "Activando..." : "Activar"}</button></>}>
      {err && <Note tone="error">{err}</Note>}
      <p className="hb-muted">Al activar, la propiedad pasa a «Alquilada» y se generan los cargos de los meses corridos (hasta 3 para atrás, si tenés el módulo de Cobranza). Podés rescindirlo o finalizarlo después, pero un contrato activado no se borra.</p>
      {started && <Field label="Canon actual (si el contrato ya venía en marcha)" hint="Si el alquiler de hoy ya no es el inicial, cargalo acá."><input inputMode="decimal" value={rent} onChange={(e) => setRent(e.target.value)} placeholder={String(c.initial_rent).replace(".", ",")} /></Field>}
      {hasDeposits && c.deposit_amount > 0 && <Field label="Depósito recibido el (opcional)" hint="Queda en custodia en Garantías."><input type="date" max={todayISO()} value={dep} onChange={(e) => setDep(e.target.value)} /></Field>}
    </Modal>
  );
}

function DeleteDraft({ c, onClose, onDone }: { c: any; onClose: () => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  return (
    <Modal title="Borrar el borrador" eyebrow={`CONTRATO N.º ${c.number}`} onClose={onClose} footer={<>
      <button className="secondary-button" onClick={onClose}>Cancelar</button>
      <button className="primary-button" disabled={busy} onClick={async () => { setBusy(true); try { await appApi(`/contracts/${c.id}`, { method: "DELETE" }); onDone(); } catch (e) { setErr(e instanceof Error ? e.message : "No se pudo borrar"); } finally { setBusy(false); } }}>Borrar</button></>}>
      {err && <Note tone="error">{err}</Note>}
      <p className="hb-muted">Es un borrador que nunca se activó, así que se puede borrar. Los contratos activados no se borran.</p>
    </Modal>
  );
}

