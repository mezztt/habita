// Piezas compartidas por las pantallas del grupo G3: reparaciones, inspecciones, interesados y visitas.
import { useRef, useState } from "react";
import type { ReactNode } from "react";
import { API_URL, appUpload } from "../../config";
import { Modal } from "../ui";

// ---------------------------------------------------------------- etiquetas y colores
export const MAINT_STATUS: Record<string, [string, string]> = {
  NUEVO: ["Nuevo", "orange"], PRESUPUESTO: ["Con presupuesto", "blue"], ESPERANDO_APROBACION: ["Esperando al propietario", "violet"],
  APROBADO: ["Aprobado", "green"], EN_CURSO: ["En curso", "brand"], RESUELTO: ["Resuelto", "green"], CERRADO: ["Cerrado", "gray"], CANCELADO: ["Cancelado", "gray"],
};
export const PRIORITY: Record<string, [string, string]> = { BAJA: ["Baja", "gray"], NORMAL: ["Normal", "blue"], URGENTE: ["Urgente", "red"] };
export const WHO_PAYS: Record<string, string> = { PROPIETARIO: "El propietario", INQUILINO: "El inquilino", INMOBILIARIA: "La inmobiliaria", A_DEFINIR: "A definir" };
export const REPORTED_BY: Record<string, string> = { INQUILINO: "Inquilino", PROPIETARIO: "Propietario", INMOBILIARIA: "La inmobiliaria" };
export const TRADES: Record<string, string> = {
  PLOMERIA: "Plomería", ELECTRICIDAD: "Electricidad", GAS: "Gas", PINTURA: "Pintura", CERRAJERIA: "Cerrajería",
  ALBANILERIA: "Albañilería", AIRE: "Aire acondicionado", LIMPIEZA: "Limpieza", OTRO: "Otro",
};
export const KIND_LABEL: Record<string, string> = { ENTRADA: "Entrada", SALIDA: "Salida", PERIODICA: "Periódica" };
export const CONDITION: Record<string, [string, string]> = { BUENO: ["Bueno", "green"], REGULAR: ["Regular", "orange"], MALO: ["Malo", "red"], NO_APLICA: ["No aplica", "gray"] };
export const LEAD_STATUS: Record<string, [string, string]> = {
  NUEVO: ["Nuevo", "orange"], CONTACTADO: ["Contactado", "blue"], VISITA_AGENDADA: ["Visita agendada", "violet"], VISITO: ["Visitó", "brand"],
  OFERTA: ["Oferta", "green"], GANADO: ["Ganado", "green"], PERDIDO: ["Perdido", "gray"],
};
export const SOURCE: Record<string, string> = { WEB: "Web", PORTAL: "Portal", WHATSAPP: "WhatsApp", CARTEL: "Cartel", REFERIDO: "Referido", INSTAGRAM: "Instagram", OTRO: "Otro" };
export const VISIT_STATUS: Record<string, [string, string]> = {
  AGENDADA: ["Agendada", "orange"], CONFIRMADA: ["Confirmada", "green"], REALIZADA: ["Realizada", "brand"], CANCELADA: ["Cancelada", "gray"], AUSENTE: ["No vino", "red"],
};
export const PROPERTY_KIND: Record<string, string> = {
  DEPARTAMENTO: "Departamento", CASA: "Casa", LOCAL: "Local", OFICINA: "Oficina", COCHERA: "Cochera", TERRENO: "Terreno", GALPON: "Galpón", OTRO: "Otro",
};
export const OPERATION: Record<string, string> = { ALQUILER: "Alquiler", VENTA: "Venta", AMBAS: "Alquiler y venta" };

export interface PropertyOpt { id: number; code: string; address: string; status: string; kind: string; neighborhood: string | null; city: string | null; operation: string; list_price: number | null; list_currency: string; rooms: number | null; published: boolean }
export interface ContractOpt { id: number; number: number; property_id: number; status: string; tenant: string | null }
export interface PersonOpt { id: number; full_name: string }
export interface AgentOpt { id: number; name: string; role: string }

// ---------------------------------------------------------------- fotos
/** Achica la foto del celular antes de subirla (el límite es 8 MB y una foto actual puede pasarlo). Si algo falla, sube la original. */
export async function compressImage(file: File, maxSide = 1600, quality = 0.82): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1_500_000) { bitmap.close?.(); return file; }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/jpeg", quality));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

/** Sube la imagen a /files y devuelve su file_url ("/files/12") */
export async function uploadImage(file: File): Promise<string> {
  const small = await compressImage(file);
  const form = new FormData();
  form.append("file", small, small.name);
  const res = await appUpload<{ file_url: string }>("/files", form);
  return res.file_url;
}

/** Botones para sacar una foto con la cámara o elegirla de la galería. `onFile` recibe el file_url ya subido. */
export function PhotoUploader({ onFile, disabled, compact, label = "Sacar foto" }: {
  onFile: (fileUrl: string) => Promise<void> | void; disabled?: boolean; compact?: boolean; label?: string;
}) {
  const cam = useRef<HTMLInputElement>(null);
  const gal = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handle(files: FileList | null) {
    if (!files || !files.length) return;
    setBusy(true); setError("");
    try {
      for (const f of Array.from(files)) await onFile(await uploadImage(f));
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo subir la foto"); } finally {
      setBusy(false);
      if (cam.current) cam.current.value = "";
      if (gal.current) gal.current.value = "";
    }
  }
  const cls = compact ? "secondary-button g3-small" : "secondary-button";
  return (
    <div className="g3-uploader">
      <input ref={cam} type="file" accept="image/*" capture="environment" hidden onChange={(e) => handle(e.target.files)} />
      <input ref={gal} type="file" accept="image/*" multiple hidden onChange={(e) => handle(e.target.files)} />
      <button type="button" className={cls} disabled={disabled || busy} onClick={() => cam.current?.click()}>{busy ? "Subiendo..." : label}</button>
      <button type="button" className={cls} disabled={disabled || busy} onClick={() => gal.current?.click()}>Elegir de la galería</button>
      {error && <span className="hb-note hb-note-error g3-inline-error" role="alert">{error}</span>}
    </div>
  );
}

export interface PhotoItem { id: number; url: string | null; caption?: string | null; stage?: string; taken_at?: string | null }

/** Grilla de miniaturas; al tocar una se ve grande */
export function PhotoGrid({ photos, onRemove, onCaption }: { photos: PhotoItem[]; onRemove?: (p: PhotoItem) => void; onCaption?: (p: PhotoItem) => ReactNode }) {
  const [open, setOpen] = useState<PhotoItem | null>(null);
  if (!photos.length) return null;
  return (
    <>
      <div className="g3-photos">
        {photos.map((p) => (
          <figure key={p.id} className="g3-photo">
            {p.url ? <button type="button" onClick={() => setOpen(p)} aria-label={p.caption ? `Ver foto: ${p.caption}` : "Ver foto"}><img src={API_URL + p.url} alt={p.caption || "Foto"} loading="lazy" /></button> : <div className="g3-photo-missing">Sin vista previa</div>}
            {(p.caption || p.stage) && <figcaption>{p.stage && <b>{p.stage === "ANTES" ? "Antes" : p.stage === "DESPUES" ? "Después" : "Factura"}</b>}{p.stage && p.caption ? " · " : ""}{p.caption}</figcaption>}
            {onCaption && onCaption(p)}
            {onRemove && <button type="button" className="g3-photo-x" onClick={() => onRemove(p)} aria-label="Quitar foto">×</button>}
          </figure>
        ))}
      </div>
      {open && open.url && (
        <Modal title={open.caption || "Foto"} eyebrow={open.taken_at ? new Date(open.taken_at).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }) : undefined} onClose={() => setOpen(null)} size="wide">
          <img className="g3-photo-big" src={API_URL + open.url} alt={open.caption || "Foto"} />
        </Modal>
      )}
    </>
  );
}

/** Botón que abre WhatsApp con el mensaje ya armado (wa.me). Nunca envía solo. */
export function WaButton({ url, label = "WhatsApp", hint, className = "secondary-button" }: { url?: string | null; label?: string; hint?: string; className?: string }) {
  if (!url) return <button type="button" className={className} disabled title={hint || "Esta persona no tiene un celular completo cargado"}>{label}</button>;
  return <a className={className + " g3-link-btn"} href={url} target="_blank" rel="noopener noreferrer">{label}</a>;
}

/** "2026-10-08T14:30:00" -> valor para <input type="datetime-local"> */
export function toInputDateTime(iso: string | null | undefined): string {
  return iso ? iso.slice(0, 16) : "";
}
export function fromInputDateTime(v: string): string | null {
  return v ? (v.length === 16 ? v + ":00" : v) : null;
}
