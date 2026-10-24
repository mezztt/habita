import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { appApi, canAccess, currentPeriod, isReadOnly, moneyIn, moduleLabel, periodLabel, shiftPeriod, shortDate } from "../config";
import type { PendingItem, SessionUser } from "../config";
import { HabitaLogo } from "./Brand";

/**
 * Asistente de Habita.
 * Responde con datos reales de la inmobiliaria (contratos, cobranza, ajustes, garantías, documentos, UIF…)
 * consultando la API del propio sistema, y explica cómo hacer cada cosa. No usa IA externa: no tiene costo.
 * Respeta los módulos contratados y el rol: solo consulta y ofrece lo que esa persona puede ver.
 */

interface Msg {
  from: "bot" | "user";
  text: string;
  actions?: { label: string; to: string }[];
}
type Reply = Omit<Msg, "from">;

// ---------- formas de las respuestas de la API (solo los campos que usamos) ----------
interface ContractRow { id: number; number: number; status: string; property: { address: string | null }; tenant: { name: string } | null; end_date: string; days_left: number | null; current_rent: number | null; currency: string }
interface ContractList { items: ContractRow[]; counts: Record<string, number> }
interface AdjustmentRow { contract: { number: number; address: string | null; tenant: string | null; currency: string }; due_date: string; status: string; previous_rent: number | null; new_rent: number | null; change_pct?: number; days_to: number }
interface CollectionRow { number: number; address: string; currency: string; tenant: { full_name: string } | null; due: number; paid: number; balance: number; previous: number; total_balance: number; days_late: number; state: string }
interface CollectionSheet { period: string; rows: CollectionRow[]; totals: Record<string, { due: number; paid: number; balance: number; previous: number; pct: number }>; ungenerated: number; counts: Record<string, number> }
interface PropertyRow { code: string; address: string; floor_unit: string | null; neighborhood: string | null; list_price: number | null; list_currency: string | null; operation: string | null }
interface GuaranteeRow { kind_label: string; status: string; valid_to: string | null; days_left: number | null; contract: { number: number; address: string | null; tenant: string | null } }
interface DocumentList { items: { name: string; kind_label: string; entity_name: string | null; expires_on: string | null; days_left: number | null }[]; counts: { total: number; vencidos: number; por_vencer: number } }
interface Overview { properties: { total: number; disponibles: number; alquiladas: number }; contracts?: { active: number }; collection?: { expected: number; collected: number; pct: number } }
interface AmlOverview { counts: Record<string, number>; warnings: string[]; next_dates: { date: string; days: number; label: string }[] }

// ---------- sugerencias (chips) ----------
const SUGGESTIONS: { text: string; module?: string }[] = [
  { text: "¿Qué tengo pendiente?" },
  { text: "Contratos por vencer", module: "contratos" },
  { text: "Ajustes de este mes", module: "contratos" },
  { text: "¿Quién está atrasado?", module: "cobranzas" },
  { text: "¿Cuánto falta cobrar?", module: "cobranzas" },
  { text: "Propiedades disponibles" },
  { text: "Garantías por vencer", module: "garantias" },
  { text: "Documentos por vencer", module: "documentos" },
  { text: "¿Cómo registro un cobro?", module: "cobranzas" },
  { text: "¿Cómo hago un ajuste por índice?", module: "contratos" },
];

// ---------- texto: tildes, mayúsculas y errores de tipeo ----------
const norm = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[¿?¡!.,;:«»"]/g, " ").replace(/\s+/g, " ").trim();

/** Distancia de edición entre dos palabras (se corta si pasa del máximo) */
function edit(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

/** ¿El texto menciona esta palabra o frase? Acepta un tipeo en palabras sueltas de 5 letras o más (contrato ≈ contarto). */
function hit(t: string, key: string): boolean {
  if (key.length < 5) return ` ${t} `.includes(` ${key} `);   // palabras cortas: solo enteras (abl no es «habla»)
  if (t.includes(key)) return true;
  if (key.includes(" ")) return false;
  const max = key.length >= 9 ? 2 : 1;
  return t.split(" ").some((w) => w.length >= 4 && edit(w, key, max) <= max);
}
const has = (t: string, ...keys: string[]) => keys.some((k) => hit(t, k));

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const inDays = (d: number | null) => (d === null ? "" : d < 0 ? `venció hace ${plural(-d, "día", "días")}` : d === 0 ? "vence hoy" : `en ${plural(d, "día", "días")}`);
const short = (s: string | null | undefined, n = 38) => { const v = s || "sin dirección"; return v.length > n ? v.slice(0, n - 1) + "…" : v; };
const more = (total: number, shown: number) => (total > shown ? `\n… y ${total - shown} más.` : "");

// ---------- ayuda: «cómo hago…» con rutas reales ----------
interface Help { keys: string[]; text: string; to: string; label: string; module?: string }
const HELP: Help[] = [
  {
    keys: ["nuevo contrato", "crear contrato", "cargar contrato", "alta de contrato", "armar contrato", "hacer un contrato", "contrato nuevo"],
    text: "En Contratos tocá «Nuevo contrato». Elegís la propiedad, el inquilino y los garantes, las fechas, el alquiler inicial y cómo se ajusta (índice, porcentaje o sin ajuste). Queda en borrador hasta que lo activás con «Activar».",
    to: "/app/contratos?nuevo=1", label: "Nuevo contrato", module: "contratos",
  },
  {
    keys: ["registrar cobro", "registrar un cobro", "cobrar", "cobro", "recibo", "pago del inquilino", "pago de alquiler", "paso a pagar", "ya pago"],
    text: "En Cobranza buscá el contrato y tocá «Cobrar». Cargás el importe y cómo pagó, y al confirmar se emite el recibo numerado (después lo imprimís o lo mandás por WhatsApp). Recordá que el recibo es interno: no vale como factura.",
    to: "/app/cobranzas", label: "Ir a Cobranza", module: "cobranzas",
  },
  {
    keys: ["generar cobranza", "generar cargos", "cargos del mes", "cobranza del mes", "armar la cobranza", "generar alquileres", "emitir alquileres"],
    text: "En Cobranza tocá «Generar cobranza del mes»: crea el cargo de alquiler de cada contrato que cobra ese mes. Lo podés correr más de una vez sin duplicar. Si un contrato está en dólares, te pide la cotización.",
    to: "/app/cobranzas?generar=1", label: "Generar cobranza", module: "cobranzas",
  },
  {
    keys: ["ajuste por indice", "ajustar", "ajuste", "actualizar alquiler", "actualizacion", "actualizar el alquiler", "aumento", "icl", "ipc", "casa propia", "indice"],
    text: "En Contratos → «Ajustes del mes» ves los alquileres que se actualizan. Habita propone el nuevo valor solo, unos días antes de la fecha (se define en Configuración → Alertas); vos lo revisás y tocás «Confirmar ajuste» (o «Descartar»). Si falta el índice del mes queda «Esperando el índice»: cargalo en Configuración → Índices de ajuste. Después podés avisarle al inquilino por WhatsApp.",
    to: "/app/contratos?tab=ajustes", label: "Ver ajustes del mes", module: "contratos",
  },
  {
    keys: ["renovar", "renovacion", "rescindir", "rescision", "finalizar contrato", "terminar contrato", "dar de baja contrato", "fin de contrato"],
    text: "Abrí el contrato desde Contratos y usá «Renovar» (crea el nuevo contrato con los mismos datos), «Rescindir» (antes del plazo; te calcula la cuenta) o «Finalizar» (cuando termina). Rescindir es definitivo.",
    to: "/app/contratos", label: "Ir a Contratos", module: "contratos",
  },
  {
    keys: ["mora", "punitorio", "interes por atraso", "recargo", "dias de gracia"],
    text: "La mora (días de gracia y porcentaje) se define en Configuración → Mora. Después, en la cuenta del contrato (botón «Ver cuenta» en Cobranza) Habita te sugiere el punitorio y lo podés cargar como cargo.",
    to: "/app/cobranzas", label: "Ir a Cobranza", module: "cobranzas",
  },
  {
    keys: ["liquidacion", "liquidar", "rendicion", "rendir", "pagar al propietario", "honorarios", "comision"],
    text: "En Liquidaciones tocá «Generar liquidaciones del mes»: calcula, por propietario, lo cobrado menos tu comisión y los gastos. Revisás el detalle, «Cerrar liquidación», «Registrar pago» cuando le transferís e «Imprimir rendición». El % de honorarios está en Configuración → Honorarios.",
    to: "/app/liquidaciones", label: "Ir a Liquidaciones", module: "liquidaciones",
  },
  {
    keys: ["garantia", "caucion", "fiador", "deposito", "devolver deposito", "devolucion del deposito"],
    text: "En Garantías: «Nueva garantía» para cargar un seguro de caución, garantía propietaria o fiador (con vigencia y póliza), y «Registrar depósito» para el depósito en custodia. Cuando termina el contrato, «Devolver» te calcula la devolución. Te avisa antes de que venza cada garantía.",
    to: "/app/garantias", label: "Ir a Garantías", module: "garantias",
  },
  {
    keys: ["documento", "escritura", "poliza", "matricula", "subir archivo", "vencimiento de documento", "calendario de vencimientos"],
    text: "En Documentos tocá «Subir un documento»: elegís a qué pertenece (propiedad, persona, contrato o la inmobiliaria), el tipo y la fecha de vencimiento. Con eso entra al calendario y te avisa antes de que venza.",
    to: "/app/documentos", label: "Ir a Documentos", module: "documentos",
  },
  {
    keys: ["uif", "lavado", "legajo", "operacion alcanzada", "sujeto obligado", "smvm"],
    text: "En Cumplimiento UIF cargás un «Nuevo legajo» por cliente y «Registrar una operación» por cada locación o venta. Habita marca las que llegan al umbral (necesita el valor del SMVM en Configuración → Sellado y SMVM) y te recuerda las fechas. Son avisos: Habita no presenta nada por vos.",
    to: "/app/uif", label: "Ir a UIF", module: "uif",
  },
  {
    keys: ["nueva propiedad", "cargar propiedad", "agregar propiedad", "crear propiedad", "alta de propiedad", "importar propiedades", "importar planilla", "planilla", "excel"],
    text: "En Propiedades tocá «Nueva propiedad» (dirección, tipo, propietarios, fotos). Si ya las tenés en una planilla, usá la pestaña «Importar»: sube el CSV o Excel y te muestra una vista previa antes de guardar.",
    to: "/app/propiedades", label: "Ir a Propiedades", module: "propiedades",
  },
  {
    keys: ["nuevo inquilino", "nuevo propietario", "cargar inquilino", "cargar propietario", "nueva persona", "agregar persona", "cargar garante", "alta de inquilino"],
    text: "Inquilinos, propietarios y garantes se cargan como personas: en Propiedades → pestaña «Personas» tocá «Nueva persona». Después los elegís al armar la propiedad o el contrato.",
    to: "/app/propiedades?tab=personas", label: "Cargar una persona", module: "propiedades",
  },
  {
    keys: ["expensa", "abl", "servicios", "luz", "gas", "agua", "comprobante"],
    text: "En Expensas tocá «Generar cargos del mes»: arma una fila por contrato y concepto (expensas, ABL, agua, luz, gas). Cargás los importes, indicás quién paga y adjuntás el comprobante.",
    to: "/app/expensas", label: "Ir a Expensas", module: "expensas",
  },
  {
    keys: ["reclamo", "reparacion", "arreglo", "presupuesto", "proveedor", "plomero", "mantenimiento"],
    text: "En Reparaciones tocá «+ Nuevo reclamo», elegí la propiedad y asigná un proveedor. Cargás el presupuesto, registrás si el propietario aprobó, «Empezar» el trabajo y al terminar «Marcar resuelto» con el costo final y quién paga.",
    to: "/app/mantenimiento", label: "Ir a Reparaciones", module: "mantenimiento",
  },
  {
    keys: ["visita", "agendar", "agenda", "mostrar propiedad", "llave"],
    text: "En Visitas tocá «+ Agendar visita»: elegís propiedad, interesado, agente y horario, y dónde está la llave. Después «Confirmar» (podés avisar por WhatsApp) y «Marcar realizada» cuando se hizo.",
    to: "/app/visitas", label: "Ir a Visitas", module: "visitas",
  },
  {
    keys: ["interesado", "consulta", "cliente nuevo", "seguimiento", "crm", "convertir en inquilino"],
    text: "En Interesados tocá «+ Nueva consulta» con lo que busca la persona. Anotás el seguimiento y la fecha del próximo contacto, «Sugerir propiedades» le propone las que coinciden, y cuando alquila «Ganado: convertir en inquilino».",
    to: "/app/crm", label: "Ir a Interesados", module: "crm",
  },
  {
    keys: ["inspeccion", "inventario", "fotos de la propiedad", "estado de la propiedad", "acta de entrega"],
    text: "En Inspecciones tocá «+ Nueva inspección»: elegís la propiedad y el tipo (entrada o salida), cargás ambientes y fotos desde el celular. Al terminar «Firmar y bloquear». La de salida se puede comparar con la de entrada.",
    to: "/app/inspecciones", label: "Ir a Inspecciones", module: "inspecciones",
  },
  {
    keys: ["portal", "link del inquilino", "link del propietario", "que el inquilino vea", "autogestion"],
    text: "En Cobranza → pestaña «Links del portal» generás el link para que el inquilino vea su cuenta y recibos, o el propietario sus rendiciones. El link vence (los días se definen en Configuración → Alertas). Los avisos que mandan aparecen en «Avisos del portal».",
    to: "/app/cobranzas?tab=portal", label: "Links del portal", module: "web_portal",
  },
  {
    keys: ["reporte", "informe", "estadistica", "rentabilidad", "vacancia", "exportar", "csv"],
    text: "En Reportes elegís el informe (cobranza, deuda, vacancia, rentabilidad, vencimientos…), el período, y lo bajás a planilla con «Bajar a planilla (CSV)».",
    to: "/app/reportes", label: "Ir a Reportes", module: "reportes",
  },
  {
    keys: ["usuario", "empleado", "equipo", "rol", "roles", "permiso", "agregar gente", "invitar"],
    text: "En Usuarios creás a tu equipo y elegís el rol: Titular (todo), Administrador de alquileres, Cobranzas, Agente comercial o Contador (solo lectura). Cada rol ve solo sus pantallas.",
    to: "/app/usuarios", label: "Ir a Usuarios", module: "usuarios",
  },
  {
    keys: ["dar de baja el servicio", "baja del servicio", "darme de baja", "darse de baja", "cancelar el servicio", "cancelar la suscripcion", "dejar de usar", "ya no quiero usar", "dar de baja habita"],
    text: "Para darte de baja: Configuración → «Ayuda» → «Dar de baja el servicio» (también está en el menú de la izquierda). Se confirma en dos pasos y te da al instante una constancia BAJA-SRV con fecha y hora. No se corta de golpe: seguís usando el sistema hasta el final del período que ya pagaste, no se cobra de nuevo y no borramos tus datos. Si cambiás de idea, podés «Retirar la baja» antes de esa fecha.",
    to: "/app/configuracion", label: "Ir a Configuración", module: "configuracion",
  },
  {
    keys: ["configuracion", "configurar", "datos de la inmobiliaria", "logo", "mensaje de whatsapp", "plantilla", "mercado pago", "recibos"],
    text: "En Configuración están los datos de la inmobiliaria y matrícula, el formato de recibos, honorarios, mora, alertas, sellado y SMVM, las plantillas de WhatsApp, los índices propios y tus páginas públicas.",
    to: "/app/configuracion", label: "Ir a Configuración", module: "configuracion",
  },
  {
    keys: ["modo oscuro", "oscuro", "tema", "modo claro"],
    text: "El modo oscuro (o claro) se cambia abajo del menú de la izquierda. En el celular, abrí el menú con el botón de arriba a la izquierda.",
    to: "/app", label: "Ir al Inicio",
  },
  {
    keys: ["tutorial", "recorrido", "como funciona", "como funcionamos", "primeros pasos", "empezar"],
    text: "El recorrido guiado está abajo del menú, en «¿Cómo funcionamos?». Te muestra las pantallas que tu usuario puede usar.",
    to: "/app", label: "Ir al Inicio",
  },
  {
    keys: ["notificacion", "aviso", "campanita", "campana"],
    text: "Los avisos (reclamos nuevos, vencimientos, novedades del portal) llegan a la campanita de arriba a la derecha. Y en Inicio, el panel «Pendientes» junta lo que hay para resolver hoy.",
    to: "/app", label: "Ir al Inicio",
  },
];

/** Mejor tema de ayuda para el texto: gana el que coincide con la frase más larga */
function findHelp(t: string, user: SessionUser | null): { help: Help | null; blocked: Help | null } {
  let best: Help | null = null, bestScore = 0;
  for (const h of HELP) {
    const score = Math.max(0, ...h.keys.filter((k) => hit(t, k)).map((k) => k.length));
    if (score > bestScore) { best = h; bestScore = score; }
  }
  if (best?.module && !canAccess(user, best.module)) return { help: null, blocked: best };
  return { help: best, blocked: null };
}

const NO_ACCESS = (module: string): Reply => ({ text: `Tu usuario no tiene acceso a ${moduleLabel(module)} (o la inmobiliaria no lo tiene contratado). Si lo necesitás, pedíselo al titular.` });

/** Días que se mencionan en la pregunta («en 30 días», «próximos 2 meses») */
function daysAsked(t: string, fallback: number): number {
  const m = t.match(/(\d{1,3})\s*(dias|dia|meses|mes|semanas|semana)?/);
  if (!m) return fallback;
  const n = Number(m[1]);
  const unit = m[2] || "dias";
  const d = unit.startsWith("mes") ? n * 30 : unit.startsWith("sem") ? n * 7 : n;
  return Math.max(1, Math.min(d, 365));
}

function Assistant({ user }: { user: SessionUser | null }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  // en el celular el botón se esconde al bajar la pantalla (así no tapa los botones de acción del final) y vuelve al subir
  const [tuck, setTuck] = useState(false);
  useEffect(() => {
    const last = new WeakMap<EventTarget, number>();
    const onScroll = (e: Event) => {
      const t = e.target as HTMLElement | Document;
      const y = t instanceof Document ? window.scrollY : (t as HTMLElement).scrollTop;
      const prev = last.get(t);
      if (prev === undefined) { last.set(t, y); return; }
      if (Math.abs(y - prev) > 6) { setTuck(y > prev && y > 60); last.set(t, y); }
    };
    document.addEventListener("scroll", onScroll, true);
    return () => document.removeEventListener("scroll", onScroll, true);
  }, []);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const can = (m: string) => canAccess(user, m);
  const readOnly = isReadOnly(user);

  useEffect(() => {
    if (open && msgs.length === 0) {
      const first = (user?.name || "").split(" ")[0];
      setMsgs([{
        from: "bot",
        text: `¡Hola${first ? ` ${first}` : ""}! Soy el asistente de Habita. Te cuento qué vence, quién está atrasado, cuánto falta cobrar, qué ajustes vienen o qué propiedades están libres, y te explico cómo hacer cada cosa.`,
      }]);
    }
    if (open) setTimeout(() => inputRef.current?.focus(), 60);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs, typing]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // ---------- consultas de datos ----------
  async function pendingReply(keys?: string[], title?: string, empty?: string): Promise<Reply> {
    const r = await appApi<{ items: PendingItem[] }>("/dashboard/pending");
    const list = keys ? r.items.filter((i) => keys.includes(i.key)) : r.items;
    if (!list.length) return { text: empty || "No tenés nada pendiente. Todo al día." };
    return {
      text: `${title || "Esto es lo que hay para resolver"}:\n` + list.slice(0, 8).map((i) => `• ${i.label}: ${i.count}${i.amount ? ` (${moneyIn(i.amount, "ARS")})` : ""}`).join("\n") + more(list.length, 8),
      actions: list.slice(0, 3).map((i) => ({ label: i.label.length > 26 ? i.label.slice(0, 25) + "…" : i.label, to: i.path })),
    };
  }

  async function expiringContracts(t: string): Promise<Reply> {
    if (!can("contratos")) return NO_ACCESS("contratos");
    const days = daysAsked(t, 90);
    const r = await appApi<ContractList>(`/contracts?expiring_in=${days}`);
    const list = [...r.items].sort((a, b) => (a.days_left ?? 9999) - (b.days_left ?? 9999));
    if (!list.length) return { text: `No hay contratos que venzan en los próximos ${days} días.`, actions: [{ label: "Ver contratos", to: "/app/contratos" }] };
    return {
      text: `${cap(plural(list.length, "contrato vence", "contratos vencen"))} en los próximos ${days} días:\n` +
        list.slice(0, 7).map((c) => `• N.º ${c.number} · ${short(c.property.address)}${c.tenant ? ` · ${c.tenant.name}` : ""} — ${shortDate(c.end_date)} (${inDays(c.days_left)})`).join("\n") + more(list.length, 7),
      actions: [{ label: "Ver contratos", to: "/app/contratos?estado=POR_VENCER" }],
    };
  }

  async function contractCount(): Promise<Reply> {
    if (!can("contratos")) return NO_ACCESS("contratos");
    const r = await appApi<ContractList>("/contracts?status=ACTIVOS");
    const c = r.counts;
    const active = (c.VIGENTE || 0) + (c.POR_VENCER || 0) + (c.VENCIDO || 0);
    return {
      text: `Tenés ${plural(active, "contrato activo", "contratos activos")}. Vigentes: ${c.VIGENTE || 0}. Por vencer: ${c.POR_VENCER || 0}. Vencidos sin renovar: ${c.VENCIDO || 0}.` +
        (c.BORRADOR ? `\nY ${plural(c.BORRADOR, "borrador", "borradores")} sin activar.` : ""),
      actions: [{ label: "Ver contratos", to: "/app/contratos" }],
    };
  }

  async function searchContract(term: string): Promise<Reply> {
    if (!can("contratos")) return NO_ACCESS("contratos");
    const r = await appApi<ContractList>(`/contracts?q=${encodeURIComponent(term)}`);
    if (!r.items.length) return { text: `No encontré contratos que coincidan con «${term}». Probá con la dirección, el código de la propiedad o el nombre del inquilino.` };
    const rent = (c: ContractRow) => (c.current_rent ? ` · ${moneyIn(c.current_rent, c.currency)}` : "");
    return {
      text: `Encontré ${plural(r.items.length, "contrato", "contratos")}:\n` +
        r.items.slice(0, 5).map((c) => `• N.º ${c.number} · ${short(c.property.address)}${c.tenant ? ` · ${c.tenant.name}` : ""}${rent(c)} — ${cap(c.status.toLowerCase().replace("_", " "))}, hasta ${shortDate(c.end_date)}`).join("\n") + more(r.items.length, 5),
      actions: r.items.slice(0, 3).map((c) => ({ label: `Abrir N.º ${c.number}`, to: `/app/contratos?id=${c.id}` })),
    };
  }

  async function adjustments(t: string): Promise<Reply> {
    if (!can("contratos")) return NO_ACCESS("contratos");
    const month = has(t, "proximo mes", "mes que viene", "mes siguiente") ? shiftPeriod(currentPeriod(), 1) : currentPeriod();
    const r = await appApi<{ items: AdjustmentRow[]; counts: Record<string, number> }>(`/adjustments?month=${month}`);
    const todo = r.items.filter((a) => ["ESPERANDO_INDICE", "PROPUESTO", "PREVISTO"].includes(a.status));
    if (!r.items.length) return { text: `No hay ajustes de alquiler en ${periodLabel(month).toLowerCase()}.`, actions: [{ label: "Ver ajustes", to: "/app/contratos?tab=ajustes" }] };
    const label: Record<string, string> = { ESPERANDO_INDICE: "esperando el índice", PROPUESTO: "para confirmar", PREVISTO: "todavía no corresponde" };
    const c = r.counts;
    const head = `Ajustes de ${periodLabel(month).toLowerCase()}: ${c.PROPUESTO || 0} para confirmar, ${c.ESPERANDO_INDICE || 0} esperando el índice, ${c.PREVISTO || 0} previstos y ${c.APLICADO || 0} aplicados.`;
    if (!todo.length) return { text: head + "\nNo queda ninguno por resolver.", actions: [{ label: "Ver ajustes", to: "/app/contratos?tab=ajustes" }] };
    return {
      text: head + "\n" + todo.slice(0, 6).map((a) =>
        `• N.º ${a.contract.number} · ${short(a.contract.address, 30)} — ${shortDate(a.due_date)}, ${label[a.status]}` +
        (a.new_rent && a.previous_rent ? `: ${moneyIn(a.previous_rent, a.contract.currency)} → ${moneyIn(a.new_rent, a.contract.currency)}${a.change_pct !== undefined ? ` (${a.change_pct > 0 ? "+" : ""}${String(a.change_pct).replace(".", ",")}%)` : ""}` : "")).join("\n") + more(todo.length, 6),
      actions: [{ label: "Ver ajustes del mes", to: "/app/contratos?tab=ajustes" }],
    };
  }

  async function collection(): Promise<Reply> {
    if (!can("cobranzas")) return NO_ACCESS("cobranzas");
    const period = currentPeriod();
    const r = await appApi<CollectionSheet>(`/collections?period=${period}`);
    const cur = Object.keys(r.totals);
    if (!cur.length && !r.ungenerated) return { text: `Todavía no hay cobranza en ${periodLabel(period).toLowerCase()}.`, actions: [{ label: "Ir a Cobranza", to: "/app/cobranzas" }] };
    const lines = cur.map((c) => {
      const x = r.totals[c];
      return `• ${c === "USD" ? "En dólares" : "En pesos"}: se cobró ${moneyIn(x.paid, c)} de ${moneyIn(x.due, c)} (${String(x.pct).replace(".", ",")}%). Falta cobrar ${moneyIn(x.balance + x.previous, c)}${x.previous ? `, de los cuales ${moneyIn(x.previous, c)} son de meses anteriores` : ""}.`;
    });
    const n = r.counts;
    const extra = `Contratos: ${n.PAGADO || 0} pagaron, ${n.PENDIENTE || 0} pendientes${n.VENCIDO ? `, ${n.VENCIDO} atrasados` : ""}.` + (r.ungenerated ? `\nFaltan generar los cargos de ${plural(r.ungenerated, "contrato", "contratos")}.` : "");
    const acts = [{ label: "Ver cobranza", to: "/app/cobranzas" }];
    if (r.ungenerated && !readOnly) acts.push({ label: "Generar cobranza", to: "/app/cobranzas?generar=1" });
    return { text: `Cobranza de ${periodLabel(period).toLowerCase()}:\n${lines.join("\n")}\n${extra}`, actions: acts };
  }

  async function overdue(): Promise<Reply> {
    if (!can("cobranzas")) return NO_ACCESS("cobranzas");
    const r = await appApi<CollectionSheet>(`/collections?period=${currentPeriod()}&status=VENCIDOS`);
    const list = [...r.rows].sort((a, b) => b.days_late - a.days_late);
    if (!list.length) return { text: "No hay inquilinos atrasados. Todos están al día.", actions: [{ label: "Ver cobranza", to: "/app/cobranzas" }] };
    return {
      text: `${cap(plural(list.length, "contrato atrasado", "contratos atrasados"))} (de más a menos días):\n` +
        list.slice(0, 7).map((x) => `• ${x.tenant?.full_name || "Sin inquilino"} · ${short(x.address, 30)} — debe ${moneyIn(x.total_balance, x.currency)}, ${plural(x.days_late, "día", "días")} de atraso`).join("\n") + more(list.length, 7),
      actions: [{ label: "Ver atrasados", to: "/app/cobranzas?filtro=vencidos" }],
    };
  }

  async function freeProperties(): Promise<Reply> {
    const r = await appApi<{ items: PropertyRow[] }>("/properties?status=DISPONIBLE&active=true");
    if (!r.items.length) return { text: "No hay propiedades disponibles: todas están alquiladas u ocupadas.", actions: [{ label: "Ver propiedades", to: "/app/propiedades" }] };
    return {
      text: `${cap(plural(r.items.length, "propiedad disponible", "propiedades disponibles"))}:\n` +
        r.items.slice(0, 7).map((p) => `• ${p.code} · ${short(p.address + (p.floor_unit ? ` ${p.floor_unit}` : ""), 34)}${p.neighborhood ? ` (${p.neighborhood})` : ""}${p.list_price ? ` — ${moneyIn(p.list_price, p.list_currency)}` : ""}`).join("\n") + more(r.items.length, 7),
      actions: [{ label: "Ver propiedades", to: "/app/propiedades" }],
    };
  }

  async function occupancy(): Promise<Reply> {
    const r = await appApi<Overview>("/dashboard");
    const p = r.properties;
    if (!p.total) return { text: "Todavía no cargaste propiedades.", actions: [{ label: "Cargar una", to: "/app/propiedades" }] };
    const pct = Math.round((p.alquiladas / p.total) * 100);
    return {
      text: `Tenés ${plural(p.total, "propiedad", "propiedades")} activas: ${p.alquiladas} alquiladas (${pct}%) y ${p.disponibles} disponibles.` + (r.contracts ? `\nContratos activos: ${r.contracts.active}.` : ""),
      actions: [{ label: "Ver propiedades", to: "/app/propiedades" }],
    };
  }

  async function guarantees(t: string): Promise<Reply> {
    if (!can("garantias")) return NO_ACCESS("garantias");
    const days = daysAsked(t, 60);
    const r = await appApi<{ items: GuaranteeRow[] }>(`/guarantees?expiring_in=${days}`);
    if (!r.items.length) return { text: `No hay garantías vencidas ni por vencer en los próximos ${days} días.`, actions: [{ label: "Ver garantías", to: "/app/garantias" }] };
    return {
      text: `${cap(plural(r.items.length, "garantía vencida o por vencer", "garantías vencidas o por vencer"))} (próximos ${days} días):\n` +
        r.items.slice(0, 7).map((g) => `• ${g.kind_label} · contrato N.º ${g.contract.number}${g.contract.tenant ? ` (${g.contract.tenant})` : ""} — ${g.valid_to ? `${shortDate(g.valid_to)}, ${inDays(g.days_left)}` : "sin fecha"}`).join("\n") + more(r.items.length, 7),
      actions: [{ label: "Ver garantías", to: "/app/garantias" }],
    };
  }

  async function documents(): Promise<Reply> {
    if (!can("documentos")) return NO_ACCESS("documentos");
    const r = await appApi<DocumentList>("/documents?expiring_in=30");
    const c = r.counts;
    if (!r.items.length) return { text: `No hay documentos vencidos ni por vencer en 30 días (tenés ${c.total} cargados).`, actions: [{ label: "Ver documentos", to: "/app/documentos" }] };
    return {
      text: `Documentos: ${c.vencidos} vencidos y ${c.por_vencer} por vencer en 30 días.\n` +
        r.items.slice(0, 7).map((d) => `• ${d.name} (${d.kind_label}${d.entity_name ? ` · ${short(d.entity_name, 24)}` : ""}) — ${d.expires_on ? `${shortDate(d.expires_on)}, ${inDays(d.days_left)}` : ""}`).join("\n") + more(r.items.length, 7),
      actions: [{ label: "Ver vencimientos", to: "/app/documentos?vence=30" }],
    };
  }

  async function uif(): Promise<Reply> {
    if (!can("uif")) return NO_ACCESS("uif");
    const r = await appApi<AmlOverview>("/aml/overview");
    const c = r.counts;
    const lines = [
      `Legajos: ${c.profiles}. Operaciones del año: ${c.operations_year} (${c.reportable_year} alcanzadas).`,
      c.unreported ? `Alcanzadas sin marcar como presentadas: ${c.unreported}.` : "No hay alcanzadas sin marcar como presentadas.",
      c.reviews_overdue ? `Legajos con revisión vencida: ${c.reviews_overdue}.` : "",
      c.without_profile ? `Personas con operaciones y sin legajo: ${c.without_profile}.` : "",
      ...r.warnings.slice(0, 2),
      r.next_dates[0] ? `Próxima fecha: ${r.next_dates[0].label}, ${shortDate(r.next_dates[0].date)} (${inDays(r.next_dates[0].days)}).` : "",
    ].filter(Boolean);
    return { text: lines.join("\n") + "\nRecordá: Habita avisa, pero no presenta nada ante la UIF.", actions: [{ label: "Ir a UIF", to: "/app/uif" }] };
  }

  // ---------- el cerebro ----------
  async function answer(raw: string): Promise<Reply> {
    const t = norm(raw);

    // saludo / gracias
    if (/^(hola|holaa|buenas|buen dia|buenos dias|buenas tardes|buenas noches|hey|que tal)\b/.test(t) && t.split(" ").length <= 4) {
      return { text: "¡Hola! ¿En qué te ayudo? Podés tocar una de las sugerencias de abajo o escribirme tu pregunta." };
    }
    if (has(t, "gracias", "genial", "joya", "perfecto", "excelente", "buenisimo") && t.split(" ").length <= 5) {
      return { text: "¡De nada! Cualquier cosa, acá estoy." };
    }

    // buscar un contrato por dirección / inquilino
    const find = t.match(/^(?:buscar|busca|buscame|contrato de|contratos de|contrato del|contrato en|inquilino|el contrato de)\s+(.{3,})$/);
    if (find && !/^(vencer|vencen|vencimiento|por vencer|ajuste|atrasad)/.test(find[1])) {
      const words = find[1].replace(/^(?:el |un )?contratos? (?:de|del|en)\s+/, "").split(" ");
      const term = raw.trim().replace(/[¿?¡!.]+$/, "").split(/\s+/).slice(-words.length).join(" ");   // con tildes originales: el backend no las ignora
      if (term.length >= 3) return searchContract(term);
    }

    // ayuda de uso («cómo hago…»)
    const asksHow = has(t, "como", "donde", "que hago", "ayuda", "se puede", "puedo", "necesito", "quiero", "explicame", "paso a paso");
    const { help, blocked } = findHelp(t, user);
    const helpReply = (h: Help): Reply => ({ text: h.text, actions: [{ label: h.label, to: h.to }] });
    if (asksHow) {
      if (help) return helpReply(help);
      if (blocked) return NO_ACCESS(blocked.module!);
    }

    // datos
    const mentionsGuarantee = has(t, "garantia", "caucion", "fiador", "deposito");
    const mentionsDoc = has(t, "documento", "escritura", "poliza", "matricula");
    const wantsExpiry = has(t, "vence", "vencen", "vencimiento", "por vencer", "vencer", "vencido", "renovar", "terminan");

    if (has(t, "uif", "lavado", "legajo")) return uif();
    if (mentionsGuarantee) return guarantees(t);
    if (mentionsDoc) return documents();
    if (has(t, "ajuste", "ajustes", "actualiza", "actualizan", "actualizacion", "aumento", "aumentan", "indice", "icl", "ipc")) return adjustments(t);
    if (has(t, "atrasad", "moroso", "morosos", "deben", "deuda", "adeuda", "mora", "no pagaron", "sin pagar", "impago", "vencidos")) {
      if (!has(t, "contrato") || has(t, "pago", "cobr", "inquilino")) return overdue();
    }
    if (wantsExpiry && has(t, "contrato", "alquiler", "alquileres", "locacion", "inquilino")) return expiringContracts(t);
    if (has(t, "cobrar", "cobrado", "cobramos", "cobranza", "cobre", "recaud", "falta cobrar", "por cobrar", "ingreso", "caja", "pagaron", "cuanto se cobro")) return collection();
    if (has(t, "libre", "libres", "disponible", "disponibles", "vacante", "vacia", "vacias", "sin alquilar", "desocupad", "para alquilar")) return freeProperties();
    if (has(t, "ocupacion", "alquiladas", "cuantas propiedades", "cuantas casas", "cuantos departamentos")) return occupancy();
    if (has(t, "cuantos contratos", "contratos vigentes", "contratos activos", "contratos tengo", "cuantos alquileres")) return contractCount();
    if (wantsExpiry) return expiringContracts(t);
    if (has(t, "reclamo", "reclamos", "reparacion", "reparaciones", "arreglo", "arreglos")) {
      if (!can("mantenimiento")) return NO_ACCESS("mantenimiento");
      return pendingReply(["reclamos_nuevos", "presupuestos_por_aprobar"], "Reparaciones que esperan una acción", "No hay reclamos nuevos ni presupuestos por aprobar.");
    }
    if (has(t, "visitas", "visita de hoy")) {
      if (!can("visitas")) return NO_ACCESS("visitas");
      return pendingReply(["visitas_hoy", "visitas_sin_confirmar"], "Visitas", "No hay visitas para hoy ni sin confirmar.");
    }
    if (has(t, "interesado", "interesados", "consultas", "seguimientos")) {
      if (!can("crm")) return NO_ACCESS("crm");
      return pendingReply(["consultas_sin_contactar", "seguimientos_vencidos"], "Interesados", "No hay consultas sin contactar ni seguimientos vencidos.");
    }
    if (has(t, "pendiente", "pendientes", "que tengo", "que hay para hacer", "urgente", "resumen", "que falta", "tareas", "para hoy", "que hago hoy")) return pendingReply();

    // ayuda sin «cómo»
    if (help) return helpReply(help);
    if (blocked) return NO_ACCESS(blocked.module!);

    return {
      text: "No te entendí del todo. Probá con algo como «contratos por vencer», «ajustes de este mes», «¿quién está atrasado?», «propiedades disponibles», «buscar contrato de Pérez» o «¿cómo registro un cobro?».",
    };
  }

  async function send(text: string) {
    const q = text.trim();
    if (!q || typing) return;
    setMsgs((m) => [...m, { from: "user", text: q }]);
    setInput("");
    setTyping(true);
    try {
      const [reply] = await Promise.all([answer(q), new Promise((r) => setTimeout(r, 400))]);
      setMsgs((m) => [...m, { from: "bot", ...reply }]);
    } catch (e) {
      setMsgs((m) => [...m, { from: "bot", text: e instanceof Error && e.message ? `No pude consultar eso: ${e.message}` : "No pude consultar eso ahora. Probá de nuevo en un rato." }]);
    } finally {
      setTyping(false);
    }
  }

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    send(input);
  }

  function go(to: string) {
    navigate(to);
    if (window.matchMedia("(max-width: 860px)").matches) setOpen(false);   // en el celular el panel tapa la pantalla
  }

  const chips = SUGGESTIONS.filter((s) => !s.module || can(s.module));

  return (
    <>
      {!open && (
        <button type="button" className={`hb-assist-fab ${tuck ? "is-tucked" : ""}`} data-tour="asistente" onClick={() => setOpen(true)} aria-label="Abrir el asistente">
          <svg className="hb-assist-fab-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8.5A1.5 1.5 0 0 1 19 17H11l-4.5 3.5V17H5a1.5 1.5 0 0 1-1.5-1.5V7A1.5 1.5 0 0 1 5 5.5z" />
            <path d="M8.5 10.2h7M8.5 13h4" />
          </svg>
          <span className="hb-assist-fab-text">Asistente</span>
        </button>
      )}
      {open && (
        <section className="hb-assist" role="dialog" aria-label="Asistente de Habita">
          <div className="hb-assist-head">
            <HabitaLogo size={34} />
            <div>
              <strong>Asistente Habita</strong>
              <small>Contratos, cobranza y ajustes al instante</small>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar el asistente">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
            </button>
          </div>
          <div className="hb-assist-body" aria-live="polite">
            {msgs.map((m, i) => (
              <div key={i} className={`hb-assist-msg ${m.from}`}>
                <p>{m.text}</p>
                {m.actions && m.actions.length > 0 && (
                  <div className="hb-assist-actions">
                    {m.actions.map((a) => (
                      <button type="button" key={a.to + a.label} onClick={() => go(a.to)}>{a.label} ›</button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {typing && <div className="hb-assist-msg bot"><p className="hb-assist-typing" aria-label="Escribiendo"><span /><span /><span /></p></div>}
            <div ref={endRef} />
          </div>
          <div className="hb-assist-suggest">
            {chips.map((s) => (
              <button type="button" key={s.text} onClick={() => send(s.text)} disabled={typing}>{s.text}</button>
            ))}
          </div>
          <form className="hb-assist-input" onSubmit={submit}>
            <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} placeholder="Escribí tu pregunta…" aria-label="Tu pregunta" autoComplete="off" />
            <button type="submit" disabled={!input.trim() || typing} aria-label="Enviar">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12l16-8-6 16-3-7z" /></svg>
            </button>
          </form>
        </section>
      )}
    </>
  );
}

export default Assistant;
