// Piezas compartidas por las pantallas del grupo G1: etiquetas, colores y selectores.
import type { ReactNode } from "react";
import { Pill } from "../ui";

export type Tone = "gray" | "green" | "orange" | "red" | "blue" | "violet" | "brand";

export const PROPERTY_KIND: Record<string, string> = {
  DEPARTAMENTO: "Departamento", CASA: "Casa", LOCAL: "Local", OFICINA: "Oficina", COCHERA: "Cochera", TERRENO: "Terreno", GALPON: "Galpón", OTRO: "Otro",
};
export const PROPERTY_STATUS: Record<string, [string, Tone]> = {
  DISPONIBLE: ["Disponible", "green"], ALQUILADA: ["Alquilada", "brand"], RESERVADA: ["Reservada", "violet"], EN_REFORMA: ["En reforma", "orange"], INACTIVA: ["Inactiva", "gray"],
};
export const OPERATION_LABEL: Record<string, string> = { ALQUILER: "Alquiler", VENTA: "Venta", AMBAS: "Alquiler y venta", NO_PUBLICA: "No se publica" };
export const DOC_TYPES = ["DNI", "CUIT", "CUIL", "PASAPORTE"];
export const TAX_CONDITIONS: Record<string, string> = {
  CONSUMIDOR_FINAL: "Consumidor final", MONOTRIBUTO: "Monotributo", RESP_INSCRIPTO: "Responsable inscripto", EXENTO: "Exento", OTRO: "Otra",
};

export const CONTRACT_STATUS: Record<string, [string, Tone]> = {
  BORRADOR: ["Borrador", "gray"], VIGENTE: ["Vigente", "green"], POR_VENCER: ["Por vencer", "orange"], VENCIDO: ["Vencido", "red"],
  RESCINDIDO: ["Rescindido", "gray"], FINALIZADO: ["Finalizado", "gray"],
};
export const TRAFFIC: Record<string, [string, Tone]> = { green: ["Todo en orden", "green"], yellow: ["Atención", "orange"], orange: ["Atención", "orange"], red: ["Hay que actuar", "red"], gray: ["Sin actividad", "gray"] };
export const ADJ_STATUS: Record<string, [string, Tone]> = {
  PROPUESTO: ["Por confirmar", "orange"], ESPERANDO_INDICE: ["Esperando el índice", "violet"], APLICADO: ["Aplicado", "green"], DESCARTADO: ["Descartado", "gray"],
  PREVISTO: ["Previsto", "blue"],
};
export const METHOD_LABEL: Record<string, string> = { SIN_AJUSTE: "Sin ajuste", INDICE: "Por índice", PORCENTAJE: "Por porcentaje fijo", ESCALONADO: "Escalonado", MANUAL: "Cambio manual" };
export const REGIME_LABEL: Record<string, string> = { LIBRE: "Libre (desde 29/12/2023)", LEY_27551: "Ley 27.551 (anterior a 29/12/2023)" };
export const PURPOSE_LABEL: Record<string, string> = { VIVIENDA: "Vivienda", COMERCIAL: "Comercial", OTRO: "Otro destino" };
export const FX_RULE_LABEL: Record<string, string> = { NO_APLICA: "No aplica (pesos)", BNA_VENDEDOR: "Dólar BNA vendedor", MEP: "Dólar MEP", PACTADA: "Cotización pactada" };
export const DEPOSIT_MODE_LABEL: Record<string, string> = { FIJO: "Monto fijo", MESES_CANON: "Meses de canon", ULTIMO_CANON: "Meses del último canon" };
export const ROLE_LABEL: Record<string, string> = { INQUILINO: "Inquilino", COINQUILINO: "Coinquilino", GARANTE: "Garante", FIADOR: "Fiador" };
export const PLAN_CONCEPT: Record<string, string> = {
  EXPENSAS_ORD: "Expensas ordinarias", EXPENSAS_EXTRA: "Expensas extraordinarias", ABL: "ABL / inmobiliario", AGUA: "Agua", LUZ: "Luz", GAS: "Gas", SEGURO: "Seguro", OTRO: "Otro",
};
export const GUARANTEE_KIND: Record<string, string> = {
  PROPIETARIA: "Garantía propietaria", SEGURO_CAUCION: "Seguro de caución", AVAL_BANCARIO: "Aval bancario", FIADOR: "Fiador", PAGARE: "Pagaré", OTRA: "Otra garantía",
};
export const GUARANTEE_STATUS: Record<string, [string, Tone]> = { VIGENTE: ["Vigente", "green"], POR_VENCER: ["Por vencer", "orange"], VENCIDA: ["Vencida", "red"], LIBERADA: ["Liberada", "gray"] };
export const DEPOSIT_STATUS: Record<string, [string, Tone]> = {
  EN_CUSTODIA: ["En custodia", "blue"], DEVUELTO: ["Devuelto", "green"], APLICADO: ["Aplicado a deuda", "violet"], PARCIAL: ["Devuelto con descuentos", "orange"],
};
export const DOC_KIND: Record<string, string> = {
  ESCRITURA: "Escritura", CONTRATO: "Contrato", POLIZA: "Póliza", DNI: "DNI", RECIBO_SUELDO: "Recibo de sueldo", MATRICULA: "Matrícula", HABILITACION: "Habilitación", CERTIFICADO: "Certificado", OTRO: "Otro",
};
export const DOC_ENTITY: Record<string, string> = { PROPERTY: "Propiedad", PARTY: "Persona", CONTRACT: "Contrato", AGENCY: "Inmobiliaria", GUARANTEE: "Garantía", SETTLEMENT: "Liquidación" };
export const CAL_KIND: Record<string, string> = {
  CONTRATO: "Contrato", AJUSTE: "Ajuste", GARANTIA: "Garantía", POLIZA: "Póliza", DOCUMENTO: "Documento", MATRICULA: "Matrícula", SELLADO: "Sellado",
  UIF_MENSUAL: "UIF", UIF_ANUAL: "UIF", UIF_AUTOEVAL: "UIF",
};

export function tonePill(map: Record<string, [string, Tone]>, key: string | null | undefined): ReactNode {
  if (!key) return null;
  const [label, tone] = map[key] || [key, "gray" as Tone];
  return <Pill tone={tone}>{label}</Pill>;
}

export function dueTone(tone: string | null | undefined): Tone {
  return tone === "alert" ? "red" : tone === "warn" ? "orange" : "green";
}

/** "1.234,56" -> 1234.56 ; "" -> null */
export function toNum(v: string | number | null | undefined): number | null {
  if (v === "" || v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(String(v).trim().replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
/** Para inputs controlados: número -> texto editable */
export function numText(v: number | null | undefined): string {
  return v === null || v === undefined ? "" : String(v).replace(".", ",");
}

export function daysText(n: number | null | undefined): string {
  if (n === null || n === undefined) return "";
  if (n < 0) return `venció hace ${-n} día${n === -1 ? "" : "s"}`;
  if (n === 0) return "vence hoy";
  return `faltan ${n} día${n === 1 ? "" : "s"}`;
}

export function Check({ checked, onChange, children, disabled }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode; disabled?: boolean }) {
  return (
    <label className="g1-check">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}

export function Note({ tone = "info", children }: { tone?: "info" | "warn" | "error"; children: ReactNode }) {
  return <div className={`hb-note hb-note-${tone}`} role={tone === "error" ? "alert" : "note"}>{children}</div>;
}

/** Fecha de hoy en AAAA-MM-DD (hora local del navegador) */
export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function openWa(url: string | null | undefined) {
  if (url) window.open(url, "_blank", "noopener,noreferrer");
}
