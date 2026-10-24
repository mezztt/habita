// Alta y edición de una persona (propietario, inquilino, garante o contacto). El consentimiento (Ley 25.326) queda con fecha y quién lo registró.
import { useState } from "react";
import { appApi, dateTime } from "../../config";
import { Field, Modal, strOrNull, useForm } from "../ui";
import { Check, DOC_TYPES, Note, TAX_CONDITIONS } from "../g1/common";

export interface PartyData {
  id: number; full_name: string; person_type: string; doc_type: string | null; doc_number: string | null; cuit: string | null; tax_condition: string | null;
  email: string | null; phone_area: string | null; phone_number: string | null; address: string | null; city: string | null; province: string | null;
  birth_date: string | null; bank_holder: string | null; bank_cbu: string | null; bank_alias: string | null; notes: string | null;
  is_owner: boolean; is_tenant: boolean; is_guarantor: boolean; is_supplier_contact: boolean; consent_at: string | null; consent_text_version: string | null;
  anonymized_at: string | null; active: boolean; wa_phone?: string | null; has_consent?: boolean;
}

export function PartyFormModal({ party, defaults, onClose, onSaved }: {
  party?: PartyData | null; defaults?: Partial<{ is_owner: boolean; is_tenant: boolean; is_guarantor: boolean }>; onClose: () => void; onSaved: (p: PartyData) => void;
}) {
  const { form, set } = useForm({
    full_name: party?.full_name || "", person_type: party?.person_type || "FISICA", doc_type: party?.doc_type || "DNI", doc_number: party?.doc_number || "",
    cuit: party?.cuit || "", tax_condition: party?.tax_condition || "", email: party?.email || "", phone_area: party?.phone_area || "", phone_number: party?.phone_number || "",
    address: party?.address || "", city: party?.city || "", province: party?.province || "", birth_date: party?.birth_date || "", bank_holder: party?.bank_holder || "",
    bank_cbu: party?.bank_cbu || "", bank_alias: party?.bank_alias || "", notes: party?.notes || "",
    is_owner: party ? party.is_owner : !!defaults?.is_owner, is_tenant: party ? party.is_tenant : !!defaults?.is_tenant,
    is_guarantor: party ? party.is_guarantor : !!defaults?.is_guarantor, is_supplier_contact: party?.is_supplier_contact || false,
    consent: false,
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [bank, setBank] = useState(!!(party?.bank_cbu || party?.bank_alias));

  async function save() {
    setBusy(true); setErr("");
    try {
      const body: Record<string, unknown> = {
        full_name: form.full_name.trim(), person_type: form.person_type, doc_type: strOrNull(form.doc_number) ? form.doc_type : null, doc_number: strOrNull(form.doc_number),
        cuit: strOrNull(form.cuit), tax_condition: strOrNull(form.tax_condition), email: strOrNull(form.email), phone_area: strOrNull(form.phone_area),
        phone_number: strOrNull(form.phone_number), address: strOrNull(form.address), city: strOrNull(form.city), province: strOrNull(form.province),
        birth_date: strOrNull(form.birth_date), bank_holder: strOrNull(form.bank_holder), bank_cbu: strOrNull(form.bank_cbu), bank_alias: strOrNull(form.bank_alias),
        notes: strOrNull(form.notes), is_owner: form.is_owner, is_tenant: form.is_tenant, is_guarantor: form.is_guarantor, is_supplier_contact: form.is_supplier_contact,
      };
      if (form.consent) body.consent = true;
      const saved = await appApi<PartyData>(party ? `/parties/${party.id}` : "/parties", { method: party ? "PUT" : "POST", body });
      onSaved(saved);
    } catch (e) { setErr(e instanceof Error ? e.message : "No se pudo guardar"); } finally { setBusy(false); }
  }

  return (
    <Modal title={party ? "Editar persona" : "Nueva persona"} eyebrow="PERSONAS" size="wide" onClose={onClose} footer={<>
      <button className="secondary-button" onClick={onClose}>Cancelar</button>
      <button className="primary-button" disabled={busy || !form.full_name.trim()} onClick={save}>{busy ? "Guardando..." : "Guardar"}</button></>}>
      {err && <Note tone="error">{err}</Note>}
      <div className="g1-grid">
        <Field label="Nombre y apellido o razón social" wide><input value={form.full_name} onChange={(e) => set("full_name", e.target.value)} autoFocus /></Field>
        <Field label="Tipo de persona"><select value={form.person_type} onChange={(e) => set("person_type", e.target.value)}><option value="FISICA">Persona humana</option><option value="JURIDICA">Persona jurídica (empresa)</option></select></Field>
        <Field label="Condición frente al IVA"><select value={form.tax_condition} onChange={(e) => set("tax_condition", e.target.value)}><option value="">Sin indicar</option>
          {Object.entries(TAX_CONDITIONS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        <Field label="Tipo de documento"><select value={form.doc_type} onChange={(e) => set("doc_type", e.target.value)}>{DOC_TYPES.map((t) => <option key={t}>{t}</option>)}</select></Field>
        <Field label="Número de documento"><input inputMode="numeric" value={form.doc_number} onChange={(e) => set("doc_number", e.target.value)} /></Field>
        <Field label="CUIT / CUIL (si es distinto)"><input inputMode="numeric" value={form.cuit} onChange={(e) => set("cuit", e.target.value)} /></Field>
        <Field label="Fecha de nacimiento"><input type="date" value={form.birth_date} onChange={(e) => set("birth_date", e.target.value)} /></Field>
        <Field label="Email"><input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></Field>
        <Field label="Teléfono (WhatsApp)" hint="Código de área sin 0 y número sin 15: con eso armamos el link de WhatsApp.">
          <div className="hb-row" style={{ flexWrap: "nowrap" }}><input style={{ width: 90 }} inputMode="numeric" placeholder="261" aria-label="Código de área" value={form.phone_area} onChange={(e) => set("phone_area", e.target.value)} />
            <input inputMode="numeric" placeholder="5551234" aria-label="Número" value={form.phone_number} onChange={(e) => set("phone_number", e.target.value)} /></div></Field>
        <Field label="Domicilio" wide><input value={form.address} onChange={(e) => set("address", e.target.value)} /></Field>
        <Field label="Ciudad"><input value={form.city} onChange={(e) => set("city", e.target.value)} /></Field>
        <Field label="Provincia"><input value={form.province} onChange={(e) => set("province", e.target.value)} /></Field>
      </div>
      <p className="hb-form-title">Qué es</p>
      <div className="hb-inline-checks">
        <Check checked={form.is_owner} onChange={(v) => set("is_owner", v)}>Propietario</Check>
        <Check checked={form.is_tenant} onChange={(v) => set("is_tenant", v)}>Inquilino</Check>
        <Check checked={form.is_guarantor} onChange={(v) => set("is_guarantor", v)}>Garante</Check>
        <Check checked={form.is_supplier_contact} onChange={(v) => set("is_supplier_contact", v)}>Contacto de proveedor</Check>
      </div>
      <p className="hb-form-title">Datos bancarios (para pagarle al propietario)</p>
      {!bank ? <button type="button" className="g1-mini" onClick={() => setBank(true)}>Cargar CBU o alias</button> : (
        <div className="g1-grid">
          <Field label="Titular de la cuenta"><input value={form.bank_holder} onChange={(e) => set("bank_holder", e.target.value)} /></Field>
          <Field label="Alias"><input value={form.bank_alias} onChange={(e) => set("bank_alias", e.target.value)} /></Field>
          <Field label="CBU" wide><input inputMode="numeric" value={form.bank_cbu} onChange={(e) => set("bank_cbu", e.target.value)} /></Field>
        </div>)}
      <Field label="Notas internas"><textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
      <p className="hb-form-title">Datos personales (Ley 25.326)</p>
      {party?.consent_at
        ? <p className="hb-muted">Consentimiento registrado el {dateTime(party.consent_at)}{party.consent_text_version ? ` (texto ${party.consent_text_version})` : ""}.</p>
        : <Check checked={form.consent} onChange={(v) => set("consent", v)}>La persona leyó y aceptó cómo usamos sus datos (alquiler, cobranza y contacto). Queda registrada la fecha y quién lo cargó.</Check>}
    </Modal>
  );
}
