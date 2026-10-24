// Ficha de una persona: datos, contratos, propiedades, documentos, saldo, consentimiento, exportación y anonimización (Ley 25.326).
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { appApi, canAccess, dateTime, getSessionUser, moneyIn, phoneText, saveBlob, shortDate } from "../../config";
import { Empty, Loading, Modal, Pill } from "../ui";
import { printPartyExport } from "../../pages/print/printG1";
import { CONTRACT_STATUS, DOC_KIND, Note, ROLE_LABEL, TAX_CONDITIONS, tonePill } from "../g1/common";
import { PartyFormModal } from "./PartyForm";
import type { PartyData } from "./PartyForm";

interface Full extends PartyData {
  contracts?: { id: number; number: number; role: string; status: string; start_date: string; end_date: string; property: string | null; current_rent: number; currency: string }[];
  properties?: { id: number; code: string; address: string; status: string; share_pct: number }[];
  documents?: { id: number; name: string; kind: string; expires_on: string | null }[];
  balances?: Record<string, { debt: number; overdue: number; credit: number; net: number }>;
}

export function PartyFicha({ id, onBack, onChanged, onOpenProperty, flash }: {
  id: number; onBack: () => void; onChanged: () => void; onOpenProperty: (id: number) => void; flash: { show: (t: string, e?: boolean) => void; fail: (e: unknown) => void };
}) {
  const user = getSessionUser();
  const [p, setP] = useState<Full | null>(null);
  const [edit, setEdit] = useState(false);
  const [anon, setAnon] = useState<{ can: boolean; blockers: string[]; warning: string | null } | null>(null);
  const [confirm, setConfirm] = useState(false);
  const manage = ["ADMINISTRADOR", "ENCARGADO"].includes(user?.role || "");
  const admin = user?.role === "ADMINISTRADOR";
  const load = useCallback(() => { appApi<Full>(`/parties/${id}`).then(setP).catch(flash.fail); }, [id, flash.fail]);
  useEffect(load, [load]);
  if (!p) return <Loading />;
  const restricted = p.contracts === undefined && p.email === undefined;
  const roles = [p.is_owner && "Propietario", p.is_tenant && "Inquilino", p.is_guarantor && "Garante", p.is_supplier_contact && "Proveedor"].filter(Boolean) as string[];

  async function exportData(mode: "json" | "print") {
    try {
      const d = await appApi<any>(`/parties/${id}/export`);
      if (mode === "json") saveBlob(new Blob([JSON.stringify(d, null, 2)], { type: "application/json" }), `datos-${p!.full_name.replace(/\s+/g, "-").toLowerCase()}.json`);
      else {
        let agency = null;
        try { agency = await appApi<any>("/settings"); } catch { agency = null; }
        printPartyExport(d, agency);
      }
      flash.show("Exportación hecha. Queda registrada en la auditoría.");
    } catch (e) { flash.fail(e); }
  }
  async function openAnon() {
    try { setAnon(await appApi(`/parties/${id}/anonymize-check`)); setConfirm(false); } catch (e) { flash.fail(e); }
  }
  async function doAnon() {
    try { await appApi(`/parties/${id}/anonymize`, { method: "POST", body: { confirm: true } }); flash.show("La persona quedó anonimizada"); setAnon(null); load(); onChanged(); } catch (e) { flash.fail(e); }
  }

  return (
    <div>
      <button className="g1-back" onClick={onBack}>← Volver a personas</button>
      <div className="g1-ficha-head">
        <div>
          <h2>{p.full_name}</h2>
          <div className="hb-row">{roles.map((r) => <Pill key={r} tone="brand">{r}</Pill>)}{p.anonymized_at && <Pill tone="gray">Anonimizada</Pill>}{!p.active && <Pill tone="gray">Inactiva</Pill>}</div>
        </div>
        <div className="g1-actions">
          {p.wa_phone && <a className="secondary-button" href={`https://wa.me/${p.wa_phone}`} target="_blank" rel="noopener noreferrer">WhatsApp</a>}
          {manage && !p.anonymized_at && <button className="primary-button" onClick={() => setEdit(true)}>Editar</button>}
        </div>
      </div>

      {restricted ? <Note>Tu rol ve solamente el nombre de la persona.</Note> : (
        <div className="hb-grid-2">
          <div className="hb-card">
            <h2>Datos</h2>
            <dl className="g1-kv">
              <dt>Documento</dt><dd>{p.doc_number ? `${p.doc_type || ""} ${p.doc_number}` : "—"}</dd>
              <dt>CUIT / CUIL</dt><dd>{p.cuit || "—"}</dd>
              <dt>Condición IVA</dt><dd>{p.tax_condition ? TAX_CONDITIONS[p.tax_condition] || p.tax_condition : "—"}</dd>
              <dt>Email</dt><dd>{p.email || "—"}</dd>
              <dt>Teléfono</dt><dd>{phoneText(p.phone_area, p.phone_number)}</dd>
              <dt>Domicilio</dt><dd>{[p.address, p.city, p.province].filter(Boolean).join(", ") || "—"}</dd>
              {(p.bank_alias || p.bank_cbu) && <><dt>Cuenta</dt><dd>{p.bank_holder ? p.bank_holder + " · " : ""}{p.bank_alias || ""} {p.bank_cbu || ""}</dd></>}
              <dt>Notas</dt><dd>{p.notes || "—"}</dd>
            </dl>
          </div>
          <div className="hb-card">
            <h2>Datos personales (Ley 25.326)</h2>
            <p className="hb-muted" style={{ margin: "0 0 10px" }}>{p.consent_at ? `Consentimiento registrado el ${dateTime(p.consent_at)}${p.consent_text_version ? " (texto " + p.consent_text_version + ")" : ""}.` : "Todavía no tiene el consentimiento registrado: pedíselo y tildalo al editar la persona."}</p>
            {admin && !p.anonymized_at && (
              <div className="g1-actions">
                <button className="g1-mini" onClick={() => exportData("json")}>Descargar sus datos</button>
                <button className="g1-mini" onClick={() => exportData("print")}>Imprimir sus datos</button>
                <button className="g1-mini is-danger" onClick={openAnon}>Anonimizar</button>
              </div>)}
            {!admin && <p className="hb-hint">La exportación y la anonimización las hace el titular de la cuenta.</p>}
            <p className="hb-hint" style={{ marginTop: 10 }}>Los datos con obligación de conservación (por ejemplo, el legajo UIF por 10 años) no se pueden anonimizar hasta que pase ese plazo.</p>
          </div>
        </div>)}

      {p.balances && Object.keys(p.balances).length > 0 && (
        <div className="hb-kpis" style={{ marginTop: 16 }}>
          {Object.entries(p.balances).map(([cur, b]) => (
            <div key={cur} className={`hb-kpi ${b.overdue > 0 ? "is-alert" : ""}`}><span>Saldo ({cur})</span><strong>{moneyIn(b.net, cur)}</strong>
              <small>{b.overdue > 0 ? `${moneyIn(b.overdue, cur)} vencido` : b.credit > 0 ? `${moneyIn(b.credit, cur)} a favor` : "Al día"}</small></div>))}
        </div>)}

      {p.contracts && (
        <div className="hb-card" style={{ marginTop: 16 }}>
          <h2>Contratos</h2>
          {p.contracts.length === 0 ? <Empty title="No participa de ningún contrato" /> : (
            <div className="hb-table-wrap"><table className="hb-table">
              <thead><tr><th>Contrato</th><th>Rol</th><th>Propiedad</th><th>Plazo</th><th>Estado</th></tr></thead>
              <tbody>{p.contracts.map((c) => (
                <tr key={c.id}><td>{canAccess(user, "contratos") ? <Link to={`/app/contratos?id=${c.id}`}><strong>N.º {c.number}</strong></Link> : <strong>N.º {c.number}</strong>}</td>
                  <td>{ROLE_LABEL[c.role] || c.role}</td><td>{c.property || "—"}</td><td>{shortDate(c.start_date)} al {shortDate(c.end_date)}</td><td>{tonePill(CONTRACT_STATUS, c.status)}</td></tr>))}</tbody></table></div>)}
        </div>)}
      {p.properties && p.properties.length > 0 && (
        <div className="hb-card" style={{ marginTop: 16 }}>
          <h2>Propiedades</h2>
          <div className="hb-table-wrap"><table className="hb-table"><tbody>{p.properties.map((x) => (
            <tr key={x.id} className="is-click" onClick={() => onOpenProperty(x.id)}><td><strong>{x.code}</strong></td><td>{x.address}</td><td className="num">{x.share_pct}%</td></tr>))}</tbody></table></div>
        </div>)}
      {p.documents && p.documents.length > 0 && (
        <div className="hb-card" style={{ marginTop: 16 }}>
          <h2>Documentos</h2>
          <div className="hb-table-wrap"><table className="hb-table"><tbody>{p.documents.map((d) => (
            <tr key={d.id}><td><strong>{d.name}</strong></td><td>{DOC_KIND[d.kind] || d.kind}</td><td>{d.expires_on ? `vence ${shortDate(d.expires_on)}` : ""}</td></tr>))}</tbody></table></div>
        </div>)}

      {edit && <PartyFormModal party={p} onClose={() => setEdit(false)} onSaved={() => { setEdit(false); flash.show("Persona guardada"); load(); onChanged(); }} />}
      {anon && (
        <Modal title="Anonimizar a esta persona" eyebrow="LEY 25.326" onClose={() => setAnon(null)} footer={<>
          <button className="secondary-button" onClick={() => setAnon(null)}>Cancelar</button>
          {anon.can && <button className="primary-button" disabled={!confirm} onClick={doAnon}>Anonimizar ahora</button>}</>}>
          {anon.can ? (
            <>
              <p className="hb-muted">Se borran el nombre, el documento, los contactos y los datos bancarios. Los contratos y recibos conservan su historial sin identificar a la persona. <strong>No se puede deshacer.</strong></p>
              {anon.warning && <Note tone="warn">{anon.warning}</Note>}
              <label className="g1-check"><input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} /><span>Entiendo que no se puede deshacer.</span></label>
            </>
          ) : (
            <>
              <Note tone="warn">Por ahora no se puede anonimizar:</Note>
              <ul>{anon.blockers.map((b) => <li key={b} style={{ color: "var(--hb-ink)" }}>{b}</li>)}</ul>
            </>)}
        </Modal>)}
    </div>
  );
}
