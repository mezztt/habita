// Pantalla «Inspecciones» (módulo inspecciones): inventario de entrada y salida con fotos, firma y comparación.
// Backend: backend/routes/inspecciones.py
import { useCallback, useEffect, useMemo, useState } from "react";
import { API_URL, appApi, getSessionUser, isReadOnly, shortDate, dateTime } from "../../../config";
import { Empty, Field, Loading, Modal, PageHeader, Pill, useFlash, numOrNull, strOrNull } from "../../../components/ui";
import { PhotoGrid, PhotoUploader, CONDITION, KIND_LABEL } from "../../../components/g3/common";
import type { PropertyOpt, ContractOpt, AgentOpt } from "../../../components/g3/common";
import { printHtml, esc, NOT_INVOICE } from "../../print/printDoc";
import "../../../g3.css";

interface Row { id: number; property: string; property_code: string; contract_id: number | null; tenant: string | null; kind: string; done_on: string; status: string; inspector: string | null; item_count: number; photo_count: number }
interface Item { id: number; room: string; element: string; condition: string; notes: string | null }
interface Photo { id: number; inspection_item_id: number | null; url: string | null; caption: string | null; taken_at: string | null }
interface Detail extends Row {
  property_id: number; meter_readings: Record<string, string>; keys_delivered_count: number | null; notes: string | null; tenant_signed_name: string | null; tenant_signed_at: string | null;
  owner_signed_name: string | null; owner_signed_at: string | null; contract_number: number | null; items: Item[]; photos: Photo[]; preloaded_from_entry?: boolean;
}
interface Lookups { properties: PropertyOpt[]; contracts: ContractOpt[]; inspectors: AgentOpt[] }
interface CmpRow { room: string; element: string; before: string | null; after: string | null; change: string; before_notes: string | null; after_notes: string | null }
interface Cmp { base: { id: number; done_on: string }; current: { id: number; done_on: string }; rows: CmpRow[]; summary: Record<string, number> }

const CHANGE: Record<string, [string, string]> = { EMPEORO: ["Empeoró", "red"], MEJORO: ["Mejoró", "green"], IGUAL: ["Igual", "gray"], SOLO_SALIDA: ["Nuevo en la salida", "blue"], SOLO_ENTRADA: ["No está en la salida", "orange"] };

function InspeccionesPage() {
  const user = getSessionUser();
  const ro = isReadOnly(user);
  const { show, fail, node: flash } = useFlash();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [look, setLook] = useState<Lookups | null>(null);
  const [kind, setKind] = useState(""); const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);

  const load = useCallback(() => { appApi<Row[]>("/inspections").then(setRows).catch(fail); }, [fail]);
  useEffect(() => { load(); appApi<Lookups>("/inspections/lookups").then(setLook).catch(fail); }, [load, fail]);
  const shown = useMemo(() => (rows || []).filter((r) => (!kind || r.kind === kind) && (!q.trim() || `${r.property} ${r.property_code} ${r.tenant || ""}`.toLowerCase().includes(q.trim().toLowerCase()))), [rows, kind, q]);

  return (
    <section className="products-page">
      <PageHeader eyebrow="INSPECCIONES" title="Inspecciones" subtitle="Inventario de entrada y salida con fotos. Lo que se firma no se modifica.">
        {!ro && <button className="primary-button" onClick={() => setCreating(true)}>+ Nueva inspección</button>}
      </PageHeader>
      <div className="hb-toolbar"><div className="hb-filters">
        <input className="hb-search" placeholder="Buscar propiedad o inquilino" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar" />
        <select value={kind} onChange={(e) => setKind(e.target.value)} aria-label="Tipo"><option value="">Todos los tipos</option>{Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      </div></div>
      {!rows ? <Loading /> : shown.length === 0 ? <Empty title="No hay inspecciones">{rows.length ? "Probá con otro filtro." : "Hacé la de entrada al entregar la llave: después sirve para comparar la salida y devolver el depósito."}</Empty> : (
        <div className="hb-table-wrap"><table className="hb-table">
          <thead><tr><th>Fecha</th><th>Propiedad</th><th>Tipo</th><th>Inquilino</th><th>Inspector</th><th>Fotos</th><th>Estado</th></tr></thead>
          <tbody>{shown.map((r) => (
            <tr key={r.id} className="is-click" onClick={() => setOpenId(r.id)}>
              <td>{shortDate(r.done_on)}</td><td><strong>{r.property_code}</strong><small>{r.property}</small></td><td>{KIND_LABEL[r.kind]}</td>
              <td>{r.tenant || "—"}</td><td>{r.inspector || "—"}</td><td className="num">{r.photo_count}</td>
              <td>{r.status === "FIRMADA" ? <Pill tone="green">Firmada</Pill> : <Pill tone="orange">Borrador</Pill>}</td></tr>))}</tbody></table></div>
      )}
      {creating && look && <NewInspection look={look} onClose={() => setCreating(false)} onCreated={(d) => { setCreating(false); load(); setOpenId(d.id); show(d.preloaded_from_entry ? "Se precargó con los elementos de la entrada: revisá cada uno" : "Inspección creada"); }} />}
      {openId !== null && <Editor id={openId} ro={ro} onClose={() => { setOpenId(null); load(); }} onFlash={show} onFail={fail} />}
      {flash}
    </section>
  );
}

function NewInspection({ look, onClose, onCreated }: { look: Lookups; onClose: () => void; onCreated: (d: Detail) => void }) {
  const [f, setF] = useState({ property_id: "", contract_id: "", kind: "ENTRADA", done_on: new Date().toISOString().slice(0, 10), blank: false });
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const contracts = look.contracts.filter((c) => String(c.property_id) === f.property_id);
  async function save() {
    setBusy(true); setError("");
    try { onCreated(await appApi<Detail>("/inspections/from-template", { method: "POST", body: { property_id: numOrNull(f.property_id), contract_id: numOrNull(f.contract_id), kind: f.kind, done_on: f.done_on, blank: f.blank } })); }
    catch (e) { setError(e instanceof Error ? e.message : "No se pudo crear"); } finally { setBusy(false); }
  }
  return (
    <Modal eyebrow="NUEVA INSPECCIÓN" title="Nueva inspección" onClose={onClose} footer={<><button className="secondary-button" onClick={onClose}>Cancelar</button><button className="primary-button" disabled={busy || !f.property_id} onClick={save}>{busy ? "Creando..." : "Crear"}</button></>}>
      <div className="product-form">
        <Field label="Propiedad"><select value={f.property_id} onChange={(e) => setF({ ...f, property_id: e.target.value, contract_id: "" })} autoFocus><option value="">Elegí una propiedad</option>{look.properties.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.address}</option>)}</select></Field>
        {contracts.length > 0 && <Field label="Contrato" hint="Necesario para comparar la salida con la entrada"><select value={f.contract_id} onChange={(e) => setF({ ...f, contract_id: e.target.value })}><option value="">Sin contrato</option>{contracts.map((c) => <option key={c.id} value={c.id}>N.º {c.number} · {c.tenant || "sin inquilino"}</option>)}</select></Field>}
        <Field label="Tipo"><select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })}>{Object.entries(KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Fecha"><input type="date" value={f.done_on} onChange={(e) => setF({ ...f, done_on: e.target.value })} /></Field>
        <div className="hb-inline-checks"><label><input type="checkbox" checked={f.blank} onChange={(e) => setF({ ...f, blank: e.target.checked })} /> Empezar vacía (sin ambientes estándar)</label></div>
        {f.kind === "SALIDA" && <div className="hb-note hb-note-info">Si hay una inspección de entrada del mismo contrato, se precargan sus elementos y después marcás cómo está cada uno.</div>}
        {error && <div className="hb-note hb-note-error" role="alert">{error}</div>}
      </div>
    </Modal>
  );
}

function Editor({ id, ro, onClose, onFlash, onFail }: { id: number; ro: boolean; onClose: () => void; onFlash: (t: string) => void; onFail: (e: unknown) => void }) {
  const [d, setD] = useState<Detail | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [dirty, setDirty] = useState(false);
  const [meters, setMeters] = useState({ luz: "", gas: "", agua: "" });
  const [keys, setKeys] = useState(""); const [notes, setNotes] = useState("");
  const [signing, setSigning] = useState(false); const [cmp, setCmp] = useState<Cmp | null>(null);
  const [newRoom, setNewRoom] = useState("");

  const apply = useCallback((x: Detail) => {
    setD(x); setItems(x.items); setDirty(false);
    setMeters({ luz: x.meter_readings.luz || "", gas: x.meter_readings.gas || "", agua: x.meter_readings.agua || "" });
    setKeys(x.keys_delivered_count !== null ? String(x.keys_delivered_count) : ""); setNotes(x.notes || "");
  }, []);
  useEffect(() => { appApi<Detail>(`/inspections/${id}`).then(apply).catch(onFail); }, [id, apply, onFail]);

  const rooms = useMemo(() => { const m = new Map<string, Item[]>(); items.forEach((i) => { if (!m.has(i.room)) m.set(i.room, []); m.get(i.room)!.push(i); }); return [...m.entries()]; }, [items]);
  if (!d) return <Modal title="Inspección" onClose={onClose} size="xl"><Loading /></Modal>;
  const locked = d.status === "FIRMADA" || ro;

  const patchItem = (iid: number, change: Partial<Item>) => { setItems((xs) => xs.map((x) => (x.id === iid ? { ...x, ...change } : x))); setDirty(true); };
  async function saveAll(): Promise<Detail | null> {
    try {
      await appApi(`/inspections/${id}`, { method: "PUT", body: { meter_readings: { luz: meters.luz, gas: meters.gas, agua: meters.agua }, keys_delivered_count: numOrNull(keys), notes: strOrNull(notes) } });
      const x = await appApi<Detail>(`/inspections/${id}/items`, { method: "PUT", body: { items: items.map((i) => ({ id: i.id > 0 ? i.id : null, room: i.room, element: i.element, condition: i.condition, notes: i.notes })) } });
      apply(x); return x;
    } catch (e) { onFail(e); return null; }
  }
  async function save() { if (await saveAll()) onFlash("Guardado"); }
  async function addPhoto(file_url: string, itemId: number | null) {
    if (itemId !== null && itemId < 0) { const x = await saveAll(); if (!x) return; }
    await appApi(`/inspections/${id}/photos`, { method: "POST", body: { file_url, inspection_item_id: itemId !== null && itemId > 0 ? itemId : null } });
    const keep = items; const x = await appApi<Detail>(`/inspections/${id}`); setD(x); setItems(keep);
  }
  async function removePhoto(p: { id: number }) { try { await appApi(`/inspections/${id}/photos/${p.id}`, { method: "DELETE" }); const x = await appApi<Detail>(`/inspections/${id}`); setD(x); } catch (e) { onFail(e); } }
  async function showCompare() { try { setCmp(await appApi<Cmp>(`/inspections/${id}/compare`)); } catch (e) { onFail(e); } }
  async function print() {
    if (dirty && !(await saveAll())) return;
    try { printReport(await appApi(`/inspections/${id}/pdf`)); } catch (e) { onFail(e); }
  }
  function addItem(room: string) { const n = -(Date.now() % 1e9) - items.length; setItems((xs) => [...xs, { id: n, room, element: "", condition: "BUENO", notes: null }]); setDirty(true); }
  async function removeDraft() {
    if (!window.confirm("¿Borrar este borrador con sus fotos? No se puede deshacer.")) return;
    try { await appApi(`/inspections/${id}`, { method: "DELETE" }); onClose(); } catch (e) { onFail(e); }
  }

  const photosOf = (iid: number) => d.photos.filter((p) => p.inspection_item_id === iid);
  const general = d.photos.filter((p) => !p.inspection_item_id);

  return (
    <Modal eyebrow={`${KIND_LABEL[d.kind].toUpperCase()} · ${shortDate(d.done_on)}`} title={`${d.property_code} · ${d.property}`} onClose={onClose} size="xl">
      <div className="hb-row">{d.status === "FIRMADA" ? <Pill tone="green">Firmada</Pill> : <Pill tone="orange">Borrador</Pill>}
        {d.tenant && <span className="hb-muted">Inquilino: {d.tenant}</span>}{d.contract_number && <span className="hb-muted">Contrato N.º {d.contract_number}</span>}</div>
      {d.status === "FIRMADA" && <div className="hb-note hb-note-info" style={{ marginTop: 10 }}>Firmada: no se puede modificar. Si algo cambió, hacé una inspección nueva.</div>}

      <div className="g3-section">Medidores y llaves</div>
      <div className="g3-grid">
        {(["luz", "gas", "agua"] as const).map((k) => <Field key={k} label={`Medidor de ${k}`}><input value={meters[k]} disabled={locked} onChange={(e) => { setMeters({ ...meters, [k]: e.target.value }); setDirty(true); }} /></Field>)}
        <Field label="Llaves entregadas"><input inputMode="numeric" value={keys} disabled={locked} onChange={(e) => { setKeys(e.target.value); setDirty(true); }} /></Field>
      </div>

      <div className="g3-section">Ambientes</div>
      {rooms.length === 0 && <Empty title="Sin elementos">Agregá un ambiente para empezar.</Empty>}
      {rooms.map(([room, list]) => (
        <div className="g3-room" key={room}>
          <h3>{room}</h3>
          {list.map((it) => (
            <div className="g3-item" key={it.id}>
              {locked || it.id > 0 ? <div className="g3-item-name">{it.element || "(sin nombre)"}</div> :
                <input type="text" placeholder="Elemento (ej.: Ventana)" value={it.element} onChange={(e) => patchItem(it.id, { element: e.target.value })} aria-label="Elemento" />}
              <div className="g3-cond" role="group" aria-label={`Estado de ${it.element}`}>
                {Object.entries(CONDITION).map(([k, v]) => <button key={k} type="button" disabled={locked} className={it.condition === k ? `on-${k}` : ""} aria-pressed={it.condition === k} onClick={() => patchItem(it.id, { condition: k })}>{v[0]}</button>)}
              </div>
              <input type="text" placeholder="Observaciones" value={it.notes || ""} disabled={locked} onChange={(e) => patchItem(it.id, { notes: e.target.value })} aria-label="Observaciones" />
              {it.id > 0 && <PhotoGrid photos={photosOf(it.id)} onRemove={locked ? undefined : removePhoto} />}
              {!locked && it.id > 0 && <PhotoUploader compact label="+ Foto" onFile={(u) => addPhoto(u, it.id)} />}
            </div>
          ))}
          {!locked && <button className="hb-link" onClick={() => addItem(room)}>+ Agregar elemento a {room}</button>}
        </div>
      ))}
      {!locked && <div className="hb-row"><input className="hb-search" placeholder="Nuevo ambiente (ej.: Terraza)" value={newRoom} onChange={(e) => setNewRoom(e.target.value)} aria-label="Nuevo ambiente" />
        <button className="secondary-button" disabled={!newRoom.trim()} onClick={() => { addItem(newRoom.trim()); setNewRoom(""); }}>Agregar ambiente</button></div>}

      <div className="g3-section">Fotos generales</div>
      <PhotoGrid photos={general} onRemove={locked ? undefined : removePhoto} />
      {!locked && <PhotoUploader onFile={(u) => addPhoto(u, null)} />}

      <div className="g3-section">Observaciones generales</div>
      <textarea rows={3} style={{ width: "100%" }} value={notes} disabled={locked} onChange={(e) => { setNotes(e.target.value); setDirty(true); }} aria-label="Observaciones generales" />

      {d.status === "FIRMADA" && <dl className="g3-kv" style={{ marginTop: 14 }}>
        {d.tenant_signed_name && <><dt>Conformidad inquilino</dt><dd>{d.tenant_signed_name} · {dateTime(d.tenant_signed_at)}</dd></>}
        {d.owner_signed_name && <><dt>Conformidad propietario</dt><dd>{d.owner_signed_name} · {dateTime(d.owner_signed_at)}</dd></>}</dl>}

      <div className="g3-actions">
        {!locked && <button className="primary-button" disabled={!dirty} onClick={save}>{dirty ? "Guardar cambios" : "Guardado"}</button>}
        {!locked && <button className="secondary-button" onClick={() => setSigning(true)}>Registrar conformidad y firmar</button>}
        {d.kind !== "ENTRADA" && <button className="secondary-button" onClick={showCompare}>Comparar con la entrada</button>}
        <button className="secondary-button" onClick={print}>Imprimir informe</button>
        {!locked && <button className="hb-link hb-link-danger" onClick={removeDraft}>Borrar borrador</button>}
      </div>
      {signing && <SignForm tenant={d.tenant || ""} onClose={() => setSigning(false)} onSigned={(x) => { setSigning(false); apply(x); onFlash("Inspección firmada"); }} id={id} dirtySave={dirty ? saveAll : undefined} onFail={onFail} />}
      {cmp && <Modal title="Entrada vs. esta inspección" eyebrow={`${shortDate(cmp.base.done_on)} → ${shortDate(cmp.current.done_on)}`} onClose={() => setCmp(null)} size="xl">
        <div className="hb-row">{Object.entries(cmp.summary).filter(([, n]) => n > 0).map(([k, n]) => <Pill key={k} tone={CHANGE[k][1]}>{CHANGE[k][0]}: {n}</Pill>)}</div>
        <div className="hb-table-wrap" style={{ marginTop: 12 }}><table className="hb-table"><thead><tr><th>Ambiente</th><th>Elemento</th><th>Entrada</th><th>Ahora</th><th>Cambio</th></tr></thead>
          <tbody>{cmp.rows.map((r, i) => (<tr key={i}><td>{r.room}</td><td>{r.element}{r.after_notes && <small>{r.after_notes}</small>}</td>
            <td>{r.before ? CONDITION[r.before]?.[0] : "—"}</td><td>{r.after ? CONDITION[r.after]?.[0] : "—"}</td><td><Pill tone={CHANGE[r.change][1]}>{CHANGE[r.change][0]}</Pill></td></tr>))}</tbody></table></div>
      </Modal>}
    </Modal>
  );
}

function SignForm({ id, tenant, onClose, onSigned, dirtySave, onFail }: { id: number; tenant: string; onClose: () => void; onSigned: (d: Detail) => void; dirtySave?: () => Promise<Detail | null>; onFail: (e: unknown) => void }) {
  const [t, setT] = useState(tenant); const [o, setO] = useState("");
  async function go() {
    try { if (dirtySave && !(await dirtySave())) return; onSigned(await appApi<Detail>(`/inspections/${id}/sign`, { method: "POST", body: { tenant_signed_name: strOrNull(t), owner_signed_name: strOrNull(o) } })); } catch (e) { onFail(e); }
  }
  return (
    <Modal eyebrow="CONFORMIDAD" title="Registrar conformidad" onClose={onClose} footer={<><button className="secondary-button" onClick={onClose}>Volver</button><button className="primary-button" disabled={!t.trim() && !o.trim()} onClick={go}>Firmar y bloquear</button></>}>
      <div className="product-form">
        <Field label="Nombre del inquilino que da su conformidad"><input value={t} onChange={(e) => setT(e.target.value)} autoFocus /></Field>
        <Field label="Nombre del propietario (opcional)"><input value={o} onChange={(e) => setO(e.target.value)} /></Field>
        <div className="hb-note hb-note-warn">Al firmar queda registrada la fecha y hora, y la inspección ya no se puede modificar. No es una firma electrónica: es el registro de la conformidad.</div>
      </div>
    </Modal>
  );
}

function printReport(r: any) {
  const cond = (c: string) => ({ BUENO: "Bueno", REGULAR: "Regular", MALO: "Malo", NO_APLICA: "No aplica" } as Record<string, string>)[c] || c;
  const rooms = new Map<string, any[]>();
  (r.items as any[]).forEach((i) => { if (!rooms.has(i.room)) rooms.set(i.room, []); rooms.get(i.room)!.push(i); });
  const photos = (list: any[]) => list.length ? `<div style="display:flex;flex-wrap:wrap;gap:4px;margin:4px 0">${list.map((p) => `<img src="${esc(API_URL + p.url)}" style="width:130px;height:95px;object-fit:cover;border:1px solid #000">`).join("")}</div>` : "";
  const a = r.agency || {};
  const body = `
    <h1>${esc(a.name || "Inspección")}</h1>
    <div class="c">${esc([a.address, a.phone].filter(Boolean).join(" · "))}${a.broker_license ? `<br>Matrícula ${esc(a.broker_license)} ${esc(a.broker_college || "")}` : ""}</div>
    <div class="sep"></div>
    <div class="big">Inspección de ${esc(({ ENTRADA: "entrada", SALIDA: "salida", PERIODICA: "visita periódica" } as any)[r.kind])} · ${esc(new Date(r.done_on + "T12:00:00").toLocaleDateString("es-AR"))}</div>
    <div>${esc(r.property_address || "")}${r.tenant ? ` · Inquilino: ${esc(r.tenant)}` : ""}${r.contract_number ? ` · Contrato N.º ${r.contract_number}` : ""}</div>
    <div>Medidores: luz ${esc(r.meter_readings?.luz || "—")} · gas ${esc(r.meter_readings?.gas || "—")} · agua ${esc(r.meter_readings?.agua || "—")} · Llaves: ${r.keys_delivered_count ?? "—"}</div>
    <div class="sep"></div>
    ${[...rooms.entries()].map(([room, list]) => `<div class="b" style="margin-top:8px">${esc(room)}</div>${list.map((i) => `
      <div style="border-top:1px solid #999;padding:3px 0"><div class="row"><span>${esc(i.element)}</span><span class="b">${esc(cond(i.condition))}</span></div>
      ${i.notes ? `<div>${esc(i.notes)}</div>` : ""}${photos((r.photos as any[]).filter((p) => p.inspection_item_id === i.id))}</div>`).join("")}`).join("")}
    ${(r.photos as any[]).some((p) => !p.inspection_item_id) ? `<div class="b" style="margin-top:8px">Fotos generales</div>${photos((r.photos as any[]).filter((p) => !p.inspection_item_id))}` : ""}
    ${r.notes ? `<div class="sep"></div><div class="b">Observaciones</div><div>${esc(r.notes)}</div>` : ""}
    ${r.compare ? `<div class="sep"></div><div class="b">Comparación con la entrada</div>${(r.compare.rows as any[]).filter((x) => x.change !== "IGUAL").map((x) => `<div class="row"><span>${esc(x.room)} · ${esc(x.element)}</span><span>${esc(x.before ? cond(x.before) : "—")} → ${esc(x.after ? cond(x.after) : "—")}</span></div>`).join("") || "<div>Sin cambios.</div>"}` : ""}
    <div class="sep"></div>
    <div class="row"><span>Inquilino: ${esc(r.tenant_signed_name || "______________")}</span><span>${r.tenant_signed_at ? esc(new Date(r.tenant_signed_at).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })) : ""}</span></div>
    <div class="row"><span>Propietario: ${esc(r.owner_signed_name || "______________")}</span><span>${r.owner_signed_at ? esc(new Date(r.owner_signed_at).toLocaleString("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })) : ""}</span></div>
    <div class="legal">${NOT_INVOICE}. Estado: ${r.status === "FIRMADA" ? "firmada" : "borrador"}.</div>`;
  printHtml("Inspección", body);
}

export default InspeccionesPage;
