// Configuración compartida de Habita · by Mezztt
// En local usa el backend de tu PC. Online se define VITE_API_URL al compilar (ver .env.example).
export const API_URL = ((typeof window !== "undefined" && (window as any).mezzttApp?.apiUrl) || import.meta.env.VITE_API_URL || "http://127.0.0.1:8070").replace(/\/$/, "");

export const APP_NAME = "Habita";
export const APP_VERSION = "1.0.0";
export const APP_BRAND = "Mezztt";

/** Enlaces de marca por defecto (Mezztt los cambia desde Configuración del panel; ver useBrandLinks en components/Brand) */
export interface BrandLinks { system_instagram_url: string; mezztt_instagram_url: string; mezztt_site_url: string }
export const DEFAULT_BRAND_LINKS: BrandLinks = {
  system_instagram_url: "https://instagram.com/habita.mezztt",
  mezztt_instagram_url: "https://instagram.com/mezzttofficial",
  mezztt_site_url: "https://mezztt.site",
};

export const ADMIN_TOKEN_KEY = "habita_admin_token";
export const TOKEN_KEY = "habita_token";
export const USER_KEY = "habita_user";
export const THEME_KEY = "habita_theme";

// =====================================================================
// MÓDULOS
//   núcleo (sin cargo)  ·  cobrables (USD 6 c/u)  ·  webs públicas (USD 20 c/u)
// Mismos ids que backend/schemas.py (CORE_MODULES, BILLABLE_MODULES, EXTRA_MODULES, MODULE_DEPENDENCIES)
// =====================================================================
export const CORE_MODULES = ["inicio", "propiedades", "configuracion", "usuarios"];
export const BILLABLE_MODULES = ["contratos", "cobranzas", "liquidaciones", "garantias", "expensas", "mantenimiento", "inspecciones", "documentos", "visitas", "crm", "uif", "reportes"];
/** Webs (cada una se cobra con el precio de web) */
export const EXTRA_MODULES = ["web_propiedades", "web_portal"];
/** Lo que el panel puede tildar para una inmobiliaria */
export const ALL_MODULES = [...BILLABLE_MODULES, ...EXTRA_MODULES];

/** Dependencias: lo implícito se tilda y se cobra solo (el panel lo marca como «incluido por …») */
export const MODULE_DEPENDENCIES: Record<string, string[]> = {
  cobranzas: ["contratos"], garantias: ["contratos"], expensas: ["contratos"], uif: ["contratos"],
  liquidaciones: ["cobranzas"],
  web_propiedades: ["crm"],
  web_portal: ["cobranzas"],
};
/** Sugeridos: el panel avisa pero no los agrega solos */
export const MODULE_SUGGESTIONS: Record<string, string[]> = { visitas: ["crm"], web_portal: ["mantenimiento"] };

/** Agrega los módulos que otros necesitan (liquidaciones -> cobranzas -> contratos…), en el orden de ALL_MODULES */
export function withDependencies(modules: string[]): string[] {
  const chosen = new Set(modules.filter((m) => ALL_MODULES.includes(m)));
  const queue = [...chosen];
  while (queue.length) {
    for (const dep of MODULE_DEPENDENCIES[queue.pop()!] || []) {
      if (!chosen.has(dep)) { chosen.add(dep); queue.push(dep); }
    }
  }
  return ALL_MODULES.filter((m) => chosen.has(m));
}
/** Qué módulos tildados exigen a `module` (para el aviso «incluido por …») */
export function requiredBy(module: string, selected: string[]): string[] {
  return selected.filter((s) => withDependencies([s]).includes(module) && s !== module);
}

export const MODULE_LABELS: Record<string, string> = {
  inicio: "Inicio", propiedades: "Propiedades y propietarios", configuracion: "Configuración", usuarios: "Usuarios",
  contratos: "Contratos y ajustes", cobranzas: "Cobranza y recibos", liquidaciones: "Liquidación a propietarios",
  garantias: "Garantías y depósitos", expensas: "Expensas y servicios", mantenimiento: "Reparaciones y proveedores",
  inspecciones: "Inspecciones y fotos", documentos: "Documentos y vencimientos", visitas: "Agenda de visitas",
  crm: "Interesados (CRM)", uif: "Cumplimiento UIF", reportes: "Reportes",
  web_propiedades: "Web de propiedades", web_portal: "Portal de propietarios e inquilinos",
};
export const MODULE_HINTS: Record<string, string> = {
  contratos: "Inquilinos, garantes, contratos, ajuste por índice, renovaciones, rescisión y alertas de vencimiento",
  cobranzas: "Cuenta corriente por contrato, recibos numerados, mora sugerida y avisos por WhatsApp",
  liquidaciones: "Rendición mensual: cobrado menos comisión y gastos, lista para imprimir y registrar el pago",
  garantias: "Seguro de caución, garantía propietaria, fiadores, depósito en custodia y su devolución",
  expensas: "Expensas, ABL, agua, luz y gas por contrato: quién paga, quién cobra y comprobantes",
  mantenimiento: "Reclamos, presupuestos, aprobación del propietario, proveedor, costo y quién lo paga",
  inspecciones: "Inventario de entrada y salida y visitas periódicas con fotos y comparación",
  documentos: "Escrituras, contratos escaneados, pólizas, matrícula: archivo y calendario de vencimientos",
  visitas: "Agenda de visitas a propiedades por agente y llave, con confirmación por WhatsApp",
  crm: "Consultas, seguimiento hasta el contrato, búsquedas y propiedades sugeridas",
  uif: "Legajos de clientes, registro de operaciones, alertas y calendario de la Res. UIF 43/2024",
  reportes: "Cobranza, mora, vacancia, rentabilidad por propiedad, comisiones y vencimientos",
  web_propiedades: "Catálogo con filtros, ficha con fotos y formulario de consulta que entra a Interesados",
  web_portal: "Links para que el inquilino vea su cuenta y recibos, y el propietario sus rendiciones y reparaciones",
};

export const ROLES = ["ADMINISTRADOR", "ENCARGADO", "COBRANZAS", "AGENTE", "CONTADOR"];
export const ROLE_LABELS: Record<string, string> = {
  ADMINISTRADOR: "Titular / administrador", ENCARGADO: "Administrador de alquileres", COBRANZAS: "Cobranzas", AGENTE: "Agente comercial", CONTADOR: "Contador (solo lectura)",
};
export const ROLE_HINTS: Record<string, string> = {
  ADMINISTRADOR: "Todo el sistema, usuarios, configuración e índices propios",
  ENCARGADO: "Contratos, ajustes, cobranza y liquidaciones. No toca usuarios ni configuración",
  COBRANZAS: "Cobra y emite recibos. No anula recibos ni carga punitorios",
  AGENTE: "Propiedades, interesados, visitas e inspecciones. No ve la cobranza",
  CONTADOR: "Solo mira: cobranza, liquidaciones, documentos y reportes",
};

/** Pantallas del menú lateral (en este orden). `roles`: quién la ve además del titular (los mismos de constants.MODULE_READ_ROLES). */
export type NavSection = "PRINCIPAL" | "ALQUILERES" | "OPERACIÓN" | "COMERCIAL" | "CONTROL" | "INMOBILIARIA";
export interface NavItem { module: string; path: string; label: string; icon: string; roles: string[]; section: NavSection }
const ALL_ROLES = ["*"];
export const NAV: NavItem[] = [
  { module: "inicio", path: "/app", label: "Inicio", icon: "home", roles: ALL_ROLES, section: "PRINCIPAL" },
  { module: "propiedades", path: "/app/propiedades", label: "Propiedades", icon: "key", roles: ALL_ROLES, section: "PRINCIPAL" },
  { module: "contratos", path: "/app/contratos", label: "Contratos", icon: "contract", roles: ALL_ROLES, section: "ALQUILERES" },
  { module: "cobranzas", path: "/app/cobranzas", label: "Cobranza", icon: "receipt", roles: ["ENCARGADO", "COBRANZAS", "CONTADOR"], section: "ALQUILERES" },
  { module: "liquidaciones", path: "/app/liquidaciones", label: "Liquidaciones", icon: "calculator", roles: ["ENCARGADO", "CONTADOR"], section: "ALQUILERES" },
  { module: "garantias", path: "/app/garantias", label: "Garantías", icon: "shield", roles: ALL_ROLES, section: "ALQUILERES" },
  { module: "expensas", path: "/app/expensas", label: "Expensas", icon: "building", roles: ["ENCARGADO", "COBRANZAS", "CONTADOR"], section: "ALQUILERES" },
  { module: "mantenimiento", path: "/app/mantenimiento", label: "Reparaciones", icon: "wrench", roles: ALL_ROLES, section: "OPERACIÓN" },
  { module: "inspecciones", path: "/app/inspecciones", label: "Inspecciones", icon: "camera", roles: ALL_ROLES, section: "OPERACIÓN" },
  { module: "documentos", path: "/app/documentos", label: "Documentos", icon: "folder", roles: ["ENCARGADO", "COBRANZAS", "CONTADOR"], section: "OPERACIÓN" },
  { module: "crm", path: "/app/crm", label: "Interesados", icon: "contact", roles: ["ENCARGADO", "AGENTE"], section: "COMERCIAL" },
  { module: "visitas", path: "/app/visitas", label: "Visitas", icon: "calendarCheck", roles: ["ENCARGADO", "AGENTE"], section: "COMERCIAL" },
  { module: "reportes", path: "/app/reportes", label: "Reportes", icon: "chart", roles: ALL_ROLES, section: "CONTROL" },
  { module: "uif", path: "/app/uif", label: "Cumplimiento UIF", icon: "scale", roles: ["CONTADOR"], section: "CONTROL" },
  { module: "usuarios", path: "/app/usuarios", label: "Usuarios", icon: "users", roles: [], section: "INMOBILIARIA" },
  { module: "configuracion", path: "/app/configuracion", label: "Configuración", icon: "settings", roles: [], section: "INMOBILIARIA" },
];
export const NAV_SECTIONS: NavSection[] = ["PRINCIPAL", "ALQUILERES", "OPERACIÓN", "COMERCIAL", "CONTROL", "INMOBILIARIA"];
export const pathFor = (module: string) => NAV.find((n) => n.module === module)?.path || `/app/${module}`;
export const iconFor = (module: string) => NAV.find((n) => n.module === module)?.icon || "home";

export function moduleLabel(module: string): string {
  return MODULE_LABELS[module] || module;
}
export function moduleHint(module: string): string {
  return MODULE_HINTS[module] || "";
}

// =====================================================================
// HELPERS
// =====================================================================
export function splitList(value: string | null | undefined): string[] {
  return (value || "").split(",").map((s) => s.trim()).filter(Boolean);
}

export function money(value: number | string | null | undefined): string {
  const n = Number(value || 0);
  const decimals = Number.isInteger(n) ? 0 : 2;
  return (n < 0 ? "-$" : "$") + Math.abs(n).toLocaleString("es-AR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** Importe en dólares: "USD 38,72" (los precios de Habita se cotizan en USD) */
export function usd(value: number | string | null | undefined): string {
  const n = Number(value || 0);
  const decimals = Number.isInteger(n) ? 0 : 2;
  return (n < 0 ? "-USD " : "USD ") + Math.abs(n).toLocaleString("es-AR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** Planes sobre el abono mensual M (iguales a los del backend, schemas.py): trimestral paga 2 de 3 meses, anual 10 de 12 */
export const TRIMESTRAL_MESES_PAGOS = 2;
export const ANUAL_MESES_PAGOS = 10;
export function plansFor(monthly: number | string | null | undefined) {
  const m = Number(monthly || 0);
  const r = (n: number) => Math.round(n * 100) / 100;
  return { quarterly: r(m * TRIMESTRAL_MESES_PAGOS), annual: r(m * ANUAL_MESES_PAGOS), annualSaving: r(m * (12 - ANUAL_MESES_PAGOS)) };
}

export function shortDate(value: string | null | undefined): string {
  if (!value) return "—";
  const v = value.length === 10 ? value + "T12:00:00" : value;
  return new Date(v).toLocaleDateString("es-AR");
}

export function dateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  return `${d.toLocaleDateString("es-AR")} ${hhmm(d)}`;
}

const pad = (n: number) => String(n).padStart(2, "0");
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
/** Date -> "2026-10-01T18:30:00" (hora local, lo que espera el backend) */
export function toLocalISO(d: Date): string {
  return `${dayKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}
export function parseDay(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}
export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
export function addMinutes(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 60000);
}
export function hhmm(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function timeRange(start: string | Date, end: string | Date): string {
  return `${hhmm(start)}–${hhmm(end)}`;
}
export function hhmmToMinutes(v: string): number {
  const [h, m] = v.split(":").map(Number);
  return h * 60 + m;
}
const DAYS_ES = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const DAYS_LONG = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MONTHS_LONG = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export const WEEKDAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]; // 0 = lunes (como el backend)

export function dayLabel(d: Date, short = true): string {
  const today = new Date();
  const k = dayKey(d);
  if (k === dayKey(today)) return "Hoy";
  if (k === dayKey(addDays(today, 1))) return "Mañana";
  if (k === dayKey(addDays(today, -1))) return "Ayer";
  return short ? `${DAYS_ES[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}` : longDate(d);
}
export function longDate(d: Date): string {
  const txt = `${DAYS_LONG[d.getDay()]} ${d.getDate()} de ${MONTHS_LONG[d.getMonth()]}`;
  return txt.charAt(0).toUpperCase() + txt.slice(1);
}
export function periodLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  const t = `${MONTHS_LONG[(m || 1) - 1]} ${y}`;
  return t.charAt(0).toUpperCase() + t.slice(1);
}
export function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
export function shiftPeriod(period: string, n: number): string {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
export function minutesLabel(min: number): string {
  if (min % 60 === 0) return `${min / 60} h`;
  if (min > 60) return `${Math.floor(min / 60)} h ${min % 60} min`;
  return `${min} min`;
}
export function initials(name: string): string {
  return name.split(/[\s,]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
}

/** Descarga un archivo del backend (CSV) con el token de la sesión */
export async function downloadFile(path: string, filename: string) {
  const res = await fetch(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY) || ""}` } });
  if (!res.ok) throw new Error("No se pudo descargar");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Descarga en el navegador un archivo ya armado */
export function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Arma un CSV que Excel abre bien (separado por ; y con acentos) y lo descarga */
export function downloadCsv(filename: string, headers: string[], rows: (string | number | null | undefined)[][]) {
  const cell = (v: string | number | null | undefined) => {
    if (v === null || v === undefined) return "";
    if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(".", ",");
    return /[";\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  };
  const text = [headers, ...rows].map((r) => r.map(cell).join(";")).join("\r\n");
  saveBlob(new Blob(["\ufeff" + text], { type: "text/csv;charset=utf-8" }), filename);
}

/** Descarga un archivo del panel general (con el token del panel) */
export async function adminDownload(path: string, fallbackName: string) {
  const res = await fetch(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${localStorage.getItem(ADMIN_TOKEN_KEY) || ""}` } });
  if (!res.ok) throw new Error("No se pudo descargar");
  const match = /filename="?([^";]+)"?/.exec(res.headers.get("Content-Disposition") || "");
  saveBlob(await res.blob(), match ? match[1] : fallbackName);
}

// =====================================================================
// FETCH
// =====================================================================
function adminHeaders(json = false): HeadersInit {
  const headers: Record<string, string> = { Authorization: `Bearer ${localStorage.getItem(ADMIN_TOKEN_KEY) || ""}` };
  if (json) headers["Content-Type"] = "application/json";
  return headers;
}

/** fetch para el panel general (Mezztt). Si el token venció, vuelve al login. */
export async function adminApi<T = any>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method || "GET",
      headers: adminHeaders(options.body !== undefined),
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new Error("No se pudo conectar con el servidor");
  }
  if (response.status === 401 || response.status === 403) {
    if (path !== "/admin/me/password" && !path.endsWith("/toggle-active")) {
      localStorage.removeItem(ADMIN_TOKEN_KEY);
      window.location.href = "/";
    }
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(detailText(data));
  return data as T;
}

function detailText(data: any): string {
  const d = data?.detail;
  if (typeof d === "string") return d;
  if (Array.isArray(d) && d[0]?.msg) return "Revisá los datos: " + d.map((x: any) => (x.loc || []).slice(-1)[0]).join(", ");
  return "Ocurrió un error";
}

/** fetch para el sistema de la inmobiliaria. Si la sesión venció, vuelve al login. */
export async function appApi<T = any>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const headers: Record<string, string> = { Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY) || ""}` };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method || "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new Error("No se pudo conectar con el servidor");
  }
  if (response.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    window.location.href = "/";
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(detailText(data));
  return data as T;
}

/** Sube un archivo (multipart). No lleva Content-Type: el navegador arma el boundary. */
export async function appUpload<T = any>(path: string, form: FormData): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY) || ""}` },
      body: form,
    });
  } catch {
    throw new Error("No se pudo conectar con el servidor");
  }
  if (response.status === 401) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    window.location.href = "/";
  }
  if (response.status === 413) throw new Error("El archivo es demasiado grande");
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(detailText(data));
  return data as T;
}

/** Trae un archivo protegido (imagen, PDF) con el token en el encabezado, nunca en la URL */
export async function appBlob(path: string): Promise<Blob> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { headers: { Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY) || ""}` } });
  } catch {
    throw new Error("No se pudo conectar con el servidor");
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(detailText(data));
  }
  return response.blob();
}

/** fetch público (cartas, reservas y pedidos online, sin login) */
export async function publicApi<T = any>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method || "GET",
      headers: options.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new Error("No se pudo conectar. Probá de nuevo en un momento.");
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(detailText(data));
  return data as T;
}

// =====================================================================
// SESIÓN
// =====================================================================
export interface SessionUser {
  id: number;
  name: string;
  email: string;
  company_id: number;
  company_name: string;
  role: string;
  company_slug?: string | null;
  enabled_modules: string;
}

export function getSessionUser(): SessionUser | null {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
}

/** ¿Puede esta persona abrir la pantalla de `module`? (módulo contratado + rol). El backend vuelve a validar. */
export function canAccess(user: SessionUser | null, module: string): boolean {
  if (!user) return false;
  const enabled = CORE_MODULES.includes(module) || splitList(user.enabled_modules).includes(module);
  if (!enabled) return false;
  if (module === "configuracion" || module === "usuarios") return user.role === "ADMINISTRADOR";
  if (user.role === "ADMINISTRADOR") return true;
  const item = NAV.find((n) => n.module === module);
  if (!item) return false;
  return item.roles.includes("*") || item.roles.includes(user.role);
}

/** El contador es de solo lectura: las pantallas esconden los botones que cambian datos */
export const isReadOnly = (user: SessionUser | null) => user?.role === "CONTADOR";

// =====================================================================
// PANEL (Mezztt)
// =====================================================================
export interface SystemItem {
  id: number;
  cancel_code?: string | null;
  service_end_date?: string | null;
  name: string;
  rubro?: string | null;
  slug: string | null;
  cuit: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  enabled_modules: string | null;
  client_price: number | string | null;
  payment_status: string;
  payment_due_date: string | null;
  billed: boolean;
  apply_iva: boolean;
  archived: boolean;
  notes: string | null;
  created_at: string;
}
export interface PaymentItem { id: number; company_id: number; amount: number | string; payment_date: string; method: string | null; notes: string | null }
export const GRACE_DAYS = 10;
export function isOverdue(s: Pick<SystemItem, "payment_due_date" | "payment_status">): boolean {
  if (!s.payment_due_date || s.payment_status === "al_dia") return false;
  const limit = new Date(s.payment_due_date);
  limit.setDate(limit.getDate() + GRACE_DAYS);
  return new Date() > limit;
}
export function systemStatus(s: SystemItem): { label: string; tone: "ok" | "warn" | "off" } {
  if (s.archived) return { label: "Dado de baja", tone: "off" };
  if (isOverdue(s)) return { label: "Pago atrasado", tone: "warn" };
  return { label: "Activo", tone: "ok" };
}
export const PAYMENT_STATUS_LABELS: Record<string, string> = { al_dia: "Al día", pendiente: "Pendiente", vencido: "Vencido" };

/** Precios de Habita (USD): configuración (una vez), precio por módulo cobrable y precio de cada web */
export interface BillingPrices { base_cost: number | string; module_price: number | string; web_price: number | string }
export interface PriceBreakdown {
  setup: number; modulesCount: number; modulesTotal: number; web: number; websCount: number;
  monthlySubtotal: number; monthlyTotal: number; initialSubtotal: number; initialTotal: number;
  /** módulos finales (con dependencias) y los que se agregaron solos */
  modules: string[]; implied: string[];
}
/**
 * Pago inicial (una sola vez) = configuración + módulos cobrables + webs.
 * Abono mensual = módulos cobrables + webs (la configuración no se cobra por mes).
 * Los módulos que otros necesitan (liquidaciones -> cobranzas -> contratos, etc.) se agregan y se cobran. Mismo cálculo que el backend.
 */
export function priceBreakdown(chosen: string[], prices: BillingPrices | null, iva: boolean): PriceBreakdown {
  const base = [...new Set(chosen)].filter((m) => ALL_MODULES.includes(m));
  const modules = withDependencies(base);
  const implied = modules.filter((m) => !base.includes(m));
  const modulesCount = modules.filter((m) => !EXTRA_MODULES.includes(m)).length;
  const websCount = modules.filter((m) => EXTRA_MODULES.includes(m)).length;
  const setup = Number(prices?.base_cost ?? 0);
  const modulesTotal = Number(prices?.module_price ?? 0) * modulesCount;
  const web = Number(prices?.web_price ?? 0) * websCount;
  const monthlySubtotal = modulesTotal + web;
  const initialSubtotal = setup + monthlySubtotal;
  const f = iva ? 1.21 : 1;
  return { setup, modulesCount, modulesTotal, web, websCount, monthlySubtotal, monthlyTotal: monthlySubtotal * f, initialSubtotal, initialTotal: initialSubtotal * f, modules, implied };
}

/** Ítem del panel «Pendientes» del Inicio */
export interface PendingItem { key: string; label: string; count: number; path: string; hint: string; tone: "warn" | "alert" | "info"; amount?: number }

// =====================================================================
// PÁGINAS PÚBLICAS DE LA INMOBILIARIA (sin login)
// =====================================================================
/** Links de las webs de una inmobiliaria: catálogo de propiedades y portal (el portal usa un link con token por persona) */
export function publicLinks(slug: string | null | undefined) {
  const base = window.location.origin;
  const s = slug || "";
  return { propiedades: `${base}/p/${s}`, portal: (token: string) => `${base}/portal/${token}` };
}

/** Importe con su moneda: "$ 350.000" o "USD 450". No mezcles monedas: sumá siempre por separado. */
export function moneyIn(value: number | string | null | undefined, currency: string | null | undefined): string {
  return currency === "USD" ? usd(value) : money(value);
}

export const CURRENCY_LABELS: Record<string, string> = { ARS: "Pesos ($)", USD: "Dólares (USD)" };

/** Teléfono para mostrar: "(261) 555-1234" a partir de área y número */
export function phoneText(area: string | null | undefined, number: string | null | undefined): string {
  const a = (area || "").trim(), n = (number || "").trim();
  if (!a && !n) return "—";
  return a ? `(${a}) ${n}` : n;
}
