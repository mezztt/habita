import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminApi, money, moduleLabel, shortDate, ALL_MODULES, dateTime } from "../../config";

interface Overview {
  pending_cancellations?: number;
  total_systems: number;
  active_systems: number;
  inactive_systems: number;
  overdue_systems: number;
  monthly_recurring: number;
  collected_this_month: number;
  months: { period: string; total: number }[];
  module_usage: Record<string, number>;
  upcoming_due: {
    id: number; name: string; payment_due_date: string;
    payment_status: string; client_price: number; overdue: boolean;
  }[];
  recent_payments: {
    id: number; company_name: string; amount: number; payment_date: string; method: string | null;
  }[];
  recent_systems: { id: number; name: string; city: string | null; created_at: string }[];
}

interface Cancellation { id: number; company_id: number; company_name: string; code: string; reason: string | null; status: string; created_at: string; service_end_date?: string | null }

const MONTHS_ES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function AdminHome() {
  const navigate = useNavigate();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [bajas, setBajas] = useState<Cancellation[]>([]);

  useEffect(() => {
    adminApi<Overview>("/admin/overview")
      .then(setData)
      .catch((e) => setError(e.message));
    loadBajas();
  }, []);

  function loadBajas() {
    adminApi<Cancellation[]>("/admin/cancellations").then(setBajas).catch(() => {});
  }
  async function attend(id: number) {
    try {
      await adminApi(`/admin/cancellations/${id}/attend`, { method: "POST" });
      loadBajas();
      setData((d) => (d ? { ...d, pending_cancellations: Math.max(0, (d.pending_cancellations || 0) - 1) } : d));
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo marcar"); }
  }

  if (error) {
    return (
      <section className="products-page">
        <div className="products-empty"><h3>No se pudo cargar el resumen</h3><p>{error}</p></div>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="products-page">
        <div className="products-loading"><div className="products-loading-spinner" /><span>Cargando...</span></div>
      </section>
    );
  }

  const maxMonth = Math.max(1, ...data.months.map((m) => m.total));
  const collectedPct = data.monthly_recurring > 0
    ? Math.min(100, Math.round((data.collected_this_month / data.monthly_recurring) * 100))
    : 0;

  return (
    <section className="products-page">
      <div className="products-header">
        <div>
          <span className="dashboard-eyebrow">MEZZTT · HABITA</span>
          <h1>Inicio</h1>
          <p>Cómo vienen tus inmobiliarias y cobros.</p>
        </div>
        <div className="products-header-actions">
          <button className="primary-button" onClick={() => navigate("/admin/sistemas?nuevo=1")}>+ Nuevo sistema</button>
        </div>
      </div>

      <div className="dashboard-cards">
        <div className="dashboard-card">
          <span>Sistemas activos</span>
          <strong>{data.active_systems}</strong>
          <small>{data.total_systems} en total · {data.inactive_systems} de baja</small>
        </div>
        <div className="dashboard-card">
          <span>Ingreso mensual esperado</span>
          <strong>{money(data.monthly_recurring)}</strong>
          <small>Suma de abonos de sistemas activos</small>
        </div>
        <div className="dashboard-card">
          <span>Cobrado este mes</span>
          <strong>{money(data.collected_this_month)}</strong>
          <div className="hb-progress" title={`${collectedPct}% del esperado`}>
            <div style={{ width: `${collectedPct}%` }} />
          </div>
          <small>{collectedPct}% del esperado</small>
        </div>
        <div className={`dashboard-card ${data.overdue_systems > 0 ? "hb-card-warn" : ""}`}>
          <span>Pagos atrasados</span>
          <strong>{data.overdue_systems}</strong>
          <small>Más de 10 días después del vencimiento</small>
        </div>
      </div>

      {bajas.some((b) => b.status === "PENDIENTE" || b.status === "SOLICITADA") && (
        <div className="dashboard-section hb-card-warn" data-tour="admin-bajas">
          <div className="section-heading"><h2>Bajas del servicio ({data.pending_cancellations || 0})</h2><p>Disposición 954/2025. Las pedidas desde el panel siguen hasta el fin del período pagado y se cortan solas.</p></div>
          <ul className="hb-list">
            {bajas.filter((b) => b.status === "PENDIENTE" || b.status === "SOLICITADA").map((b) => (
              <li key={b.id}>
                <div className="hb-list-main">
                  <strong>{b.company_name} · {b.code}</strong>
                  <small>{dateTime(b.created_at)}{b.status === "SOLICITADA" ? ` · Baja solicitada · hasta ${(b.service_end_date || "").split("-").reverse().join("/")}` : " · Pedido sin sesión: confirmá con el administrador"}{b.reason ? ` · ${b.reason}` : ""}</small>
                </div>
                {b.status === "PENDIENTE" && <button className="secondary-button" onClick={() => attend(b.id)}>Marcar atendido</button>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="hb-grid-2">
        <div className="dashboard-section">
          <div className="section-heading"><h2>Cobrado por mes</h2><p>Últimos 6 meses</p></div>
          <div className="hb-bars">
            {data.months.map((m) => {
              const [, mm] = m.period.split("-");
              return (
                <div key={m.period} className="hb-bar-col" title={`${m.period}: ${money(m.total)}`}>
                  <span className="hb-bar-value">{m.total > 0 ? money(m.total) : ""}</span>
                  <div className="hb-bar-track">
                    <div className="hb-bar" style={{ height: `${(m.total / maxMonth) * 100}%` }} />
                  </div>
                  <span className="hb-bar-label">{MONTHS_ES[Number(mm) - 1]}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="dashboard-section">
          <div className="section-heading"><h2>Próximos vencimientos</h2><p>Vencidos y próximos 15 días</p></div>
          {data.upcoming_due.length === 0 ? (
            <p className="hb-muted">No hay vencimientos cerca.</p>
          ) : (
            <ul className="hb-list">
              {data.upcoming_due.map((u) => (
                <li key={u.id} onClick={() => navigate(`/admin/sistemas?id=${u.id}`)}>
                  <span className={`hb-dot ${u.overdue ? "warn" : new Date(u.payment_due_date) < new Date() ? "late" : "ok"}`} />
                  <div className="hb-list-main">
                    <strong>{u.name}</strong>
                    <small>Vence {shortDate(u.payment_due_date)} · {u.payment_status === "al_dia" ? "Al día" : u.payment_status}</small>
                  </div>
                  <span className="hb-list-amount">{money(u.client_price)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="hb-grid-3">
        <div className="dashboard-section">
          <div className="section-heading"><h2>Últimos pagos</h2></div>
          {data.recent_payments.length === 0 ? (
            <p className="hb-muted">Todavía no registraste pagos.</p>
          ) : (
            <ul className="hb-list">
              {data.recent_payments.map((p) => (
                <li key={p.id} onClick={() => navigate("/admin/pagos")}>
                  <div className="hb-list-main">
                    <strong>{p.company_name}</strong>
                    <small>{shortDate(p.payment_date)} · {p.method || "—"}</small>
                  </div>
                  <span className="hb-list-amount">{money(p.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="dashboard-section">
          <div className="section-heading"><h2>Módulos más usados</h2><p>En sistemas activos</p></div>
          <ul className="hb-usage">
            {ALL_MODULES.map((m) => {
              const n = data.module_usage[m] ?? 0;
              const pct = data.active_systems ? (n / data.active_systems) * 100 : 0;
              return (
                <li key={m}>
                  <div className="hb-usage-row"><span>{moduleLabel(m)}</span><strong>{n}</strong></div>
                  <div className="hb-progress"><div style={{ width: `${Math.min(100, pct)}%` }} /></div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="dashboard-section">
          <div className="section-heading"><h2>Sistemas nuevos</h2></div>
          {data.recent_systems.length === 0 ? (
            <p className="hb-muted">Todavía no creaste sistemas.</p>
          ) : (
            <ul className="hb-list">
              {data.recent_systems.map((s) => (
                <li key={s.id} onClick={() => navigate(`/admin/sistemas?id=${s.id}`)}>
                  <div className="hb-list-main">
                    <strong>{s.name}</strong>
                    <small>{s.city || "Sin ciudad"} · alta {shortDate(s.created_at)}</small>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

export default AdminHome;
