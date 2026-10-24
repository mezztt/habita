// Pantalla «Expensas y servicios» (módulo expensas, grupo G2): importes del mes por contrato, carga masiva y comprobantes.
// Backend: backend/routes/expensas.py · pendientes: backend/routes/expensas.py -> pending_items
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { appApi, appUpload, currentPeriod, getSessionUser, isReadOnly, moneyIn, periodLabel, shiftPeriod } from "../../../config";
import { Empty, Loading, PageHeader, Pill, useFlash, useRefreshKey } from "../../../components/ui";
import "../../../g2.css";

interface ChargeInfo { id: number; amount: number; status: string; paid_amount: number; due_date: string; has_proof: boolean; editable: boolean }
interface Row {
  key: string; contract_id: number; number: number; address: string; tenant: string; concept: string; concept_label: string; payer: string;
  collected_by: string; mode: string; currency: string; planned: number | null; state: string; wa: { url: string | null; text: string } | null; charge: ChargeInfo | null;
}
interface Data { period: string; rows: Row[]; counts: Record<string, number> }

const STATE: Record<string, [string, string]> = {
  SIN_GENERAR: ["Sin generar", "gray"], SIN_CARGAR: ["Falta importe", "orange"], CARGADO: ["Cargado", "blue"], PAGADO: ["Pagado", "green"],
  DIRECTO: ["Lo paga directo", "gray"], PAGADO_DIRECTO: ["Pagado directo", "green"], ANULADO: ["Anulado", "gray"],
};
const parse = (v: string) => { const s = v.trim().replace(/\s/g, ""); if (!s) return NaN; const t = s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s; return Number(t); };
const fmtIn = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n).replace(".", ","));

function ExpensasPage() {
  const user = getSessionUser();
  const readOnly = isReadOnly(user);
  const { show, fail, node } = useFlash();
  const refreshKey = useRefreshKey();
  const [period, setPeriod] = useState(currentPeriod());
  const [data, setData] = useState<Data | null>(null);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [concept, setConcept] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [attachFor, setAttachFor] = useState<number | null>(null);

  const load = useCallback(() => { setEdits({}); appApi<Data>(`/expenses?period=${period}`).then(setData).catch(fail); }, [period, fail]);
  useEffect(load, [load, refreshKey]);

  const concepts = useMemo(() => Array.from(new Set((data?.rows || []).map((r) => r.concept_label))).sort(), [data]);
  const rows = (data?.rows || []).filter((r) => !concept || r.concept_label === concept);
  const dirty = Object.keys(edits).length;

  function valueOf(r: Row): string {
    if (r.key in edits) return edits[r.key];
    if (r.charge) return r.charge.amount ? fmtIn(r.charge.amount) : "";
    return fmtIn(r.planned);
  }
  function canEdit(r: Row) { return !readOnly && r.collected_by !== "DIRECTO" && (!r.charge || r.charge.editable); }

  async function generate() {
    setBusy(true);
    try { const r = await appApi<{ created: number }>(`/expenses/generate?period=${period}`, { method: "POST" }); show(r.created ? `Se generaron ${r.created} cargos` : "Ya estaba todo generado"); load(); }
    catch (e) { fail(e); } finally { setBusy(false); }
  }
  async function save() {
    const items: { contract_id: number; concept: string; amount: number }[] = [];
    for (const r of data?.rows || []) {
      if (!(r.key in edits)) continue;
      const n = parse(edits[r.key]);
      if (!Number.isFinite(n) || n < 0) { fail(new Error(`Contrato N.º ${r.number}, ${r.concept_label.toLowerCase()}: el importe no es válido`)); return; }
      items.push({ contract_id: r.contract_id, concept: r.concept, amount: n });
    }
    if (!items.length) return;
    setBusy(true);
    try { await appApi("/expenses/bulk", { method: "POST", body: { period, items } }); show(`Se guardaron ${items.length} importe(s)`); load(); }
    catch (e) { fail(e); } finally { setBusy(false); }
  }
  async function onFile(files: FileList | null) {
    const f = files?.[0];
    const chargeId = attachFor;
    if (fileRef.current) fileRef.current.value = "";
    setAttachFor(null);
    if (!f || chargeId === null) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append("file", f, f.name);
      const up = await appUpload<{ file_url: string }>("/files", form);
      await appApi(`/expenses/${chargeId}/attach`, { method: "POST", body: { file_url: up.file_url } });
      show("Comprobante adjuntado"); load();
    } catch (e) { fail(e); } finally { setBusy(false); }
  }

  return (
    <section className="products-page">
      <PageHeader eyebrow="EXPENSAS" title="Expensas y servicios" subtitle="Cargá los importes del mes de cada contrato y adjuntá el comprobante.">
        {!readOnly && <button className="secondary-button" disabled={busy} onClick={generate}>Generar cargos del mes</button>}
        {!readOnly && <button className="primary-button" disabled={busy || dirty === 0} onClick={save} data-tour="expensas-guardar">Guardar {dirty ? `(${dirty})` : "importes"}</button>}
      </PageHeader>
      {node}
      <div className="g2-filters">
        <div className="g2-period"><button aria-label="Mes anterior" onClick={() => setPeriod(shiftPeriod(period, -1))}>‹</button><strong>{periodLabel(period)}</strong><button aria-label="Mes siguiente" onClick={() => setPeriod(shiftPeriod(period, 1))}>›</button></div>
        <select aria-label="Filtrar por concepto" value={concept} onChange={(e) => setConcept(e.target.value)}>
          <option value="">Todos los conceptos</option>
          {concepts.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        {data && Object.entries(data.counts).map(([k, n]) => <Pill key={k} tone={(STATE[k] || ["", "gray"])[1]}>{(STATE[k] || [k])[0]}: {n}</Pill>)}
      </div>
      <input ref={fileRef} type="file" accept="image/*,application/pdf" hidden onChange={(e) => onFile(e.target.files)} />
      {!data ? <Loading /> : rows.length === 0 ? (
        <Empty title="No hay conceptos para cargar este mes">Los conceptos (expensas, ABL, agua, luz, gas) salen del plan de cargos de cada contrato. Agregalos en la ficha del contrato.</Empty>
      ) : (
        <>
          <div className="hb-table-wrap">
            <table className="hb-table">
              <thead><tr><th>Contrato</th><th>Concepto</th><th>Paga</th><th className="num">Importe</th><th>Estado</th><th /></tr></thead>
              <tbody>
                {rows.map((r) => {
                  const [label, tone] = STATE[r.state] || [r.state, "gray"];
                  const editable = canEdit(r);
                  return (
                    <tr key={r.key}>
                      <td><strong>N.º {r.number}</strong><small>{r.address}{r.tenant ? ` · ${r.tenant}` : ""}</small></td>
                      <td>{r.concept_label}<small>{r.mode === "FIJO" ? "Importe fijo" : "Variable"}</small></td>
                      <td>{r.payer === "INQUILINO" ? "Inquilino" : "Propietario"}<small>{r.collected_by === "DIRECTO" ? "Lo paga directo" : "Lo cobramos nosotros"}</small></td>
                      <td className="num">
                        {r.collected_by === "DIRECTO" ? <span className="hb-muted">—</span> : editable ? (
                          <input className="g2-input-num" aria-label={`Importe de ${r.concept_label} del contrato ${r.number}`} inputMode="decimal" value={valueOf(r)} placeholder="0" onChange={(e) => setEdits({ ...edits, [r.key]: e.target.value })} />
                        ) : <span>{moneyIn(r.charge?.amount || 0, r.currency)}</span>}
                      </td>
                      <td><Pill tone={tone}>{label}</Pill>{r.charge && r.charge.paid_amount > 0 && <small>Pagó {moneyIn(r.charge.paid_amount, r.currency)}</small>}</td>
                      <td className="num"><div className="g2-actions">
                        {r.charge && !readOnly && <button className="g2-mini" disabled={busy} onClick={() => { setAttachFor(r.charge!.id); fileRef.current?.click(); }}>{r.charge.has_proof ? "Cambiar comprobante" : "Adjuntar comprobante"}</button>}
                        {r.charge?.has_proof && <span className="g2-ok">Con comprobante</span>}
                        {r.wa?.url && <a className="g2-mini" href={r.wa.url} target="_blank" rel="noopener noreferrer" aria-label={`Avisar a ${r.tenant} por WhatsApp`}>WhatsApp</a>}
                      </div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="hb-hint">Si alguna fila tiene un error, no se guarda ninguna: corregila y probá de nuevo. Los cargos con pagos no se modifican.</p>
        </>
      )}
    </section>
  );
}

export default ExpensasPage;
