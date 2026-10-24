import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { appApi, canAccess, getSessionUser, publicLinks, dateTime, shortDate } from "../../config";
import { BajaServicioCard } from "../../components/BajaServicio";
import { startTour } from "../../components/tour/Tour";
import { RUBROS, rubroInfo } from "../../rubros";
import { Empty, Field, Loading, Modal, PageHeader, Pill, Switch, Tabs, numOrNull, strOrNull, useFlash } from "../../components/ui";

interface Settings {
  name: string | null; legal_name: string | null; cuit_text: string | null; tax_condition_text: string | null;
  address: string | null; phone: string | null; email: string | null;
  broker_name: string | null; broker_license: string | null; broker_college: string | null;
  receipt_point: string; receipt_next_number: number; receipt_footer: string | null; payment_alias: string | null;
  default_admin_commission_pct: number; default_tenant_commission_months: number; iva_on_commission: boolean;
  late_interest_monthly_pct: number; grace_days: number;
  adjust_alert_days: number; expiry_alert_days: number[]; default_rounding: string;
  stamp_rate_pct: number | null; stamp_tenant_share_pct: number; stamp_housing_exempt: boolean;
  smvm_value: number | null; portal_token_days: number; owner_approval_limit: number | null;
  mp_enabled: boolean; mp_access_token: string; mp_configured: boolean;
}
interface Template { id: number; kind: string; name: string; body: string; active: boolean }
interface StarterPreview { rubro: string | null; label: string | null; message_templates: { kind: string; name: string }[] }
interface IndexCode { code: string; label: string; kind: string | null }
interface IndexRow { id: number; code: string; kind: string; date: string; value: number; source_text: string | null; own: boolean }
interface ConsumerReq { id: number; kind: string; code: string; customer_name: string; contact: string; reference: string | null; detail: string | null; status: string; created_at: string }

type Tab = "inmobiliaria" | "recibos" | "comisiones" | "alertas" | "plantillas" | "indices" | "mp" | "ayuda";

const KIND_LABELS: Record<string, string> = {
  RECORDATORIO_PAGO: "Recordatorio de pago", AVISO_AJUSTE: "Aviso de ajuste", MORA: "Mora", VISITA: "Visita",
  RENOVACION: "Renovación", REPARACION: "Reparación", LIBRE: "Libre",
};
const VARIABLES = ["{nombre}", "{monto}", "{periodo}", "{vencimiento}", "{direccion}", "{alias}", "{inmobiliaria}"];

function Configuracion() {
  const user = getSessionUser();
  const location = useLocation();
  const { show, fail, node: flash } = useFlash();
  const [tab, setTab] = useState<Tab>(() => ((location.state as { tab?: Tab } | null)?.tab) || "inmobiliaria");
  const [s, setS] = useState<Settings | null>(null);
  const [alertsText, setAlertsText] = useState("");
  const [mpToken, setMpToken] = useState("");
  const [pedidos, setPedidos] = useState<ConsumerReq[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [rubro, setRubro] = useState("");
  const [starter, setStarter] = useState<StarterPreview | null>(null);
  const [loadingStarter, setLoadingStarter] = useState(false);
  const [editTpl, setEditTpl] = useState<Template | "new" | null>(null);
  const [codes, setCodes] = useState<IndexCode[]>([]);
  const [indices, setIndices] = useState<IndexRow[]>([]);
  const [ixCode, setIxCode] = useState("");
  const [ixDate, setIxDate] = useState("");
  const [ixValue, setIxValue] = useState("");
  const [ixSource, setIxSource] = useState("");

  const applySettings = useCallback((d: Settings) => { setS(d); setAlertsText((d.expiry_alert_days || []).join(", ")); }, []);
  const loadTemplates = useCallback(() => { appApi<Template[]>("/message-templates").then(setTemplates).catch(fail); }, [fail]);
  const loadIndices = useCallback(() => {
    appApi<{ codes: IndexCode[]; items: IndexRow[] }>("/indices").then((d) => { setCodes(d.codes); setIndices(d.items); setIxCode((c) => c || d.codes[0]?.code || ""); }).catch(fail);
  }, [fail]);

  const loadStarter = useCallback(() => {
    if (getSessionUser()?.role !== "ADMINISTRADOR") return;
    appApi<StarterPreview>("/company/rubro-starter").then(setStarter).catch(() => {});
  }, []);

  useEffect(() => {
    appApi<{ rubro: string | null }>("/company").then((c) => setRubro(c.rubro || "")).catch(() => {});
    loadStarter();
    appApi<Settings>("/settings").then(applySettings).catch(fail);
    appApi<ConsumerReq[]>("/consumer-requests").then(setPedidos).catch(() => {});
    loadTemplates();
    loadIndices();
  }, [applySettings, fail, loadTemplates, loadIndices, loadStarter]);

  async function saveSettings(patch: Record<string, unknown>, message = "Configuración guardada") {
    try { applySettings(await appApi<Settings>("/settings", { method: "PUT", body: patch })); show(message); }
    catch (e) { fail(e); }
  }
  async function saveIndex() {
    try {
      const kind = codes.find((c) => c.code === ixCode)?.kind || "NIVEL";
      await appApi("/indices", { method: "POST", body: { code: ixCode, date: ixDate, value: Number(ixValue.replace(",", ".")), kind, source_text: strOrNull(ixSource) } });
      setIxValue(""); setIxSource(""); show("Valor guardado"); loadIndices();
    } catch (e) { fail(e); }
  }
  async function removeIndex(id: number) {
    try { await appApi(`/indices/${id}`, { method: "DELETE" }); show("Valor borrado"); loadIndices(); } catch (e) { fail(e); }
  }
  async function saveRubro(key: string) {
    const previous = rubro;
    setRubro(key);
    try { await appApi("/company", { method: "PUT", body: { rubro: key } }); show("Tipo de negocio guardado"); loadStarter(); }
    catch (e) { setRubro(previous); fail(e); }
  }
  async function loadSuggestions() {
    setLoadingStarter(true);
    try {
      const r = await appApi<{ created: number; skipped: number }>("/company/rubro-starter", { method: "POST" });
      show(r.created ? `Cargamos ${r.created} sugerencia${r.created === 1 ? "" : "s"}. Las que ya tenías quedaron como estaban.` : "Ya tenías todas las sugerencias cargadas");
      loadTemplates(); loadStarter();
    } catch (e) { fail(e); } finally { setLoadingStarter(false); }
  }
  async function removeTemplate(id: number) {
    try { await appApi(`/message-templates/${id}`, { method: "DELETE" }); show("Plantilla borrada"); loadTemplates(); } catch (e) { fail(e); }
  }

  if (!s) return <Loading />;
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS({ ...s, [k]: v });
  const text = (k: keyof Settings) => (s[k] as string | null) || "";
  const links = publicLinks(user?.company_slug);
  const webs: [string, string, string][] = [["web_propiedades", "Catálogo de propiedades", links.propiedades]];
  const ownCodes = codes.filter((c) => c.code.startsWith("PROPIO_"));

  return (
    <section className="products-page">
      <PageHeader eyebrow="CONFIGURACIÓN" title="Configuración" subtitle="Datos de la inmobiliaria, recibos, honorarios, mora, alertas, mensajes e índices." />
      <Tabs<Tab> value={tab} onChange={setTab} options={[
        ["inmobiliaria", "Inmobiliaria"], ["recibos", "Recibos"], ["comisiones", "Honorarios y mora"], ["alertas", "Alertas y sellado"],
        ["plantillas", "Mensajes"], ["indices", "Índices"], ["mp", "Mercado Pago"], ["ayuda", "Ayuda y baja"],
      ]} />

      {tab === "inmobiliaria" && (
        <div className="hb-card" style={{ marginBottom: 16 }}>
          <h2>Tipo de negocio</h2>
          <p className="hb-muted">Cuenta a qué se dedica la inmobiliaria. No cambia lo que tenés contratado: sirve para ofrecerte sugerencias ya armadas.</p>
          <div className="product-form">
            <Field label="¿A qué se dedica tu inmobiliaria?">
              <select value={rubro} disabled={user?.role !== "ADMINISTRADOR"} onChange={(e) => e.target.value && saveRubro(e.target.value)}>
                <option value="">Sin elegir</option>
                {RUBROS.map((r) => <option key={r.key} value={r.key}>{r.icon} {r.label}</option>)}
              </select>
            </Field>
            {rubroInfo(rubro) && <p className="hb-muted">{rubroInfo(rubro)!.tagline}</p>}
            {user?.role === "ADMINISTRADOR" && rubroInfo(rubro) && (
              <div>
                <button className="secondary-button" disabled={loadingStarter} onClick={loadSuggestions}>
                  {loadingStarter ? "Cargando..." : `Cargar sugerencias de ${rubroInfo(rubro)!.label.toLowerCase()}`}
                </button>
                <p className="hb-muted" style={{ marginTop: 8 }}>
                  Suma plantillas de mensajes para {starter?.message_templates.length ?? 0} situaciones típicas ({(starter?.message_templates || []).map((t) => t.name.toLowerCase()).join(", ")}).
                  Solo agrega lo que falta: no borra ni cambia nada de lo que ya cargaste.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "inmobiliaria" && (
        <div className="hb-card">
          <h2>Datos de la inmobiliaria</h2>
          <p className="hb-muted">Salen en los recibos, las liquidaciones y las páginas públicas. La matrícula del corredor es obligatoria en la publicidad inmobiliaria.</p>
          <div className="product-form">
            <div className="form-row">
              <Field label="Nombre comercial"><input value={text("name")} onChange={(e) => set("name", e.target.value)} /></Field>
              <Field label="Razón social"><input value={text("legal_name")} onChange={(e) => set("legal_name", e.target.value)} /></Field>
            </div>
            <div className="form-row">
              <Field label="CUIT"><input value={text("cuit_text")} onChange={(e) => set("cuit_text", e.target.value)} /></Field>
              <Field label="Condición frente al IVA"><input value={text("tax_condition_text")} placeholder="Responsable inscripto, monotributo…" onChange={(e) => set("tax_condition_text", e.target.value)} /></Field>
            </div>
            <div className="form-row">
              <Field label="Teléfono"><input value={text("phone")} onChange={(e) => set("phone", e.target.value)} /></Field>
              <Field label="Email"><input value={text("email")} onChange={(e) => set("email", e.target.value)} /></Field>
            </div>
            <Field label="Dirección"><input value={text("address")} onChange={(e) => set("address", e.target.value)} /></Field>
            <div className="form-row">
              <Field label="Corredor inmobiliario"><input value={text("broker_name")} onChange={(e) => set("broker_name", e.target.value)} /></Field>
              <Field label="Matrícula"><input value={text("broker_license")} onChange={(e) => set("broker_license", e.target.value)} /></Field>
            </div>
            <Field label="Colegio o entidad que matriculó"><input value={text("broker_college")} onChange={(e) => set("broker_college", e.target.value)} /></Field>
            <button className="primary-button" style={{ alignSelf: "flex-start" }}
              onClick={() => saveSettings({ name: text("name"), legal_name: text("legal_name"), cuit_text: text("cuit_text"), tax_condition_text: text("tax_condition_text"), phone: text("phone"), email: text("email"), address: text("address"), broker_name: text("broker_name"), broker_license: text("broker_license"), broker_college: text("broker_college") }, "Datos guardados")}>Guardar datos</button>
          </div>
        </div>
      )}

      {tab === "recibos" && (
        <div className="hb-card">
          <h2>Recibos</h2>
          <p className="hb-muted">Los recibos son internos y dicen siempre «Documento no válido como factura». La factura la emitís con tu sistema habitual de ARCA.</p>
          <div className="product-form">
            <div className="form-row">
              <Field label="Punto de recibo" hint="4 números. Ejemplo: 0001."><input maxLength={4} inputMode="numeric" value={s.receipt_point} onChange={(e) => set("receipt_point", e.target.value.replace(/\D/g, ""))} /></Field>
              <Field label="Próximo número" hint="No puede ser menor a uno ya emitido."><input inputMode="numeric" value={s.receipt_next_number} onChange={(e) => set("receipt_next_number", numOrNull(e.target.value) ?? 1)} /></Field>
            </div>
            <Field label="Alias o CBU para cobrar" hint="Sale en los recordatorios por WhatsApp."><input value={text("payment_alias")} onChange={(e) => set("payment_alias", e.target.value)} /></Field>
            <Field label="Texto al pie del recibo"><input value={text("receipt_footer")} onChange={(e) => set("receipt_footer", e.target.value)} /></Field>
            <Field label="Redondeo de los alquileres">
              <select value={s.default_rounding} onChange={(e) => set("default_rounding", e.target.value)}>
                <option value="CENTAVOS">A los centavos</option><option value="PESO">Al peso</option>
              </select>
            </Field>
            <button className="primary-button" style={{ alignSelf: "flex-start" }}
              onClick={() => saveSettings({ receipt_point: s.receipt_point, receipt_next_number: s.receipt_next_number, payment_alias: text("payment_alias"), receipt_footer: text("receipt_footer"), default_rounding: s.default_rounding }, "Recibos guardados")}>Guardar</button>
          </div>
        </div>
      )}

      {tab === "comisiones" && (
        <div className="hb-grid-2">
          <div className="hb-card">
            <h2>Honorarios</h2>
            <p className="hb-muted">Valores por defecto: cada contrato puede tener los suyos.</p>
            <div className="product-form">
              <Field label="Honorarios de administración (% del alquiler cobrado)"><input inputMode="decimal" value={s.default_admin_commission_pct} onChange={(e) => set("default_admin_commission_pct", numOrNull(e.target.value) ?? 0)} /></Field>
              <Field label="Comisión al inquilino al firmar (meses de alquiler)"><input inputMode="decimal" value={s.default_tenant_commission_months} onChange={(e) => set("default_tenant_commission_months", numOrNull(e.target.value) ?? 0)} /></Field>
              <Switch on={s.iva_on_commission} onChange={(v) => set("iva_on_commission", v)} label="Los honorarios llevan IVA" hint="Si facturás como monotributista, dejalo apagado." />
              <button className="primary-button" style={{ alignSelf: "flex-start" }}
                onClick={() => saveSettings({ default_admin_commission_pct: s.default_admin_commission_pct, default_tenant_commission_months: s.default_tenant_commission_months, iva_on_commission: s.iva_on_commission }, "Honorarios guardados")}>Guardar</button>
            </div>
          </div>
          <div className="hb-card">
            <h2>Mora</h2>
            <p className="hb-muted">Lo que figure en el contrato manda. Estos son los valores por defecto.</p>
            <div className="product-form">
              <Field label="Interés punitorio mensual (%)"><input inputMode="decimal" value={s.late_interest_monthly_pct} onChange={(e) => set("late_interest_monthly_pct", numOrNull(e.target.value) ?? 0)} /></Field>
              <Field label="Días de gracia después del vencimiento"><input inputMode="numeric" value={s.grace_days} onChange={(e) => set("grace_days", numOrNull(e.target.value) ?? 0)} /></Field>
              <Field label="Tope de reparaciones sin aprobación del propietario ($)" hint="0 = siempre pedir aprobación."><input inputMode="decimal" value={s.owner_approval_limit ?? 0} onChange={(e) => set("owner_approval_limit", numOrNull(e.target.value) ?? 0)} /></Field>
              <button className="primary-button" style={{ alignSelf: "flex-start" }}
                onClick={() => saveSettings({ late_interest_monthly_pct: s.late_interest_monthly_pct, grace_days: s.grace_days, owner_approval_limit: s.owner_approval_limit ?? 0 }, "Mora guardada")}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {tab === "alertas" && (
        <div className="hb-grid-2">
          <div className="hb-card">
            <h2>Alertas</h2>
            <div className="product-form">
              <Field label="Avisar de un ajuste con (días de anticipación)"><input inputMode="numeric" value={s.adjust_alert_days} onChange={(e) => set("adjust_alert_days", numOrNull(e.target.value) ?? 30)} /></Field>
              <Field label="Avisar de vencimientos con (días, separados por coma)" hint="Ejemplo: 90, 60, 30"><input value={alertsText} onChange={(e) => setAlertsText(e.target.value)} /></Field>
              <Field label="Días de vida del link del portal"><input inputMode="numeric" value={s.portal_token_days} onChange={(e) => set("portal_token_days", numOrNull(e.target.value) ?? 30)} /></Field>
              <button className="primary-button" style={{ alignSelf: "flex-start" }}
                onClick={() => saveSettings({ adjust_alert_days: s.adjust_alert_days, portal_token_days: s.portal_token_days, expiry_alert_days: alertsText.split(",").map((x) => Number(x.trim())).filter((n) => Number.isInteger(n) && n > 0) }, "Alertas guardadas")}>Guardar</button>
            </div>
          </div>
          <div className="hb-card">
            <h2>Sellado y SMVM</h2>
            <p className="hb-muted">Habita no trae una alícuota de sellado cargada: depende de la jurisdicción. Cargala vos con el dato de tu contador.</p>
            <div className="product-form">
              <Field label="Alícuota de sellado (%)" hint="Vacío = no calcular."><input inputMode="decimal" value={s.stamp_rate_pct ?? ""} onChange={(e) => set("stamp_rate_pct", numOrNull(e.target.value))} /></Field>
              <Field label="Parte del inquilino (%)"><input inputMode="decimal" value={s.stamp_tenant_share_pct} onChange={(e) => set("stamp_tenant_share_pct", numOrNull(e.target.value) ?? 50)} /></Field>
              <Switch on={s.stamp_housing_exempt} onChange={(v) => set("stamp_housing_exempt", v)} label="Vivienda exenta de sellado" hint="Algunas jurisdicciones eximen la vivienda única de uso permanente." />
              <Field label="Salario mínimo vital y móvil ($)" hint="Se usa para algunos controles de la UIF."><input inputMode="decimal" value={s.smvm_value ?? ""} onChange={(e) => set("smvm_value", numOrNull(e.target.value))} /></Field>
              <button className="primary-button" style={{ alignSelf: "flex-start" }}
                onClick={() => saveSettings({ stamp_rate_pct: s.stamp_rate_pct ?? 0, stamp_tenant_share_pct: s.stamp_tenant_share_pct, stamp_housing_exempt: s.stamp_housing_exempt, smvm_value: s.smvm_value ?? 0 }, "Sellado guardado")}>Guardar</button>
            </div>
          </div>
        </div>
      )}

      {tab === "plantillas" && (
        <div className="hb-card">
          <div className="hb-card-head"><div><h2>Mensajes de WhatsApp</h2><p>Se abren con un link de WhatsApp para que los envíes vos: Habita no manda mensajes por su cuenta. Variables: {VARIABLES.join(" ")}</p></div>
            <button className="primary-button" onClick={() => setEditTpl("new")}>+ Nueva plantilla</button></div>
          {templates.length === 0 ? <Empty title="No hay plantillas">Creá la primera con «Nueva plantilla».</Empty> : (
            <ul className="hb-list">{templates.map((t) => (
              <li key={t.id}><div className="hb-list-main"><strong>{t.name} <Pill tone={t.active ? "green" : "gray"}>{t.active ? "Activa" : "Apagada"}</Pill></strong><small>{KIND_LABELS[t.kind] || t.kind} · {t.body}</small></div>
                <button className="secondary-button" onClick={() => setEditTpl(t)}>Editar</button>
                <button className="hb-link hb-link-danger" onClick={() => removeTemplate(t.id)}>Borrar</button></li>
            ))}</ul>
          )}
        </div>
      )}

      {tab === "indices" && (
        <div className="hb-grid-2">
          <div className="hb-card">
            <h2>Índices de ajuste</h2>
            <p className="hb-muted">Los valores de ICL, IPC, ICP, UVA, CAC y CER los carga Mezztt con su fuente y fecha. Habita no garantiza que coincidan con la publicación oficial: confirmalos antes de comunicar un ajuste. Si cargás un valor propio, prevalece en tu inmobiliaria.</p>
            <div className="product-form">
              <Field label="Índice"><select value={ixCode} onChange={(e) => setIxCode(e.target.value)}>{(ownCodes.length ? ownCodes : codes).map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}</select></Field>
              <div className="form-row">
                <Field label="Fecha"><input type="date" value={ixDate} onChange={(e) => setIxDate(e.target.value)} /></Field>
                <Field label="Valor"><input inputMode="decimal" value={ixValue} onChange={(e) => setIxValue(e.target.value)} /></Field>
              </div>
              <Field label="Fuente (opcional)"><input value={ixSource} onChange={(e) => setIxSource(e.target.value)} /></Field>
              <button className="primary-button" style={{ alignSelf: "flex-start" }} disabled={!ixCode || !ixDate || !ixValue} onClick={saveIndex}>Guardar valor propio</button>
            </div>
          </div>
          <div className="hb-card">
            <h2>Valores vigentes</h2>
            {indices.length === 0 ? <Empty title="Todavía no hay valores">Cuando Mezztt cargue los índices los vas a ver acá.</Empty> : (
              <div className="hb-table-wrap"><table className="hb-table">
                <thead><tr><th>Índice</th><th>Fecha</th><th>Valor</th><th>Origen</th><th></th></tr></thead>
                <tbody>{indices.slice(0, 40).map((r) => (
                  <tr key={r.id}><td>{r.code}</td><td>{shortDate(r.date)}</td><td>{r.value}</td><td>{r.own ? "Propio" : "Mezztt"}{r.source_text ? <small>{r.source_text}</small> : null}</td>
                    <td>{r.own && <button className="hb-link hb-link-danger" onClick={() => removeIndex(r.id)}>Borrar</button>}</td></tr>
                ))}</tbody>
              </table></div>
            )}
          </div>
        </div>
      )}

      {tab === "mp" && (
        <div className="hb-card">
          <h2>Mercado Pago</h2>
          <p className="hb-muted">Opcional. Cargá el Access Token de tu cuenta: el cobro va directo a vos. Mercado Pago cobra sus comisiones; Habita no cobra nada extra.</p>
          <div className="product-form">
            <Field label="Access Token" hint={s.mp_configured ? `Conectado (${s.mp_access_token}). Pegá uno nuevo para cambiarlo.` : "Lo encontrás en Mercado Pago → Tu negocio → Credenciales."}>
              <input type="password" autoComplete="off" value={mpToken} placeholder={s.mp_configured ? s.mp_access_token : "APP_USR-…"} onChange={(e) => setMpToken(e.target.value)} />
            </Field>
            <Switch on={s.mp_enabled} onChange={(v) => set("mp_enabled", v)} label="Ofrecer pago con Mercado Pago" />
            <div className="hb-row">
              <button className="primary-button" onClick={() => { saveSettings({ ...(mpToken ? { mp_access_token: mpToken } : {}), mp_enabled: s.mp_enabled }, "Mercado Pago guardado"); setMpToken(""); }}>Guardar</button>
              {s.mp_configured && <button className="secondary-button" onClick={() => saveSettings({ mp_access_token: "", mp_enabled: false }, "Mercado Pago desconectado")}>Desconectar</button>}
            </div>
          </div>
        </div>
      )}

      {tab === "ayuda" && (
        <div className="hb-grid-2">
          <div className="hb-card" data-tour="config-tour">
            <h2>¿Cómo funcionamos?</h2>
            <p className="hb-muted">Volvé a ver el recorrido por el sistema.</p>
            <button className="primary-button" onClick={startTour}>¿Cómo funcionamos?</button>
          </div>
          <div className="hb-card">
            <h2>Tus páginas públicas</h2>
            <p className="hb-muted">Links para compartir con tus clientes.</p>
            {webs.filter(([m]) => canAccess(user, m)).length === 0 ? <p className="hb-muted">Tu plan no incluye páginas públicas todavía.</p> : (
              <div className="product-form">
                {webs.filter(([m]) => canAccess(user, m)).map(([m, label, url]) => (
                  <div key={m} className="hb-link-box"><div><strong>{label}</strong><br /><code>{url}</code></div>
                    <button className="secondary-button" onClick={() => { navigator.clipboard?.writeText(url); show("Link copiado"); }}>Copiar</button></div>
                ))}
              </div>
            )}
          </div>
          {user?.role === "ADMINISTRADOR" && <BajaServicioCard />}
          <div className="hb-card">
            <h2>Bajas y arrepentimientos de tus clientes</h2>
            <p className="hb-muted">Inquilinos y propietarios pueden pedirlos desde tus páginas públicas. Cada pedido tiene fecha, hora y código; respondeles por el contacto que dejaron.</p>
            {pedidos.length === 0 ? <p className="hb-muted">Todavía no hay pedidos.</p> : (
              <ul className="hb-list">{pedidos.map((r) => (
                <li key={r.id}><div className="hb-list-main"><strong>{r.kind === "BAJA" ? "Baja" : "Arrepentimiento"} · {r.customer_name} · Código {r.code}</strong>
                  <small>{dateTime(r.created_at)} · {r.contact}{r.reference ? ` · Ref. ${r.reference}` : ""}{r.detail ? ` · ${r.detail}` : ""} · {r.status === "ATENDIDA" ? "Atendido" : "Pendiente"}</small></div>
                  {r.status !== "ATENDIDA" && <button className="secondary-button" onClick={async () => { try { const u = await appApi<ConsumerReq>(`/consumer-requests/${r.id}/attend`, { method: "POST" }); setPedidos((l) => l.map((x) => x.id === u.id ? u : x)); } catch (e) { fail(e); } }}>Marcar atendido</button>}
                </li>))}</ul>
            )}
          </div>
          <div className="hb-card">
            <h2>Importante</h2>
            <p className="hb-muted">Habita no emite comprobantes fiscales: todo recibo, liquidación o resumen dice «Documento no válido como factura». Facturás con tu sistema habitual de ARCA.</p>
            <p className="hb-muted" style={{ marginTop: 8 }}>Habita no es asesoramiento legal ni contable: los contratos, los ajustes y el sellado deben validarse con un profesional.</p>
          </div>
        </div>
      )}
      {editTpl && <TemplateForm tpl={editTpl === "new" ? null : editTpl} onClose={() => setEditTpl(null)} onSaved={() => { setEditTpl(null); loadTemplates(); show("Plantilla guardada"); }} />}
      {flash}
    </section>
  );
}

function TemplateForm({ tpl, onClose, onSaved }: { tpl: Template | null; onClose: () => void; onSaved: () => void }) {
  const [kind, setKind] = useState(tpl?.kind || "RECORDATORIO_PAGO");
  const [name, setName] = useState(tpl?.name || "");
  const [body, setBody] = useState(tpl?.body || "");
  const [active, setActive] = useState(tpl?.active ?? true);
  const [error, setError] = useState("");
  async function save() {
    setError("");
    try {
      if (tpl) await appApi(`/message-templates/${tpl.id}`, { method: "PUT", body: { kind, name, body, active } });
      else await appApi("/message-templates", { method: "POST", body: { kind, name, body, active } });
      onSaved();
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar"); }
  }
  return (
    <Modal eyebrow={tpl ? "EDITAR PLANTILLA" : "NUEVA PLANTILLA"} title={tpl ? tpl.name : "Nueva plantilla"} onClose={onClose}
      footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" onClick={save}>Guardar</button></>}>
      <div className="product-form">
        <Field label="Para qué sirve"><select value={kind} onChange={(e) => setKind(e.target.value)}>{Object.entries(KIND_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
        <Field label="Nombre"><input value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Mensaje" hint={`Variables: ${VARIABLES.join(" ")}`}><textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} /></Field>
        <Switch on={active} onChange={setActive} label="Plantilla activa" />
        {error && <div className="hb-note hb-note-error">{error}</div>}
      </div>
    </Modal>
  );
}

export default Configuracion;
