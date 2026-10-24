// Ficha de una propiedad: Datos, Propietarios, Fotos, Contrato actual, Historial y Documentos.
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { appApi, canAccess, getSessionUser, moneyIn, shortDate } from "../../config";
import { Empty, Loading, Pill, Tabs, Switch } from "../ui";
import { PhotoGrid, PhotoUploader } from "../g3/common";
import type { PhotoItem } from "../g3/common";
import { CONTRACT_STATUS, DOC_KIND, Note, OPERATION_LABEL, PROPERTY_KIND, PROPERTY_STATUS, tonePill } from "../g1/common";
import { PropertyFormModal } from "./PropertyForm";
import type { PropertyData } from "./PropertyForm";

interface ContractRow { id: number; number: number; status: string; start_date: string; end_date: string; tenant: string | null; current_rent: number | null; currency: string }
interface Full extends PropertyData {
  photos: (PhotoItem & { is_cover: boolean; file_url: string })[]; contracts: ContractRow[]; current_contract: ContractRow | null;
  documents?: { id: number; name: string; kind: string; expires_on: string | null; file_url: string | null }[]; restricted: boolean; modules: string[];
}
type Tab = "datos" | "propietarios" | "fotos" | "contrato" | "historial" | "documentos";

export function PropertyFicha({ id, onBack, onChanged, flash }: {
  id: number; onBack: () => void; onChanged: () => void; flash: { show: (t: string, e?: boolean) => void; fail: (e: unknown) => void };
}) {
  const user = getSessionUser();
  const nav = useNavigate();
  const [p, setP] = useState<Full | null>(null);
  const [tab, setTab] = useState<Tab>("datos");
  const [edit, setEdit] = useState(false);
  const readOnly = !["ADMINISTRADOR", "ENCARGADO", "AGENTE"].includes(user?.role || "");
  const manage = ["ADMINISTRADOR", "ENCARGADO"].includes(user?.role || "");
  const load = useCallback(() => { appApi<Full>(`/properties/${id}`).then(setP).catch(flash.fail); }, [id, flash.fail]);
  useEffect(load, [load]);
  if (!p) return <Loading />;

  const has = (m: string) => p.modules.includes(m);
  const [stLabel, stTone] = PROPERTY_STATUS[p.status] || [p.status, "gray"];

  async function setStatus(status: string) {
    try { await appApi(`/properties/${id}/status`, { method: "PATCH", body: { status } }); flash.show("Estado actualizado"); load(); onChanged(); } catch (e) { flash.fail(e); }
  }
  async function togglePublish(v: boolean) {
    try { await appApi(`/properties/${id}`, { method: "PUT", body: { published: v } }); flash.show(v ? "La propiedad se publica en tu web" : "La propiedad ya no se publica"); load(); onChanged(); } catch (e) { flash.fail(e); }
  }
  async function addPhoto(file_url: string) { await appApi(`/properties/${id}/photos`, { method: "POST", body: { file_url } }); load(); onChanged(); }
  async function removePhoto(ph: PhotoItem) {
    try { await appApi(`/properties/${id}/photos/${ph.id}`, { method: "DELETE" }); load(); onChanged(); } catch (e) { flash.fail(e); }
  }
  async function makeCover(ph: PhotoItem) {
    try { await appApi(`/properties/${id}/photos/${ph.id}`, { method: "PATCH", body: { is_cover: true } }); load(); } catch (e) { flash.fail(e); }
  }

  const tabs: [Tab, string][] = [["datos", "Datos"], ["propietarios", "Propietarios"], ["fotos", `Fotos (${p.photos.length})`], ["contrato", "Contrato actual"], ["historial", "Historial"]];
  if (p.documents) tabs.push(["documentos", "Documentos"]);

  return (
    <div>
      <button className="g1-back" onClick={onBack}>← Volver a propiedades</button>
      <div className="g1-ficha-head">
        <div>
          <h2>{p.address}{p.floor_unit ? `, ${p.floor_unit}` : ""}</h2>
          <div className="hb-row"><Pill tone="gray">{p.code}</Pill><Pill tone={stTone}>{stLabel}</Pill><span className="hb-muted">{PROPERTY_KIND[p.kind] || p.kind}{p.neighborhood ? ` · ${p.neighborhood}` : ""}{p.city ? ` · ${p.city}` : ""}</span></div>
        </div>
        {!readOnly && <div className="g1-actions">
          <button className="secondary-button" onClick={() => setEdit(true)}>Editar</button>
          {manage && canAccess(user, "contratos") && !p.current_contract && p.active && <button className="primary-button" onClick={() => nav(`/app/contratos?nuevo=1&propiedad=${p.id}`)}>Nuevo contrato</button>}
        </div>}
      </div>
      <Tabs<Tab> value={tab} onChange={setTab} options={tabs} />

      {tab === "datos" && (
        <div className="hb-card">
          <dl className="g1-kv">
            <dt>Operación</dt><dd>{OPERATION_LABEL[p.operation] || p.operation}</dd>
            <dt>Precio de lista</dt><dd>{p.list_price ? moneyIn(p.list_price, p.list_currency) : "—"}</dd>
            <dt>Ambientes</dt><dd>{p.rooms ?? "—"} (dormitorios {p.bedrooms ?? "—"}, baños {p.bathrooms ?? "—"})</dd>
            <dt>Superficie</dt><dd>{p.m2_covered ? `${p.m2_covered} m² cubiertos` : "—"}{p.m2_total ? ` · ${p.m2_total} m² totales` : ""}</dd>
            <dt>Expensas aprox.</dt><dd>{p.expensas_estimate ? moneyIn(p.expensas_estimate, "ARS") : "—"}</dd>
            <dt>Comodidades</dt><dd>{p.amenities.length ? p.amenities.join(", ") : "—"}</dd>
            <dt>Datos catastrales</dt><dd>{p.cadastral_ref || "—"}</dd>
            <dt>Llaves</dt><dd>{p.keys_location || "—"}</dd>
            <dt>Descripción</dt><dd>{p.description || "—"}</dd>
            <dt>Notas internas</dt><dd>{p.notes || "—"}</dd>
          </dl>
          {!readOnly && (
            <>
              <p className="g1-section">Estado</p>
              <div className="hb-row">
                <select aria-label="Estado de la propiedad" value={p.status} onChange={(e) => setStatus(e.target.value)} disabled={p.status === "ALQUILADA"}>
                  {Object.entries(PROPERTY_STATUS).filter(([k]) => k !== "ALQUILADA" || p.status === "ALQUILADA").map(([k, [l]]) => <option key={k} value={k}>{l}</option>)}
                </select>
                {p.status === "ALQUILADA" && <span className="hb-hint">Pasa a «Alquilada» sola al activar un contrato, y vuelve a «Disponible» al terminarlo.</span>}
              </div>
              {has("web_propiedades") && <div style={{ marginTop: 14 }}><Switch on={p.published} onChange={togglePublish} label="Publicar en la web de la inmobiliaria" hint="Solo se publica si la operación no es «No se publica» y la propiedad está activa." /></div>}
            </>)}
        </div>)}

      {tab === "propietarios" && (
        <div className="hb-card">
          {p.owners.length === 0 ? <Empty title="Todavía no cargaste propietarios">{manage && <button className="primary-button" onClick={() => setEdit(true)}>Cargar propietarios</button>}</Empty> : (
            <div className="hb-table-wrap"><table className="hb-table">
              <thead><tr><th>Propietario</th><th className="num">Porcentaje</th><th>Contacto</th><th /></tr></thead>
              <tbody>{p.owners.map((o: any) => (
                <tr key={o.party_id}>
                  <td><strong>{o.full_name}</strong>{o.is_billing_contact && <small>Contacto de las liquidaciones</small>}</td>
                  <td className="num">{o.share_pct}%</td>
                  <td>{o.phone_number ? `(${o.phone_area}) ${o.phone_number}` : "—"}</td>
                  <td className="num">{o.wa_phone && <a className="g1-mini" href={`https://wa.me/${o.wa_phone}`} target="_blank" rel="noopener noreferrer" aria-label={`Escribirle a ${o.full_name} por WhatsApp`}>WhatsApp</a>}</td>
                </tr>))}</tbody></table></div>)}
          {manage && p.owners.length > 0 && <div style={{ marginTop: 12 }}><button className="secondary-button" onClick={() => setEdit(true)}>Cambiar propietarios</button></div>}
        </div>)}

      {tab === "fotos" && (
        <div className="hb-card">
          {!readOnly && <PhotoUploader onFile={addPhoto} label="Sacar foto" />}
          {p.photos.length === 0 ? <Empty title="Sin fotos">Las fotos se muestran en la ficha y, si publicás la propiedad, en tu web.</Empty> : (
            <PhotoGrid photos={p.photos} onRemove={readOnly ? undefined : removePhoto}
              onCaption={readOnly ? undefined : (ph) => ((ph as any).is_cover ? <span className="hb-chip">Portada</span> : <button type="button" className="g1-mini" onClick={() => makeCover(ph)}>Hacer portada</button>)} />)}
        </div>)}

      {tab === "contrato" && (
        <div className="hb-card">
          {!p.current_contract ? (
            <Empty title="No tiene un contrato vigente">
              {canAccess(user, "contratos") ? (manage && p.active ? <button className="primary-button" onClick={() => nav(`/app/contratos?nuevo=1&propiedad=${p.id}`)}>Crear contrato</button> : null)
                : <p className="hb-muted">El módulo de contratos no está contratado.</p>}
            </Empty>) : (
            <dl className="g1-kv">
              <dt>Contrato</dt><dd><strong>N.º {p.current_contract.number}</strong> {tonePill(CONTRACT_STATUS, p.current_contract.status)}</dd>
              <dt>Inquilino</dt><dd>{p.current_contract.tenant || "—"}</dd>
              <dt>Plazo</dt><dd>{shortDate(p.current_contract.start_date)} al {shortDate(p.current_contract.end_date)}</dd>
              {p.current_contract.current_rent !== null && <><dt>Canon actual</dt><dd>{moneyIn(p.current_contract.current_rent, p.current_contract.currency)}</dd></>}
              <dt /><dd>{canAccess(user, "contratos") && <Link className="primary-button" to={`/app/contratos?id=${p.current_contract.id}`}>Abrir el contrato</Link>}</dd>
            </dl>)}
        </div>)}

      {tab === "historial" && (
        <div className="hb-card">
          {p.contracts.length === 0 ? <Empty title="Sin contratos">Cuando alquiles la propiedad, el historial queda acá.</Empty> : (
            <div className="hb-table-wrap"><table className="hb-table">
              <thead><tr><th>Contrato</th><th>Inquilino</th><th>Plazo</th><th className="num">Canon</th><th>Estado</th></tr></thead>
              <tbody>{p.contracts.map((c) => (
                <tr key={c.id} className={canAccess(user, "contratos") ? "is-click" : ""} onClick={() => canAccess(user, "contratos") && nav(`/app/contratos?id=${c.id}`)}>
                  <td><strong>N.º {c.number}</strong></td><td>{c.tenant || "—"}</td><td>{shortDate(c.start_date)} al {shortDate(c.end_date)}</td>
                  <td className="num">{c.current_rent !== null ? moneyIn(c.current_rent, c.currency) : "—"}</td><td>{tonePill(CONTRACT_STATUS, c.status)}</td></tr>))}</tbody></table></div>)}
        </div>)}

      {tab === "documentos" && p.documents && (
        <div className="hb-card">
          {p.documents.length === 0 ? <Empty title="Sin documentos">Escritura, planos, habilitaciones, pólizas.</Empty> : (
            <div className="hb-table-wrap"><table className="hb-table">
              <thead><tr><th>Documento</th><th>Tipo</th><th>Vence</th></tr></thead>
              <tbody>{p.documents.map((d) => <tr key={d.id}><td><strong>{d.name}</strong></td><td>{DOC_KIND[d.kind] || d.kind}</td><td>{d.expires_on ? shortDate(d.expires_on) : "—"}</td></tr>)}</tbody></table></div>)}
          {canAccess(user, "documentos") && <div style={{ marginTop: 12 }}><Link className="secondary-button" to={`/app/documentos?entidad=PROPERTY&entidad_id=${p.id}${manage ? "&nuevo=1" : ""}`}>{manage ? "Subir un documento" : "Ver en Documentos"}</Link></div>}
        </div>)}
      {p.restricted && <Note>Estás viendo la versión resumida: no incluye datos de contacto ni importes.</Note>}

      {edit && <PropertyFormModal property={p} onClose={() => setEdit(false)} onSaved={() => { setEdit(false); flash.show("Propiedad guardada"); load(); onChanged(); }} />}
    </div>
  );
}
