// Importador de planillas (CSV o Excel): propiedades, personas y contratos. Primero una vista previa; recién después se importa.
import { useRef, useState } from "react";
import { appBlob, appUpload, saveBlob } from "../../config";
import { Pill, Seg } from "../ui";
import { Note } from "../g1/common";

type Kind = "personas" | "propiedades" | "contratos";
interface Preview { kind: string; total: number; ok: number; errors: number; duplicates: number; rows: { row: number; status: string; errors: string[]; warnings: string[]; summary: string }[]; unknown_columns: string[] }
interface Result { created: number; skipped: number; failed: { row: number; errors: string[] }[] }
const HELP: Record<Kind, string> = {
  personas: "Una fila por persona. Si la persona ya está cargada (mismo documento) se saltea.",
  propiedades: "Una fila por propiedad. Con «propietario_documento» queda asociada a un propietario ya cargado.",
  contratos: "Cargá antes las propiedades y los inquilinos: el contrato los busca por dirección o código y por documento. Los contratos entran como vigentes, con el canon actual y la fecha del próximo ajuste.",
};

export function Importar({ onDone, flash }: { onDone: () => void; flash: { show: (t: string, e?: boolean) => void; fail: (e: unknown) => void } }) {
  const [kind, setKind] = useState<Kind>("personas");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  function form() { const f = new FormData(); f.append("kind", kind); if (file) f.append("file", file, file.name); return f; }
  async function template() {
    try { saveBlob(await appBlob(`/import/template?kind=${kind}`), `plantilla-${kind}.csv`); } catch (e) { flash.fail(e); }
  }
  async function doPreview() {
    if (!file) return;
    setBusy(true); setResult(null);
    try { setPreview(await appUpload<Preview>("/import/preview", form())); } catch (e) { setPreview(null); flash.fail(e); } finally { setBusy(false); }
  }
  async function commit() {
    setBusy(true);
    try {
      const r = await appUpload<Result>("/import/commit", form());
      setResult(r); setPreview(null); setFile(null);
      if (input.current) input.current.value = "";
      flash.show(`Se importaron ${r.created} filas`);
      onDone();
    } catch (e) { flash.fail(e); } finally { setBusy(false); }
  }
  function pick(k: Kind) { setKind(k); setPreview(null); setResult(null); }

  return (
    <div className="hb-card">
      <div className="hb-card-head"><div><h2>Importar desde una planilla</h2><p>Traé tus datos de Excel o CSV sin cargarlos uno por uno.</p></div></div>
      <Seg<Kind> value={kind} onChange={pick} options={[["personas", "Personas"], ["propiedades", "Propiedades"], ["contratos", "Contratos"]]} />
      <p className="hb-muted">{HELP[kind]}</p>
      <div className="g1-actions" style={{ marginBottom: 12 }}><button className="g1-mini" onClick={template}>Descargar la plantilla</button></div>
      <div className="g1-import-drop">
        <input ref={input} type="file" accept=".csv,.xlsx,text/csv" aria-label="Archivo de la planilla" onChange={(e) => { setFile(e.target.files?.[0] || null); setPreview(null); setResult(null); }} />
        <p className="hb-hint" style={{ margin: "8px 0 0" }}>Hasta 5 MB. Excel (.xlsx) o CSV separado por punto y coma.</p>
      </div>
      <div className="g1-actions" style={{ marginTop: 12 }}>
        <button className="primary-button" disabled={!file || busy} onClick={doPreview}>{busy && !preview ? "Leyendo..." : "Ver qué se importaría"}</button>
      </div>

      {preview && (
        <div style={{ marginTop: 16 }}>
          <div className="hb-kpis">
            <div className="hb-kpi"><span>Filas</span><strong>{preview.total}</strong></div>
            <div className="hb-kpi"><span>Se importan</span><strong>{preview.ok}</strong></div>
            <div className={`hb-kpi ${preview.duplicates ? "is-warn" : ""}`}><span>Ya existían</span><strong>{preview.duplicates}</strong></div>
            <div className={`hb-kpi ${preview.errors ? "is-alert" : ""}`}><span>Con errores</span><strong>{preview.errors}</strong></div>
          </div>
          {preview.unknown_columns.length > 0 && <Note tone="warn">Estas columnas no las entendemos y se ignoran: {preview.unknown_columns.join(", ")}</Note>}
          <div className="hb-table-wrap" style={{ marginTop: 10 }}>
            <table className="hb-table"><thead><tr><th>Fila</th><th>Dato</th><th>Resultado</th></tr></thead>
              <tbody>{preview.rows.filter((r) => r.status !== "OK" || r.warnings.length).slice(0, 80).map((r) => (
                <tr key={r.row}><td>{r.row}</td><td>{r.summary || "—"}</td>
                  <td><Pill tone={r.status === "ERROR" ? "red" : r.status === "DUPLICADA" ? "orange" : "green"}>{r.status === "ERROR" ? "Error" : r.status === "DUPLICADA" ? "Ya existe" : "Revisar"}</Pill>
                    {[...r.errors, ...r.warnings].map((m, i) => <small key={i}>{m}</small>)}</td></tr>))}
                {preview.rows.every((r) => r.status === "OK" && !r.warnings.length) && <tr><td colSpan={3}>Todas las filas están bien.</td></tr>}</tbody></table>
          </div>
          <div className="g1-actions" style={{ marginTop: 12 }}>
            <button className="primary-button" disabled={busy || preview.ok === 0} onClick={commit}>{busy ? "Importando..." : `Importar ${preview.ok} fila${preview.ok === 1 ? "" : "s"}`}</button>
            <span className="hb-hint">Las filas con error y las repetidas no se importan.</span>
          </div>
        </div>)}

      {result && (
        <div style={{ marginTop: 16 }}>
          <Note>Se importaron {result.created} filas, {result.skipped} ya existían{result.failed.length ? ` y ${result.failed.length} fallaron` : ""}.</Note>
          {result.failed.length > 0 && <ul>{result.failed.map((f) => <li key={f.row} style={{ color: "var(--hb-ink)" }}>Fila {f.row}: {f.errors.join("; ")}</li>)}</ul>}
        </div>)}
    </div>
  );
}
