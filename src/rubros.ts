// Tipos de negocio ("rubros") de Habita. Mismos datos que backend/rubros.py (fuente: specs/rubros.json, clave "habita").
// Sirven para tildar los módulos sugeridos al dar de alta una inmobiliaria y para elegir el tipo de negocio en Configuración.
// Las dependencias entre módulos (uif -> contratos, etc.) las resuelven el formulario (withDependencies) y el backend (expand_modules).
export interface RubroInfo { key: string; label: string; icon: string; tagline: string; modules: string[] }

export const RUBROS: RubroInfo[] = [
  {
    key: "ALQUILERES", label: "Inmobiliaria de alquileres", icon: "🔑",
    tagline: "Contratos, cobranza y liquidación",
    modules: ["contratos", "cobranzas", "liquidaciones", "garantias", "mantenimiento", "inspecciones", "documentos", "web_portal", "reportes"],
  },
  {
    key: "VENTAS", label: "Inmobiliaria de ventas", icon: "🏡",
    tagline: "Interesados, visitas y web",
    modules: ["crm", "visitas", "documentos", "web_propiedades", "uif", "reportes"],
  },
  {
    key: "INTEGRAL", label: "Inmobiliaria integral", icon: "🏘️",
    tagline: "Alquiler y venta, todo junto",
    modules: ["contratos", "cobranzas", "liquidaciones", "garantias", "expensas", "mantenimiento", "inspecciones", "documentos", "visitas", "crm", "uif", "reportes", "web_propiedades", "web_portal"],
  },
  {
    key: "ADMINISTRACION", label: "Administración de propiedades", icon: "🏢",
    tagline: "Expensas, mantenimiento y portal",
    modules: ["contratos", "cobranzas", "liquidaciones", "expensas", "mantenimiento", "inspecciones", "documentos", "web_portal", "reportes"],
  },
  {
    key: "CORREDOR", label: "Corredor o martillero", icon: "🤝",
    tagline: "Interesados, visitas y catálogo",
    modules: ["crm", "visitas", "documentos", "web_propiedades"],
  },
  {
    key: "DESARROLLISTA", label: "Desarrolladora y loteos", icon: "🏗️",
    tagline: "Interesados, contratos y UIF",
    modules: ["crm", "visitas", "contratos", "documentos", "uif", "web_propiedades", "reportes"],
  },
];

export const RUBRO_LABELS: Record<string, string> = Object.fromEntries(RUBROS.map((r) => [r.key, r.label]));

export function rubroInfo(key: string | null | undefined): RubroInfo | undefined {
  return RUBROS.find((r) => r.key === key);
}

/** Módulos sugeridos para el rubro (vacío si no hay rubro) */
export function suggestedModules(key: string | null | undefined): string[] {
  return [...(rubroInfo(key)?.modules || [])];
}
