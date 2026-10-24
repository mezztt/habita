// Pantalla «Propiedades» (núcleo, grupo G1): padrón de propiedades, personas (propietarios, inquilinos, garantes) e importador de planillas.
// Backend: backend/routes/propiedades.py. La ficha de cada propiedad o persona vive dentro de esta misma pantalla (?id= / ?persona=).
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { API_URL, appApi, getSessionUser, moneyIn, phoneText } from "../../../config";
import { Empty, Loading, PageHeader, Pill, Tabs, useFlash, useRefreshKey } from "../../../components/ui";
import { PROPERTY_KIND, PROPERTY_STATUS } from "../../../components/g1/common";
import { PropertyFormModal } from "../../../components/propiedades/PropertyForm";
import type { PropertyData } from "../../../components/propiedades/PropertyForm";
import { PropertyFicha } from "../../../components/propiedades/PropertyFicha";
import { PartyFormModal } from "../../../components/propiedades/PartyForm";
import type { PartyData } from "../../../components/propiedades/PartyForm";
import { PartyFicha } from "../../../components/propiedades/PartyFicha";
import { Importar } from "../../../components/propiedades/Importar";
import "../../../g1.css";

interface PropRow extends PropertyData { contract: { id: number; number: number; status: string; end_date: string; days_left: number; tenant: string | null; current_rent: number | null; currency: string } | null }
interface PartyRow extends PartyData { properties?: number; contracts_as_tenant?: number; contracts_as_guarantor?: number }
type Tab = "propiedades" | "personas" | "importar";

function PropiedadesPage() {
  const user = getSessionUser();
  const [params, setParams] = useSearchParams();
  const refreshKey = useRefreshKey();
  const flash = useFlash();
  const role = user?.role || "";
  const canWrite = ["ADMINISTRADOR", "ENCARGADO", "AGENTE"].includes(role);
  const manage = ["ADMINISTRADOR", "ENCARGADO"].includes(role);
  const propId = Number(params.get("id")) || null;
  const partyId = Number(params.get("persona")) || null;
  const [tab, setTab] = useState<Tab>((params.get("tab") as Tab) || (partyId ? "personas" : "propiedades"));
  const [props, setProps] = useState<{ items: PropRow[]; counts: Record<string, number>; restricted: boolean } | null>(null);
  const [parties, setParties] = useState<{ items: PartyRow[]; restricted: boolean } | null>(null);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [role2, setRole2] = useState("");
  const [newProp, setNewProp] = useState(false);
  const [newParty, setNewParty] = useState(false);

  const loadProps = useCallback(() => {
    const qs = new URLSearchParams();
    if (status) qs.set("status", status);
    if (q.trim()) qs.set("q", q.trim());
    appApi<{ items: PropRow[]; counts: Record<string, number>; restricted: boolean }>(`/properties?${qs}`).then(setProps).catch(flash.fail);
  }, [status, q, flash.fail]);
  const loadParties = useCallback(() => {
    const qs = new URLSearchParams();
    if (q.trim()) qs.set("q", q.trim());
    if (role2) qs.set(role2, "true");
    appApi<{ items: PartyRow[]; restricted: boolean }>(`/parties?${qs}`).then(setParties).catch(flash.fail);
  }, [q, role2, flash.fail]);
  useEffect(() => { const t = window.setTimeout(loadProps, 200); return () => window.clearTimeout(t); }, [loadProps, refreshKey]);
  useEffect(() => { if (tab === "personas") { const t = window.setTimeout(loadParties, 200); return () => window.clearTimeout(t); } }, [loadParties, tab, refreshKey]);

  function open(key: "id" | "persona", id: number | null) {
    const next = new URLSearchParams(params);
    next.delete("id"); next.delete("persona");
    if (id) next.set(key, String(id));
    setParams(next, { replace: false });
  }
  function changeTab(t: Tab) { setTab(t); setQ(""); const next = new URLSearchParams(); if (t !== "propiedades") next.set("tab", t); setParams(next); }

  const totalCount = useMemo(() => Object.values(props?.counts || {}).reduce((a, b) => a + b, 0), [props]);

  if (propId) return <section className="products-page">{flash.node}<PropertyFicha id={propId} onBack={() => open("id", null)} onChanged={loadProps} flash={flash} /></section>;
  if (partyId) return <section className="products-page">{flash.node}<PartyFicha id={partyId} onBack={() => open("persona", null)} onChanged={loadParties} onOpenProperty={(id) => open("id", id)} flash={flash} /></section>;

  return (
    <section className="products-page">
      <PageHeader eyebrow="PROPIEDADES" title="Propiedades y personas" subtitle="El padrón de la inmobiliaria: propiedades, propietarios, inquilinos y garantes.">
        {tab === "propiedades" && canWrite && <button className="primary-button" onClick={() => setNewProp(true)} data-tour="propiedad-nueva">Nueva propiedad</button>}
        {tab === "personas" && manage && <button className="primary-button" onClick={() => setNewParty(true)}>Nueva persona</button>}
      </PageHeader>
      {flash.node}
      <Tabs<Tab> value={tab} onChange={changeTab} options={[["propiedades", "Propiedades"], ["personas", "Personas"], ...(manage ? [["importar", "Importar"] as [Tab, string]] : [])]} />

      {tab === "propiedades" && (
        <>
          <div className="g1-filters">
            <input type="search" placeholder="Buscar por dirección, código, barrio o propietario" aria-label="Buscar propiedades" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="hb-seg">
              <button className={status === "" ? "is-on" : ""} onClick={() => setStatus("")}>Todas ({totalCount})</button>
              {Object.entries(PROPERTY_STATUS).map(([k, [l]]) => <button key={k} className={status === k ? "is-on" : ""} onClick={() => setStatus(k)}>{l} ({props?.counts[k] || 0})</button>)}
            </div>
          </div>
          {!props ? <Loading /> : props.items.length === 0 ? (
            <Empty title={totalCount ? "Ninguna propiedad con ese filtro" : "Todavía no cargaste propiedades"}>
              {totalCount ? "Probá con otra búsqueda." : (canWrite ? "Cargá la primera, o importá tu planilla desde la pestaña Importar." : "")}</Empty>
          ) : (
            <div className="g1-prop-cards">
              {props.items.map((p) => {
                const [stLabel, stTone] = PROPERTY_STATUS[p.status] || [p.status, "gray"];
                return (
                  <button key={p.id} className="g1-prop-card" onClick={() => open("id", p.id)}>
                    <div className="g1-prop-cover">{p.cover_url ? <img src={API_URL + p.cover_url} alt="" loading="lazy" /> : <span>Sin foto</span>}</div>
                    <div className="g1-prop-body">
                      <div className="hb-row" style={{ justifyContent: "space-between", flexWrap: "nowrap" }}><strong>{p.address}{p.floor_unit ? `, ${p.floor_unit}` : ""}</strong><Pill tone={stTone}>{stLabel}</Pill></div>
                      <small>{p.code} · {PROPERTY_KIND[p.kind] || p.kind}{p.neighborhood ? ` · ${p.neighborhood}` : ""}</small>
                      <small>{p.owners.length ? p.owners.map((o) => o.full_name).join(", ") : "Sin propietario cargado"}</small>
                      {p.contract && <small>Contrato N.º {p.contract.number}{p.contract.tenant ? ` · ${p.contract.tenant}` : ""}{p.contract.current_rent !== null ? ` · ${moneyIn(p.contract.current_rent, p.contract.currency)}` : ""}</small>}
                    </div>
                  </button>);
              })}
            </div>)}
        </>)}

      {tab === "personas" && (
        <>
          <div className="g1-filters">
            <input type="search" placeholder="Buscar por nombre, documento, email o teléfono" aria-label="Buscar personas" value={q} onChange={(e) => setQ(e.target.value)} />
            <div className="hb-seg">
              {([["", "Todas"], ["is_owner", "Propietarios"], ["is_tenant", "Inquilinos"], ["is_guarantor", "Garantes"]] as [string, string][]).map(([k, l]) => (
                <button key={k} className={role2 === k ? "is-on" : ""} onClick={() => setRole2(k)}>{l}</button>))}
            </div>
          </div>
          {!parties ? <Loading /> : parties.items.length === 0 ? <Empty title="No hay personas con ese filtro">{manage ? "Cargá una con «Nueva persona»." : ""}</Empty> : (
            <div className="hb-table-wrap"><table className="hb-table">
              <thead><tr><th>Nombre</th><th>Es</th>{!parties.restricted && <><th>Documento</th><th>Contacto</th><th className="num">Propiedades / contratos</th></>}</tr></thead>
              <tbody>{parties.items.map((p) => (
                <tr key={p.id} className="is-click" onClick={() => open("persona", p.id)}>
                  <td><strong>{p.full_name}</strong>{!p.active && <small>Inactiva</small>}{p.anonymized_at && <small>Anonimizada</small>}</td>
                  <td><div className="g1-chips">{p.is_owner && <span className="hb-chip">Propietario</span>}{p.is_tenant && <span className="hb-chip">Inquilino</span>}{p.is_guarantor && <span className="hb-chip">Garante</span>}</div></td>
                  {!parties.restricted && <>
                    <td>{p.doc_number ? `${p.doc_type || ""} ${p.doc_number}` : "—"}{!p.has_consent && <small className="g1-warn">Sin consentimiento</small>}</td>
                    <td>{p.email || "—"}<small>{phoneText(p.phone_area, p.phone_number)}</small></td>
                    <td className="num">{p.properties || 0} prop. · {(p.contracts_as_tenant || 0) + (p.contracts_as_guarantor || 0)} contr.</td></>}
                </tr>))}</tbody></table></div>)}
        </>)}

      {tab === "importar" && manage && <Importar flash={flash} onDone={() => { loadProps(); loadParties(); }} />}

      {newProp && <PropertyFormModal onClose={() => setNewProp(false)} onSaved={(id) => { setNewProp(false); flash.show("Propiedad creada"); loadProps(); open("id", id); }} />}
      {newParty && <PartyFormModal onClose={() => setNewParty(false)} onSaved={() => { setNewParty(false); flash.show("Persona creada"); loadParties(); }} />}
    </section>
  );
}

export default PropiedadesPage;
