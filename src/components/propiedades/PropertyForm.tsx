// Alta y edición de una propiedad, con sus propietarios y porcentajes (la suma tiene que dar 100).
import { useEffect, useState } from "react";
import { appApi, getSessionUser } from "../../config";
import { Field, Modal, numOrNull, strOrNull, useForm } from "../ui";
import { Note, OPERATION_LABEL, PROPERTY_KIND, numText, toNum } from "../g1/common";
import { PartyFormModal } from "./PartyForm";
import type { PartyData } from "./PartyForm";

export interface OwnerRow { party_id: number; full_name?: string; share_pct: number; is_billing_contact: boolean }
export interface PropertyData {
  id: number; code: string; kind: string; address: string; floor_unit: string | null; neighborhood: string | null; city: string | null; province: string | null;
  postal_code: string | null; rooms: number | null; bedrooms: number | null; bathrooms: number | null; m2_covered: number | null; m2_total: number | null;
  amenities: string[]; status: string; operation: string; list_price: number | null; list_currency: string | null; expensas_estimate: number | null;
  description: string | null; published: boolean; cadastral_ref: string | null; keys_location: string | null; notes: string | null; active: boolean;
  owners: OwnerRow[]; cover_url: string | null; photos_count: number;
}

export function PropertyFormModal({ property, onClose, onSaved }: { property?: PropertyData | null; onClose: () => void; onSaved: (id: number) => void }) {
  const user = getSessionUser();
  const canOwners = ["ADMINISTRADOR", "ENCARGADO"].includes(user?.role || "");
  const p = property;
  const { form, set } = useForm({
    code: p?.code || "", kind: p?.kind || "DEPARTAMENTO", address: p?.address || "", floor_unit: p?.floor_unit || "", neighborhood: p?.neighborhood || "",
    city: p?.city || "", province: p?.province || "", postal_code: p?.postal_code || "", rooms: p?.rooms?.toString() || "", bedrooms: p?.bedrooms?.toString() || "",
    bathrooms: p?.bathrooms?.toString() || "", m2_covered: numText(p?.m2_covered), m2_total: numText(p?.m2_total), amenities: (p?.amenities || []).join(", "),
    operation: p?.operation || "ALQUILER", list_price: numText(p?.list_price), list_currency: p?.list_currency || "ARS", expensas_estimate: numText(p?.expensas_estimate),
    description: p?.description || "", cadastral_ref: p?.cadastral_ref || "", keys_location: p?.keys_location || "", notes: p?.notes || "",
  });
  const [owners, setOwners] = useState<OwnerRow[]>(p?.owners?.length ? p.owners.map((o) => ({ ...o })) : []);
  const [people, setPeople] = useState<{ id: number; full_name: string }[]>([]);
  const [newPerson, setNewPerson] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => { if (canOwners) appApi<{ items: { id: number; full_name: string }[] }>("/parties?active=true").then((r) => setPeople(r.items)).catch(() => undefined); }, [canOwners]);

  const total = owners.reduce((s, o) => s + (Number(o.share_pct) || 0), 0);
  function setOwner(i: number, patch: Partial<OwnerRow>) { setOwners((os) => os.map((o, j) => (j === i ? { ...o, ...patch } : o))); }

  async function save() {
    setErr("");
    if (canOwners && owners.length) {
      if (owners.some((o) => !(Number(o.share_pct) > 0))) return setErr("Cada propietario tiene que tener un porcentaje mayor a 0 (o quitá la fila)");
      if (owners.some((o) => !o.party_id)) return setErr("Elegí la persona en cada fila de propietarios (o quitá la fila vacía)");
      if (Math.abs(total - 100) > 0.01) return setErr(`Los porcentajes suman ${total}% y tienen que dar 100%`);
    }
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        code: strOrNull(form.code), kind: form.kind, address: form.address.trim(), floor_unit: strOrNull(form.floor_unit), neighborhood: strOrNull(form.neighborhood),
        city: strOrNull(form.city), province: strOrNull(form.province), postal_code: strOrNull(form.postal_code), rooms: numOrNull(form.rooms), bedrooms: numOrNull(form.bedrooms),
        bathrooms: numOrNull(form.bathrooms), m2_covered: toNum(form.m2_covered), m2_total: toNum(form.m2_total),
        amenities: form.amenities.split(",").map((s) => s.trim()).filter(Boolean), operation: form.operation, list_price: toNum(form.list_price),
        list_currency: form.list_currency, expensas_estimate: toNum(form.expensas_estimate), description: strOrNull(form.description), cadastral_ref: strOrNull(form.cadastral_ref),
        keys_location: strOrNull(form.keys_location), notes: strOrNull(form.notes),
      };
      if (canOwners && owners.length) body.owners = owners.map((o) => ({ party_id: o.party_id, share_pct: Number(o.share_pct), is_billing_contact: o.is_billing_contact }));
      const saved = await appApi<{ id: number }>(p ? `/properties/${p.id}` : "/properties", { method: p ? "PUT" : "POST", body });
      onSaved(saved.id);
    } catch (e) { setErr(e instanceof Error ? e.message : "No se pudo guardar"); } finally { setBusy(false); }
  }

  return (
    <Modal title={p ? `Editar ${p.code}` : "Nueva propiedad"} eyebrow="PROPIEDADES" size="xl" onClose={onClose} footer={<>
      <button className="secondary-button" onClick={onClose}>Cancelar</button>
      <button className="primary-button" disabled={busy || !form.address.trim()} onClick={save}>{busy ? "Guardando..." : "Guardar"}</button></>}>
      {err && <Note tone="error">{err}</Note>}
      <div className="g1-grid">
        <Field label="Tipo"><select value={form.kind} onChange={(e) => set("kind", e.target.value)}>{Object.entries(PROPERTY_KIND).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        <Field label="Código" hint="Si lo dejás vacío se arma solo (P-0001, P-0002...)."><input value={form.code} onChange={(e) => set("code", e.target.value)} placeholder="Automático" /></Field>
        <Field label="Dirección" wide><input value={form.address} onChange={(e) => set("address", e.target.value)} autoFocus placeholder="Calle y número" /></Field>
        <Field label="Piso / unidad"><input value={form.floor_unit} onChange={(e) => set("floor_unit", e.target.value)} placeholder="3.º B" /></Field>
        <Field label="Barrio"><input value={form.neighborhood} onChange={(e) => set("neighborhood", e.target.value)} /></Field>
        <Field label="Ciudad"><input value={form.city} onChange={(e) => set("city", e.target.value)} /></Field>
        <Field label="Provincia"><input value={form.province} onChange={(e) => set("province", e.target.value)} /></Field>
        <Field label="Código postal"><input value={form.postal_code} onChange={(e) => set("postal_code", e.target.value)} /></Field>
        <Field label="Datos catastrales / matrícula"><input value={form.cadastral_ref} onChange={(e) => set("cadastral_ref", e.target.value)} /></Field>
      </div>
      <p className="hb-form-title">Características</p>
      <div className="g1-grid3">
        <Field label="Ambientes"><input inputMode="numeric" value={form.rooms} onChange={(e) => set("rooms", e.target.value)} /></Field>
        <Field label="Dormitorios"><input inputMode="numeric" value={form.bedrooms} onChange={(e) => set("bedrooms", e.target.value)} /></Field>
        <Field label="Baños"><input inputMode="numeric" value={form.bathrooms} onChange={(e) => set("bathrooms", e.target.value)} /></Field>
        <Field label="m² cubiertos"><input inputMode="decimal" value={form.m2_covered} onChange={(e) => set("m2_covered", e.target.value)} /></Field>
        <Field label="m² totales"><input inputMode="decimal" value={form.m2_total} onChange={(e) => set("m2_total", e.target.value)} /></Field>
        <Field label="Expensas aproximadas"><input inputMode="decimal" value={form.expensas_estimate} onChange={(e) => set("expensas_estimate", e.target.value)} /></Field>
      </div>
      <Field label="Comodidades" hint="Separadas por coma: balcón, cochera, aire acondicionado."><input value={form.amenities} onChange={(e) => set("amenities", e.target.value)} /></Field>
      <Field label="Descripción"><textarea rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} /></Field>
      <p className="hb-form-title">Operación y precio de lista</p>
      <div className="g1-grid3">
        <Field label="Operación"><select value={form.operation} onChange={(e) => set("operation", e.target.value)}>{Object.entries(OPERATION_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        <Field label="Precio"><input inputMode="decimal" value={form.list_price} onChange={(e) => set("list_price", e.target.value)} /></Field>
        <Field label="Moneda"><select value={form.list_currency} onChange={(e) => set("list_currency", e.target.value)}><option value="ARS">Pesos</option><option value="USD">Dólares</option></select></Field>
      </div>
      <div className="g1-grid">
        <Field label="Dónde están las llaves"><input value={form.keys_location} onChange={(e) => set("keys_location", e.target.value)} /></Field>
        <Field label="Notas internas"><input value={form.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
      </div>
      {canOwners && (
        <>
          <p className="hb-form-title">Propietarios</p>
          {owners.map((o, i) => (
            <div key={i} className="g1-owner-row">
              <select aria-label="Propietario" value={o.party_id || ""} onChange={(e) => setOwner(i, { party_id: Number(e.target.value) })}>
                <option value="">Elegí una persona</option>{people.map((x) => <option key={x.id} value={x.id}>{x.full_name}</option>)}</select>
              <input aria-label="Porcentaje" inputMode="decimal" value={o.share_pct} onChange={(e) => setOwner(i, { share_pct: Number(e.target.value.replace(",", ".")) || 0 })} />
              <button type="button" className="g1-mini is-danger" aria-label="Quitar propietario" onClick={() => setOwners((os) => os.filter((_, j) => j !== i))}>×</button>
            </div>))}
          <div className="hb-row">
            <button type="button" className="g1-mini" onClick={() => setOwners((os) => [...os, { party_id: 0, share_pct: os.length ? 0 : 100, is_billing_contact: os.length === 0 }])}>Agregar propietario</button>
            <button type="button" className="g1-mini" onClick={() => setNewPerson(true)}>Nueva persona</button>
            {owners.length > 0 && <span className={Math.abs(total - 100) > 0.01 ? "g1-late" : "g1-ok"}>Suman {total}%</span>}
          </div>
        </>)}
      {newPerson && <PartyFormModal defaults={{ is_owner: true }} onClose={() => setNewPerson(false)} onSaved={(np: PartyData) => {
        setPeople((ps) => [...ps, { id: np.id, full_name: np.full_name }]);
        setOwners((os) => [...os.filter((o) => o.party_id), { party_id: np.id, share_pct: os.filter((o) => o.party_id).length ? 0 : 100, is_billing_contact: os.filter((o) => o.party_id).length === 0 }]);
        setNewPerson(false);
      }} />}
    </Modal>
  );
}
