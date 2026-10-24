// Pasos del tutorial «¿Cómo funcionamos?» de Habita, según el rol de quien entra.
// Solo se incluyen pantallas que esa persona realmente ve en su menú.
import { canAccess } from "../../config";
import type { SessionUser } from "../../config";
import type { TourStep } from "./Tour";

const nav = (m: string) => `[data-tour="nav-${m}"]`;

export function tourSteps(user: SessionUser | null): TourStep[] {
  if (!user) return [];
  const can = (m: string) => canAccess(user, m);
  const steps: TourStep[] = [];
  const add = (cond: boolean, s: TourStep) => { if (cond) steps.push(s); };
  const role = user.role;
  const who = role === "COBRANZAS" ? "Desde acá cobrás los alquileres y emitís los recibos."
    : role === "AGENTE" ? "Desde acá seguís a los interesados y coordinás las visitas."
    : role === "CONTADOR" ? "Desde acá consultás cobranzas, liquidaciones y reportes. Tu acceso es de solo lectura."
    : role === "ENCARGADO" ? "Desde acá manejás el día a día de la inmobiliaria: contratos, cobranza, reparaciones y el equipo."
    : "Desde acá manejás toda la inmobiliaria: alquileres, cobranza, liquidaciones, equipo y configuración.";
  add(true, { title: "Bienvenido a Habita", text: `${who} Te mostramos lo principal en un minuto.` });
  add(true, { selector: '[data-tour="pendientes"]', title: "Pendientes", text: "En Inicio ves lo que hay para resolver hoy: ajustes por confirmar, cargos vencidos, contratos por vencer y más. Tocá uno y vas directo a esa pantalla." });
  add(can("propiedades"), { selector: nav("propiedades"), title: "Propiedades", text: "El padrón de propiedades con sus propietarios y fotos. Es la base de todo lo demás." });
  add(can("contratos"), { selector: nav("contratos"), title: "Contratos", text: "Contratos de alquiler con sus partes, el ajuste por índice y los vencimientos. Los contratos anteriores a 2024 se marcan como tales." });
  add(can("cobranzas"), { selector: nav("cobranzas"), title: "Cobranza", text: "Cargos del mes, cobro con recibo numerado y avisos por WhatsApp. Los recibos son internos: Documento no válido como factura." });
  add(can("expensas"), { selector: nav("expensas"), title: "Expensas", text: "Cargá el mes de expensas, ABL y servicios de cada contrato, todo junto, y adjuntá el comprobante." });
  add(can("liquidaciones"), { selector: nav("liquidaciones"), title: "Liquidaciones", text: "Lo cobrado menos tus honorarios, listo para rendir a cada propietario." });
  add(can("garantias"), { selector: nav("garantias"), title: "Garantías y depósitos", text: "Seguros de caución, garantías propietarias y depósitos en custodia, con aviso antes del vencimiento y cálculo de la devolución." });
  add(can("documentos"), { selector: nav("documentos"), title: "Documentos", text: "Escrituras, pólizas y matrícula con fecha de vencimiento, y un calendario que junta todos los vencimientos." });
  add(can("uif"), { selector: nav("uif"), title: "UIF", text: "Legajos, operaciones y recordatorios de fechas de la UIF. Son avisos: Habita no presenta nada por vos." });
  add(can("mantenimiento"), { selector: nav("mantenimiento"), title: "Reparaciones", text: "Reclamos de los inquilinos, presupuestos y seguimiento hasta que se resuelven." });
  add(can("inspecciones"), { selector: nav("inspecciones"), title: "Inspecciones", text: "Inventario de entrada y salida con fotos desde el celular. Al firmarlo queda bloqueado y sirve para comparar la salida y devolver el depósito." });
  add(can("crm"), { selector: nav("crm"), title: "Interesados", text: "Quién consultó, qué busca y cuándo hay que volver a llamarlo." });
  add(can("visitas"), { selector: nav("visitas"), title: "Visitas", text: "La agenda de visitas por agente, con la llave y la confirmación por WhatsApp." });
  add(can("reportes"), { selector: nav("reportes"), title: "Reportes", text: "Cobranza, morosidad y ocupación, con exportación a CSV." });
  add(true, { selector: '[data-tour="bell"]', title: "Avisos", text: "Acá te llegan los avisos: reclamos nuevos, vencimientos y novedades del equipo." });
  add(true, { selector: '[data-tour="theme"]', title: "Claro u oscuro", text: "Cambiá el aspecto de la pantalla según lo que te resulte más cómodo." });
  if (can("configuracion")) add(true, { selector: nav("configuracion"), title: "Configuración", text: "Datos de la inmobiliaria y matrícula, recibos, honorarios, mora, alertas y plantillas de mensajes. Acá mismo está el botón «¿Cómo funcionamos?» para volver a ver este recorrido." });
  else add(true, { selector: '[data-tour="tour-help"]', title: "¿Cómo funcionamos?", text: "Si querés volver a ver este recorrido, tocá este botón cuando quieras." });
  return steps;
}

/** Recorrido del panel general de Mezztt (superadmin) */
export function adminTourSteps(): TourStep[] {
  const a = (p: string) => `[data-tour="admin-${p}"]`;
  return [
    { title: "Bienvenido al panel de Habita", text: "Desde acá administrás los locales que usan Habita: qué módulos tienen habilitados, cuánto pagan y cómo se factura. Te mostramos lo principal." },
    { selector: a("inicio"), title: "Inicio", text: "El resumen: cuántos locales hay, qué se espera cobrar este mes, cuánto ya entró y los pedidos de baja pendientes." },
    { selector: a("sistemas"), title: "Sistemas", text: "Cada cliente es un sistema. Acá lo das de alta, elegís sus módulos (los que dependen de otros se marcan solos), el abono y podés resetear contraseñas." },
    { selector: a("pagos"), title: "Pagos", text: "Registrá lo que te paga cada cliente y mirá quién está al día y quién debe." },
    { selector: a("facturacion"), title: "Facturación", text: "Cotizaciones con pago inicial y abono mensual (más los planes trimestral y anual) y las facturas mensuales de cada sistema." },
    { selector: '[data-tour="theme"]', title: "Claro u oscuro", text: "Cambiá el aspecto de la pantalla según lo que te resulte más cómodo." },
    { selector: a("configuracion"), title: "Configuración", text: "Precios, enlaces de marca y copia de seguridad. Acá mismo está el botón «¿Cómo funcionamos?» para volver a ver este recorrido." },
  ];
}
