// Alta y edición de un documento: se sube el archivo (PDF o foto, hasta 8 MB) y se cargan tipo, número y vencimiento.
import { useEffect, useRef, useState } from "react";
import { API_URL, appApi, appUpload } from "../../config";
import { Field, Modal } from "../ui";
import { Check, DOC_ENTITY, DOC_KIND, Note, todayISO } from "../g1/common";

type Flash = { show: (t: string, e?: boolean) => void; fail: (e: unknown) => void };
interface Opt { id: number; label: string }

async function options(entity: string): Promise<Opt[]> {
  if (entity === "PROPERTY") return (await appApi<{ items: { id: number; code: string; address: string }[] }>("/properties")).items.map((p) => ({ id: p.id, label: `${p.code} · ${p.address}` }));
  if (entity === "PARTY") return (await appApi<{ items: { id: number; full_name: string }[] }>("/parties")).items.map((p) => ({ id: p.id, label: p.full_name }));
  if (entity === "CONTRACT") return (await appApi<{ items: { id: number; number: number; property: { address: string } }[] }>("/contracts")).items.map((c) => ({ id: c.id, label: `Contrato N.º ${c.number} · ${c.property.address}` }));
  if (entity === "GUARANTEE") return (await appApi<{ items: { id: number; kind_label: string; contract: { number: number; address: string } }[] }>("/guarantees")).items.map((g) => ({ id: g.id, label: `${g.kind_label} · contrato N.º ${g.contract.number} · ${g.contract.address}` }));
  return [];
}

export function DocumentModal({ doc, preset, onClose, onDone, flash }: {
  doc?: any | null; preset?: { entity: string; id: number | null } | null; onClose: () => void; onDone: () => void; flash: Flash;
}) {
  const [f, setF] = useState({
    entity_type: doc?.entity_type || preset?.entity || "PROPERTY", entity_id: String(doc?.entity_id || preset?.id || ""), name: doc?.name || "", kind: doc?.kind || "OTRO",
    number: doc?.number || "", issued_on: doc?.issued_on || "", expires_on: doc?.expires_on || "", notes: doc?.notes || "", private: doc ? !!doc.private : true,
  });
  const [fileUrl, setFileUrl] = useState<string | null>(doc?.file_id ? `/files/${doc.file_id}` : null);
  const [fileName, setFileName] = useState<string>(doc?.file_id ? "Archivo cargado" : "");
  const [opts, setOpts] = useState<Opt[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const set = (k: keyof typeof f, v: any) => setF((x) => ({ ...x, [k]: v }));
  const locked = !!doc;

  useEffect(() => { options(f.entity_type).then(setOpts).catch(() => setOpts([])); }, [f.entity_type]);

  async function pick(file: File | undefined) {
    if (!file) return;
    setBusy(true); setErr("");
    try {
      const form = new FormData();
      form.append("file", file, file.name);
      const r = await appUpload<{ file_url: string }>("/files", form);
      setFileUrl(r.file_url); setFileName(file.name);
      if (!f.name.trim()) set("name", file.name.replace(/\.\w+$/, ""));
    } catch (e) { setErr(e instanceof Error ? e.message : "No se pudo subir el archivo"); } finally { setBusy(false); if (input.current) input.current.value = ""; }
  }
  async function save() {
    setBusy(true); setErr("");
    try {
      const body: Record<string, unknown> = {
        entity_type: f.entity_type, entity_id: f.entity_type === "AGENCY" ? null : Number(f.entity_id) || null, name: f.name.trim(), kind: f.kind, number: f.number.trim() || null,
        issued_on: f.issued_on || null, expires_on: f.expires_on || null, file_url: fileUrl, private: f.private, notes: f.notes.trim() || null,
      };
      await appApi(doc ? `/documents/${doc.id}` : "/documents", { method: doc ? "PUT" : "POST", body });
      flash.show("Documento guardado"); onDone();
    } catch (e) { setErr(e instanceof Error ? e.message : "No se pudo guardar"); } finally { setBusy(false); }
  }
  const matricula = f.kind === "MATRICULA";

  return (
    <Modal title={doc ? "Editar el documento" : "Nuevo documento"} eyebrow="DOCUMENTOS" size="wide" onClose={onClose} footer={<>
      <button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={busy || !f.name.trim()} onClick={save}>{busy ? "Un momento..." : "Guardar"}</button></>}>
      {err && <Note tone="error">{err}</Note>}
      <div className="g1-import-drop" style={{ marginBottom: 12 }}>
        <input ref={input} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" aria-label="Archivo del documento" onChange={(e) => pick(e.target.files?.[0])} />
        <p className="hb-hint" style={{ margin: "8px 0 0" }}>PDF o foto (JPG, PNG, WEBP), hasta 8 MB. {fileName && <strong style={{ color: "var(--hb-ink)" }}>{fileName}</strong>}
          {doc?.file_path && <> <a href={API_URL + doc.file_path} target="_blank" rel="noopener noreferrer">Ver el actual</a></>}</p>
      </div>
      <div className="g1-grid">
        <Field label="Pertenece a"><select value={f.entity_type} disabled={locked} onChange={(e) => { set("entity_type", e.target.value); set("entity_id", ""); }}>
          {Object.entries(DOC_ENTITY).filter(([k]) => k !== "SETTLEMENT" || f.entity_type === "SETTLEMENT").map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        {f.entity_type !== "AGENCY" && f.entity_type !== "SETTLEMENT" && (
          <Field label={DOC_ENTITY[f.entity_type]}><select value={f.entity_id} disabled={locked} onChange={(e) => set("entity_id", e.target.value)}><option value="">Elegí una opción</option>{opts.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}</select></Field>)}
        <Field label="Nombre" wide><input value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="Por ejemplo: Escritura, póliza de incendio" /></Field>
        <Field label="Tipo"><select value={f.kind} onChange={(e) => set("kind", e.target.value)}>{Object.entries(DOC_KIND).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        <Field label="Número"><input value={f.number} onChange={(e) => set("number", e.target.value)} /></Field>
        <Field label="Emitido el"><input type="date" max={todayISO()} value={f.issued_on} onChange={(e) => set("issued_on", e.target.value)} /></Field>
        <Field label={matricula ? "Vence el (obligatorio)" : "Vence el (si vence)"} hint="Con esta fecha te avisamos 30 días antes."><input type="date" value={f.expires_on} onChange={(e) => set("expires_on", e.target.value)} /></Field>
      </div>
      <Field label="Notas"><input value={f.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
      <Check checked={f.private} onChange={(v) => set("private", v)}>Documento privado (solo lo ve el equipo; nada se publica)</Check>
    </Modal>
  );
}
