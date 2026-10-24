import { useCallback, useEffect, useState } from "react";
import { adminApi, shortDate } from "../../config";
import { Empty, Field, Loading, PageHeader, Pill, useFlash } from "../../components/ui";

interface IndexRow { id: number; code: string; kind: string; date: string; value: number; source_text: string | null; loaded_by: string | null; loaded_at: string | null }
interface IndexData { codes: string[]; kinds: Record<string, string>; last: Record<string, IndexRow>; items: IndexRow[] }

const KIND_LABEL: Record<string, string> = { VARIACION_MENSUAL: "Variación mensual (%)", NIVEL: "Valor diario (nivel)" };

/** Tabla global de índices de ajuste (IPC, ICL, CVS, UVA...). La cargás vos una vez y la ven todas las inmobiliarias. */
function Indices() {
  const { show, fail, node: flash } = useFlash();
  const [data, setData] = useState<IndexData | null>(null);
  const [code, setCode] = useState("");
  const [date, setDate] = useState("");
  const [value, setValue] = useState("");
  const [source, setSource] = useState("");
  const [filter, setFilter] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    adminApi<IndexData>(filter ? `/admin/indices?code=${filter}` : "/admin/indices").then((d) => { setData(d); setCode((c) => c || d.codes[0] || ""); }).catch(fail);
  }, [filter, fail]);
  useEffect(() => { load(); }, [load]);

  async function save() {
    setSaving(true);
    try {
      await adminApi("/admin/indices", { method: "POST", body: { code, date, value: Number(value.replace(",", ".")), source_text: source.trim() || null } });
      setValue(""); setSource(""); show("Valor guardado"); load();
    } catch (e) { fail(e); } finally { setSaving(false); }
  }
  async function remove(id: number) {
    if (!window.confirm("¿Borrar este valor?")) return;
    try { await adminApi(`/admin/indices/${id}`, { method: "DELETE" }); show("Valor borrado"); load(); } catch (e) { fail(e); }
  }

  if (!data) return <Loading />;
  const kind = data.kinds[code];
  const ready = !!code && !!date && value.trim() !== "" && !Number.isNaN(Number(value.replace(",", ".")));
  return (
    <section className="products-page">
      <PageHeader eyebrow="MEZZTT · HABITA" title="Índices de ajuste" subtitle="Valores que usan todas las inmobiliarias para proponer los ajustes de alquiler. Cargalos con su fuente: Habita no garantiza que coincidan con la publicación oficial." />
      <div className="hb-kpis">
        {data.codes.map((c) => {
          const l = data.last[c];
          return <div key={c} className="hb-kpi"><span>{c}</span><strong>{l ? l.value : "—"}</strong><small>{l ? `al ${shortDate(l.date)}` : "Sin cargar"}</small></div>;
        })}
      </div>
      <div className="hb-card">
        <div className="hb-card-head"><div><h2>Cargar un valor</h2><p>{kind ? KIND_LABEL[kind] : ""}. Si ya hay uno para esa fecha, se corrige.</p></div></div>
        <div className="product-form">
          <Field label="Índice"><select value={code} onChange={(e) => setCode(e.target.value)}>{data.codes.map((c) => <option key={c} value={c}>{c}</option>)}</select></Field>
          <Field label="Fecha" hint={kind === "VARIACION_MENSUAL" ? "Se guarda al primer día del mes" : undefined}><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Valor"><input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} /></Field>
          <Field label="Fuente (opcional)"><input value={source} maxLength={200} placeholder="Ej: INDEC, comunicado del 14/10" onChange={(e) => setSource(e.target.value)} /></Field>
          <div><button className="primary-button" disabled={!ready || saving} onClick={save}>{saving ? "Guardando..." : "Guardar valor"}</button></div>
        </div>
      </div>
      <div className="hb-card">
        <div className="hb-card-head"><div><h2>Valores cargados</h2></div>
          <select aria-label="Filtrar por índice" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="">Todos</option>{data.codes.map((c) => <option key={c} value={c}>{c}</option>)}</select>
        </div>
        {data.items.length === 0 ? <Empty title="Todavía no cargaste valores">Empezá por el último IPC o ICL publicado.</Empty> : (
          <div className="hb-table-wrap"><table className="hb-table">
            <thead><tr><th>Índice</th><th>Fecha</th><th>Valor</th><th>Fuente</th><th>Cargó</th><th></th></tr></thead>
            <tbody>{data.items.map((r) => (
              <tr key={r.id}><td><Pill tone="brand">{r.code}</Pill></td><td>{shortDate(r.date)}</td><td>{r.value}</td><td>{r.source_text || "—"}</td>
                <td>{r.loaded_by || "—"}{r.loaded_at ? <small>{shortDate(r.loaded_at)}</small> : null}</td>
                <td><button type="button" className="hb-link hb-link-danger" onClick={() => remove(r.id)}>Borrar</button></td></tr>
            ))}</tbody>
          </table></div>
        )}
      </div>
      {flash}
    </section>
  );
}

export default Indices;
