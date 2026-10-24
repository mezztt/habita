// Links del portal (módulo web_portal): la inmobiliaria genera, copia, manda por WhatsApp o revoca el link de una persona.
import { useCallback, useEffect, useState } from "react";
import { appApi, publicLinks, shortDate } from "../../config";
import { Empty, Loading, Modal, Pill, useFlash } from "../ui";
import "../../g2.css";

interface Link { id: number; party_id: number; party_name: string; kind: string; token: string; path: string; expires_at: string; state: string; last_used_at: string | null }

export function PortalLinkButton({ partyId, kind, name, label = "Link del portal" }: { partyId: number; kind: "INQUILINO" | "PROPIETARIO"; name: string; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="g2-mini" onClick={() => setOpen(true)}>{label}</button>
      {open && <PortalLinkModal partyId={partyId} kind={kind} name={name} onClose={() => setOpen(false)} />}
    </>
  );
}

function PortalLinkModal({ partyId, kind, name, onClose }: { partyId: number; kind: string; name: string; onClose: () => void }) {
  const { show, fail, node } = useFlash();
  const [link, setLink] = useState<Link | null>(null);
  const [wa, setWa] = useState<string | null>(null);
  const [error, setError] = useState("");

  const make = useCallback(async (renew: boolean) => {
    setError("");
    try {
      const l = await appApi<Link>("/portal-links", { method: "POST", body: { party_id: partyId, kind, renew } });
      setLink(l);
      const url = publicLinks(null).portal(l.token);
      const text = `Hola ${name.split(/[\s,]+/)[0] || ""}, este es tu link personal para ver ${kind === "INQUILINO" ? "tu cuenta y tus recibos" : "tus rendiciones y reparaciones"}: ${url}`;
      appApi<{ url: string | null }>(`/wa-link?party_id=${partyId}&text=${encodeURIComponent(text)}`).then((r) => setWa(r.url)).catch(() => setWa(null));
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo generar el link"); }
  }, [partyId, kind, name]);
  useEffect(() => { make(false); }, [make]);

  const url = link ? publicLinks(null).portal(link.token) : "";
  async function copy() {
    try { await navigator.clipboard.writeText(url); show("Link copiado"); } catch { show("No pudimos copiarlo: seleccionalo y copialo a mano", true); }
  }
  async function revoke() {
    if (!link) return;
    try { await appApi(`/portal-links/${link.id}`, { method: "DELETE" }); show("Link revocado"); setLink(null); setWa(null); } catch (e) { fail(e); }
  }
  return (
    <Modal title={`Portal de ${name}`} eyebrow={kind === "INQUILINO" ? "INQUILINO" : "PROPIETARIO"} onClose={onClose} footer={<button className="secondary-button" onClick={onClose}>Cerrar</button>}>
      {node}
      {error && <div className="hb-note hb-note-error" role="alert">{error}</div>}
      {!link && !error && <Loading />}
      {link && (
        <div className="hb-stack">
          <p className="hb-muted">Con este link la persona ve solo lo suyo, sin usuario ni contraseña. Vence el {shortDate(link.expires_at)}. Mandáselo solo a ella.</p>
          <code className="g2-link-url">{url}</code>
          <div className="g2-actions" style={{ justifyContent: "flex-start" }}>
            <button className="primary-button" onClick={copy}>Copiar link</button>
            {wa ? <a className="secondary-button" href={wa} target="_blank" rel="noopener noreferrer">Abrir WhatsApp</a> : <span className="hb-hint">Sin celular cargado: no se puede armar el WhatsApp.</span>}
            <button className="secondary-button" onClick={() => make(true)}>Generar uno nuevo</button>
            <button className="hb-danger-button" onClick={revoke}>Revocar</button>
          </div>
        </div>
      )}
      {!link && error !== "" && <div className="g2-actions" style={{ justifyContent: "flex-start", marginTop: 10 }}><button className="secondary-button" onClick={() => make(false)}>Reintentar</button></div>}
    </Modal>
  );
}

/** Lista de todos los links emitidos */
export function PortalLinksList() {
  const { show, fail, node } = useFlash();
  const [rows, setRows] = useState<Link[] | null>(null);
  const load = useCallback(() => { appApi<Link[]>("/portal-links").then(setRows).catch(fail); }, [fail]);
  useEffect(load, [load]);
  async function revoke(id: number) { try { await appApi(`/portal-links/${id}`, { method: "DELETE" }); show("Link revocado"); load(); } catch (e) { fail(e); } }
  if (!rows) return <Loading />;
  return (
    <div className="hb-stack">
      {node}
      <div className="hb-note hb-note-info">Los links se generan desde la cuenta de cada contrato (inquilinos) o desde la liquidación (propietarios). Acá ves los que ya emitiste.</div>
      {rows.length === 0 ? <Empty title="Todavía no emitiste ningún link" /> : (
        <div className="hb-table-wrap"><table className="hb-table">
          <thead><tr><th>Persona</th><th>Tipo</th><th>Vence</th><th>Último uso</th><th>Estado</th><th /></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.id}><td>{r.party_name}</td><td>{r.kind === "INQUILINO" ? "Inquilino" : "Propietario"}</td><td>{shortDate(r.expires_at)}</td><td>{r.last_used_at ? shortDate(r.last_used_at) : "Nunca"}</td>
              <td><Pill tone={r.state === "ACTIVO" ? "green" : "gray"}>{r.state === "ACTIVO" ? "Activo" : r.state === "VENCIDO" ? "Vencido" : "Revocado"}</Pill></td>
              <td className="g2-num">{r.state === "ACTIVO" && <button className="g2-mini is-danger" onClick={() => revoke(r.id)}>Revocar</button>}</td></tr>
          ))}</tbody></table></div>
      )}
    </div>
  );
}
