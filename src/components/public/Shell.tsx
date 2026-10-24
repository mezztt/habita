import { useEffect } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { APP_NAME } from "../../config";
import { PoweredBy, HabitaLogo, useLightPage } from "../Brand";
import { ConsumerButtons } from "./ConsumerButtons";

/** Datos públicos de la inmobiliaria (GET /public/{slug}/info) */
export interface Agency {
  slug: string; name: string; address: string | null; phone: string | null; email: string | null;
  broker_name: string | null; broker_license: string | null; broker_college: string | null;
  web_propiedades: boolean; web_portal: boolean;
}

/** Marco de las webs públicas de la inmobiliaria: encabezado con sus datos, contenido y pie legal */
export function Shell({ title, agency, heading, intro, children, bar, error, source }: {
  title: string; agency: Agency | null; heading: string; intro?: string; children?: ReactNode; bar?: ReactNode; error?: string;
  source?: "propiedades" | "portal";
}) {
  useLightPage();
  useEffect(() => { document.title = `${agency?.name ? agency.name + " · " : ""}${title}`; }, [agency?.name, title]);
  return (
    <div className="pb-page r3-pub-page">
      <header className="pb-hero">
        <div className="pb-wrap">
          <div className="pb-top"><HabitaLogo size={38} /><div><strong>{agency?.name || APP_NAME}</strong><small>{[agency?.address, agency?.phone].filter(Boolean).join(" · ") || title}</small></div></div>
          <h1>{heading}</h1>
          {intro && <p>{intro}</p>}
        </div>
      </header>
      <main className="pb-wrap pb-main">
        {error ? <div className="pb-card"><div className="pb-error" role="alert">{error}</div></div> : children}
        {agency && <AgencyInfo agency={agency} />}
        {agency?.slug && !error && <ConsumerButtons slug={agency.slug} source={source} />}
      </main>
      {bar}
      <footer className="pb-foot"><PoweredBy /></footer>
    </div>
  );
}

/** Datos de contacto y matrícula del corredor inmobiliario */
export function AgencyInfo({ agency }: { agency: Agency }) {
  const lines = [
    agency.broker_name && `Corredor inmobiliario: ${agency.broker_name}`,
    agency.broker_license && `Matrícula ${agency.broker_license}${agency.broker_college ? ` · ${agency.broker_college}` : ""}`,
    agency.email && `Email: ${agency.email}`,
  ].filter(Boolean) as string[];
  if (!lines.length) return null;
  return (
    <div className="pb-card">
      <span className="pb-step-label">Sobre la inmobiliaria</span>
      {lines.map((l) => <p key={l} className="r3-pub-legal" style={{ margin: "0 0 4px" }}>{l}</p>)}
    </div>
  );
}

export function Consent({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="r3-pub-check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>Acepto los <Link to="/legal/terminos">Términos</Link> y la <Link to="/legal/privacidad">Política de privacidad</Link>, y que la inmobiliaria use mis datos para responder esta consulta (Ley 25.326).</span>
    </label>
  );
}
