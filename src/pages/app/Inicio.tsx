import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { appApi, canAccess, getSessionUser, money, pathFor, iconFor, moduleLabel, shortDate } from "../../config";
import Icon from "../../components/Icons";
import { Loading, PageHeader, useRefreshKey } from "../../components/ui";
import Pendientes from "../../components/Pendientes";

interface Overview {
  date: string;
  period: string;
  properties: { total: number; disponibles: number; alquiladas: number };
  contracts?: { active: number; expiring: { id: number; number: string; address: string; end_date: string; days: number }[] };
  adjustments_to_confirm?: number;
  collection?: { expected: number; collected: number; pct: number };
}

/** Atajos del día a día (solo los módulos que la inmobiliaria tiene y el rol puede abrir) */
const SHORTCUTS = ["propiedades", "contratos", "cobranzas", "liquidaciones", "mantenimiento", "crm", "visitas", "reportes"];

function Inicio() {
  const user = getSessionUser();
  const navigate = useNavigate();
  const refreshKey = useRefreshKey();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = () => appApi<Overview>("/dashboard").then(setData).catch((e) => setError(e.message));
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
  }, [refreshKey]);

  if (error) return <div className="hb-note hb-note-error">{error}</div>;
  if (!data) return <Loading />;

  const hour = new Date().getHours();
  const hello = hour < 13 ? "Buen día" : hour < 20 ? "Buenas tardes" : "Buenas noches";
  const shortcuts = SHORTCUTS.filter((m) => canAccess(user, m));

  return (
    <section className="products-page">
      <PageHeader eyebrow="INICIO" title={`${hello}, ${(user?.name || "").split(" ")[0]}`} subtitle={`Así viene el día en ${user?.company_name || "tu inmobiliaria"}.`} />

      <Pendientes />

      <div className="hb-kpis" data-tour="inicio-numeros">
        <div className="hb-kpi"><span>Propiedades</span><strong>{data.properties.total}</strong><small>{data.properties.alquiladas} alquiladas · {data.properties.disponibles} disponibles</small></div>
        {data.contracts && <div className="hb-kpi"><span>Contratos vigentes</span><strong>{data.contracts.active}</strong><small>{data.contracts.expiring.length ? `${data.contracts.expiring.length} por vencer, el próximo el ${shortDate(data.contracts.expiring[0].end_date)}` : "Ninguno por vencer pronto"}</small></div>}
        {data.collection && <div className="hb-kpi"><span>Cobrado del mes</span><strong>{money(data.collection.collected)}</strong><small>{data.collection.pct}% de {money(data.collection.expected)} esperado</small></div>}
      </div>

      {shortcuts.length > 0 && (
        <div className="hb-card" data-tour="atajos">
          <div className="hb-card-head"><div><h2>Atajos</h2><p>Lo que más se usa en el día a día.</p></div></div>
          <div className="hb-shortcuts">
            {shortcuts.map((m) => (
              <button key={m} type="button" className="hb-shortcut" onClick={() => navigate(pathFor(m))}>
                <span aria-hidden="true"><Icon name={iconFor(m)} size={20} /></span>
                <strong>{moduleLabel(m)}</strong>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

export default Inicio;
