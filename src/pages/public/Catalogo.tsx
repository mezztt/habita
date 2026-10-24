// Web pública «Catálogo de propiedades» (módulo web_propiedades): listado con filtros, ficha con fotos y formulario de consulta.
// Backend: backend/routes/web_propiedades.py (prefijo /public/{slug}/...). Rutas: /p/:slug y /p/:slug/:code
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { API_URL, money, publicApi, usd } from "../../config";
import { Shell, Consent } from "../../components/public/Shell";
import type { Agency } from "../../components/public/Shell";
import { PROPERTY_KIND, OPERATION } from "../../components/g3/common";
import "../../g3.css";

interface Card { code: string; kind: string; operation: string; street: string; neighborhood: string | null; city: string | null; rooms: number | null; bedrooms: number | null; bathrooms: number | null; m2_covered: number | null; m2_total: number | null; price: number | null; currency: string; expensas: number | null; cover: string | null }
interface Listing { total: number; items: Card[]; filters: { zones: string[]; kinds: string[]; operations: string[] } }
interface Detail extends Card { description: string | null; amenities: string[]; floor_unit: string | null; photos: { url: string; caption: string | null }[]; agency: { name: string; phone: string | null; email: string | null }; whatsapp_url: string | null }

const price = (c: { price: number | null; currency: string }) => (c.price === null ? "Consultar precio" : c.currency === "USD" ? usd(c.price) : money(c.price));
const place = (c: Card) => [c.street, c.neighborhood, c.city].filter(Boolean).join(", ");

function Catalogo() {
  const { slug, code } = useParams();
  const [agency, setAgency] = useState<Agency | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    publicApi<Agency>(`/public/${slug}/info`).then(setAgency).catch((e) => setError(e instanceof Error ? e.message : "No encontramos esta página"));
  }, [slug]);
  return (
    <Shell title="Propiedades" agency={agency} heading={code ? "Ficha de la propiedad" : "Propiedades disponibles"} intro={code ? undefined : "Mirá lo que tenemos y consultanos sin compromiso."} error={error} source="propiedades">
      {agency && slug && (code ? <Ficha slug={slug} code={code} agency={agency} /> : <Listado slug={slug} />)}
    </Shell>
  );
}

function Listado({ slug }: { slug: string }) {
  const [f, setF] = useState({ operation: "", kind: "", rooms: "", zone: "", min: "", max: "", currency: "" });
  const [data, setData] = useState<Listing | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const qs = new URLSearchParams();
    Object.entries(f).forEach(([k, v]) => { if (v) qs.set(k, v); });
    const t = window.setTimeout(() => { publicApi<Listing>(`/public/${slug}/properties?${qs}`).then((d) => { setData(d); setError(""); }).catch((e) => setError(e instanceof Error ? e.message : "No pudimos cargar las propiedades")); }, 250);
    return () => window.clearTimeout(t);
  }, [slug, f]);
  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));
  return (
    <div className="g3-catalog">
      <div className="pb-card">
        <span className="pb-step-label">Buscar</span>
        <div className="g3-filters">
          <div className="pb-field"><label htmlFor="f-op">Operación</label><select id="f-op" value={f.operation} onChange={(e) => set("operation", e.target.value)}><option value="">Todas</option><option value="ALQUILER">Alquiler</option><option value="VENTA">Venta</option></select></div>
          <div className="pb-field"><label htmlFor="f-kind">Tipo</label><select id="f-kind" value={f.kind} onChange={(e) => set("kind", e.target.value)}><option value="">Todos</option>{(data?.filters.kinds || []).map((k) => <option key={k} value={k}>{PROPERTY_KIND[k] || k}</option>)}</select></div>
          <div className="pb-field"><label htmlFor="f-zone">Zona</label><input id="f-zone" list="zonas" value={f.zone} onChange={(e) => set("zone", e.target.value)} placeholder="Barrio o zona" /><datalist id="zonas">{(data?.filters.zones || []).map((z) => <option key={z} value={z} />)}</datalist></div>
          <div className="pb-field"><label htmlFor="f-rooms">Ambientes (mínimo)</label><select id="f-rooms" value={f.rooms} onChange={(e) => set("rooms", e.target.value)}><option value="">Cualquiera</option>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}+</option>)}</select></div>
          <div className="pb-field"><label htmlFor="f-cur">Moneda</label><select id="f-cur" value={f.currency} onChange={(e) => set("currency", e.target.value)}><option value="">Cualquiera</option><option value="ARS">Pesos</option><option value="USD">Dólares</option></select></div>
          <div className="pb-field"><label htmlFor="f-min">Precio desde</label><input id="f-min" inputMode="numeric" value={f.min} onChange={(e) => set("min", e.target.value)} /></div>
          <div className="pb-field"><label htmlFor="f-max">Precio hasta</label><input id="f-max" inputMode="numeric" value={f.max} onChange={(e) => set("max", e.target.value)} /></div>
        </div>
      </div>
      {error && <div className="pb-error" role="alert">{error}</div>}
      {!data && !error && <div className="pb-card"><p className="r3-pub-legal">Cargando propiedades...</p></div>}
      {data && data.items.length === 0 && <div className="pb-card pb-soon"><b>No hay propiedades con esos filtros</b><p className="r3-pub-legal">Probá con otra zona o precio, o escribinos y te avisamos cuando haya algo.</p></div>}
      {data && data.items.length > 0 && (
        <>
          <p className="r3-pub-legal" style={{ margin: "0 0 10px" }}>{data.total} {data.total === 1 ? "propiedad" : "propiedades"}</p>
          <div className="g3-props">
            {data.items.map((c) => (
              <Link key={c.code} className="g3-prop" to={`/p/${slug}/${encodeURIComponent(c.code)}`}>
                <div className="g3-prop-img">{c.cover ? <img src={API_URL + c.cover} alt={`${PROPERTY_KIND[c.kind] || ""} en ${place(c)}`} loading="lazy" /> : "Sin foto"}</div>
                <div className="g3-prop-body">
                  <div className="g3-prop-price">{price(c)}</div>
                  <p><b>{PROPERTY_KIND[c.kind] || c.kind}</b> en {OPERATION[c.operation]?.toLowerCase() || "alquiler"}</p>
                  <p>{place(c) || "Consultar ubicación"}</p>
                  <div className="g3-tags">{c.rooms ? <span className="g3-tag">{c.rooms} amb.</span> : null}{c.bedrooms ? <span className="g3-tag">{c.bedrooms} dorm.</span> : null}{c.m2_covered ? <span className="g3-tag">{c.m2_covered} m²</span> : null}</div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function Ficha({ slug, code, agency }: { slug: string; code: string; agency: Agency }) {
  const [d, setD] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { publicApi<Detail>(`/public/${slug}/properties/${encodeURIComponent(code)}`).then(setD).catch((e) => setError(e instanceof Error ? e.message : "Esta propiedad ya no está disponible")); }, [slug, code]);
  if (error) return <div className="pb-card"><div className="pb-error" role="alert">{error}</div><Link className="pb-btn pb-btn-ghost" to={`/p/${slug}`}>Ver otras propiedades</Link></div>;
  if (!d) return <div className="pb-card"><p className="r3-pub-legal">Cargando...</p></div>;
  return (
    <>
      <Link to={`/p/${slug}`} className="r3-pub-legal" style={{ display: "inline-block", marginBottom: 8 }}>‹ Volver al listado</Link>
      {d.photos.length > 0 && (
        <div className="g3-gallery">
          <img className="main" src={API_URL + d.photos[0].url} alt={d.photos[0].caption || place(d)} />
          {d.photos.length > 1 && <div className="side">{d.photos.slice(1, 3).map((p) => <img key={p.url} src={API_URL + p.url} alt={p.caption || "Foto de la propiedad"} loading="lazy" />)}</div>}
        </div>
      )}
      {d.photos.length > 3 && <div className="g3-props" style={{ marginBottom: 14, gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))" }}>{d.photos.slice(3).map((p) => <img key={p.url} src={API_URL + p.url} alt={p.caption || "Foto"} loading="lazy" style={{ width: "100%", height: 90, objectFit: "cover", borderRadius: 10 }} />)}</div>}
      <div className="pb-card">
        <span className="pb-step-label">{PROPERTY_KIND[d.kind] || d.kind} · {OPERATION[d.operation] || "Alquiler"} · {d.code}</span>
        <h2 style={{ fontSize: 26 }}>{price(d)}</h2>
        {d.expensas ? <p className="r3-pub-legal">Expensas aproximadas: {money(d.expensas)}</p> : null}
        <p className="r3-pub-legal" style={{ fontSize: 15 }}>{place(d)}{d.floor_unit ? ` · ${d.floor_unit}` : ""}</p>
        <div className="g3-tags">{d.rooms ? <span className="g3-tag">{d.rooms} ambientes</span> : null}{d.bedrooms ? <span className="g3-tag">{d.bedrooms} dormitorios</span> : null}{d.bathrooms ? <span className="g3-tag">{d.bathrooms} baños</span> : null}{d.m2_covered ? <span className="g3-tag">{d.m2_covered} m² cubiertos</span> : null}{d.m2_total ? <span className="g3-tag">{d.m2_total} m² totales</span> : null}{d.amenities.map((a) => <span key={a} className="g3-tag">{a}</span>)}</div>
        {d.description && <p className="r3-pub-legal" style={{ whiteSpace: "pre-line", fontSize: 15, marginTop: 14 }}>{d.description}</p>}
        <p className="r3-pub-legal">La dirección exacta te la damos al coordinar la visita.</p>
        {d.whatsapp_url && <a className="pb-btn" href={d.whatsapp_url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "none", marginTop: 6 }}>Consultar por WhatsApp</a>}
      </div>
      <Consulta slug={slug} code={d.code} agency={agency} />
    </>
  );
}

function Consulta({ slug, code, agency }: { slug: string; code: string; agency: Agency }) {
  const [f, setF] = useState({ full_name: "", phone_area: "", phone_number: "", email: "", message: "", website: "" });
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [ok, setOk] = useState("");
  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));
  async function send(e: { preventDefault: () => void }) {
    e.preventDefault();
    setError("");
    if (f.full_name.trim().length < 2) return setError("Contanos tu nombre y apellido para poder responderte.");
    setBusy(true);
    try {
      const r = await publicApi<{ detail: string }>(`/public/${slug}/inquiries`, { method: "POST", body: { ...f, property_code: code, consent } });
      setOk(r.detail);
    } catch (err) { setError(err instanceof Error ? err.message : "No pudimos enviar la consulta"); } finally { setBusy(false); }
  }
  if (ok) return <div className="pb-card"><div className="pb-msg" role="status">{ok}</div></div>;
  return (
    <form className="pb-card" onSubmit={send} noValidate>
      <span className="pb-step-label">Consultá por esta propiedad</span>
      <p>Dejanos tus datos y {agency.name} te contacta.</p>
      {error && <div className="pb-error" role="alert">{error}</div>}
      <div className="pb-field"><label htmlFor="c-name">Nombre y apellido</label><input id="c-name" value={f.full_name} onChange={(e) => set("full_name", e.target.value)} required minLength={2} autoComplete="name" /></div>
      <div className="pb-row">
        <div className="pb-field"><label htmlFor="c-area">Código de área (sin 0)</label><input id="c-area" inputMode="numeric" value={f.phone_area} onChange={(e) => set("phone_area", e.target.value)} placeholder="261" autoComplete="tel-area-code" /></div>
        <div className="pb-field"><label htmlFor="c-num">Celular (sin 15)</label><input id="c-num" inputMode="numeric" value={f.phone_number} onChange={(e) => set("phone_number", e.target.value)} placeholder="5551234" autoComplete="tel-local" /></div>
      </div>
      <div className="pb-field"><label htmlFor="c-mail">Email (opcional si dejás celular)</label><input id="c-mail" type="email" value={f.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" /></div>
      <div className="pb-field"><label htmlFor="c-msg">Mensaje (opcional)</label><textarea id="c-msg" rows={3} value={f.message} onChange={(e) => set("message", e.target.value)} maxLength={1000} /></div>
      <div className="g3-honeypot" aria-hidden="true"><label>No completar<input tabIndex={-1} autoComplete="off" value={f.website} onChange={(e) => set("website", e.target.value)} /></label></div>
      <Consent checked={consent} onChange={setConsent} />
      <button className="pb-btn" type="submit" disabled={busy || !consent}>{busy ? "Enviando..." : "Enviar consulta"}</button>
    </form>
  );
}

export default Catalogo;
