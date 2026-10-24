// Impresiones del grupo G1: ficha resumen del contrato, datos de una persona y comprobante de devolución de depósito.
// Todas llevan «Documento no válido como factura». La ficha del contrato NO es el contrato legal.
import { dateTime, moneyIn, shortDate } from "../../config";
import { NOT_INVOICE, esc, printHtml } from "./printDoc";

interface Agency {
  name: string | null; legal_name: string | null; cuit_text: string | null; tax_condition_text: string | null; address: string | null;
  phone: string | null; email: string | null; broker_name: string | null; broker_license: string | null; broker_college: string | null;
}

function header(a: Agency): string {
  const lines = [a.legal_name && a.legal_name !== a.name ? a.legal_name : "", a.cuit_text ? `CUIT ${a.cuit_text}` : "", a.tax_condition_text || "",
    [a.address, a.phone, a.email].filter(Boolean).join(" · "),
    a.broker_name ? `Corredor inmobiliario: ${a.broker_name}` : "",
    a.broker_license ? `Matrícula ${a.broker_license}${a.broker_college ? " · " + a.broker_college : ""}` : ""].filter(Boolean);
  return `<h1>${esc(a.name || "Inmobiliaria")}</h1>${lines.map((l) => `<div class="c">${esc(l)}</div>`).join("")}`;
}
const row = (l: string, r: string, cls = "") => `<div class="row ${cls}"><span>${esc(l)}</span><span>${esc(r)}</span></div>`;
const legal = (extra = "") => `<div class="sep"></div><div class="warn c">${esc(NOT_INVOICE)}</div>${extra ? `<div class="legal">${esc(extra)}</div>` : ""}`;

const STATUS: Record<string, string> = { BORRADOR: "Borrador", VIGENTE: "Vigente", POR_VENCER: "Por vencer", VENCIDO: "Vencido", RESCINDIDO: "Rescindido", FINALIZADO: "Finalizado" };
const METHOD: Record<string, string> = { SIN_AJUSTE: "Sin ajuste", INDICE: "Por índice", PORCENTAJE: "Por porcentaje fijo", ESCALONADO: "Escalonado" };

export function printContract(d: any) {
  const people = (role: string, label: string) => (d.parties?.[role] || []).map((p: any) => row(label, `${p.full_name}${p.doc_number ? " · " + (p.doc_type || "Doc.") + " " + p.doc_number : ""}`)).join("");
  const owners = (d.owners || []).map((o: any) => row("Propietario", `${o.full_name} (${o.share_pct}%)`)).join("");
  const plan = (d.charge_plan || []).filter((x: any) => x.active).map((x: any) => row(x.concept.replace(/_/g, " ").toLowerCase(), `${x.payer === "INQUILINO" ? "inquilino" : "propietario"}${x.amount ? " · " + moneyIn(x.amount, d.currency) : ""}`)).join("");
  const adj = (d.adjustments || []).slice(0, 12).map((a: any) => `<tr><td>${shortDate(a.due_date)}</td><td>${esc(a.status)}</td><td class="r">${a.previous_rent !== null ? esc(moneyIn(a.previous_rent, d.currency)) : ""}</td><td class="r b">${a.new_rent !== null ? esc(moneyIn(a.new_rent, d.currency)) : ""}</td></tr>`).join("");
  const body = `${header(d.agency)}<div class="sep"></div>
    <div class="c big">Ficha del contrato N.º ${esc(d.number)}</div>
    <div class="c">${esc(STATUS[d.status] || d.status)} · ${esc(d.property?.address || "")}</div>
    <div class="sep"></div>${people("INQUILINO", "Inquilino")}${people("COINQUILINO", "Coinquilino")}${owners}${people("GARANTE", "Garante")}${people("FIADOR", "Fiador")}
    <div class="sep"></div>
    ${row("Inicio", shortDate(d.start_date))}${row("Fin", shortDate(d.end_date))}${row("Plazo", `${d.term_months} meses`)}${row("Vence el día", String(d.due_day))}
    ${row("Canon inicial", moneyIn(d.initial_rent, d.currency))}${row("Canon actual", moneyIn(d.current_rent, d.currency), "big")}
    ${row("Ajuste", d.adjustment_text || METHOD[d.adjustment_method] || "")}${d.next_adjustment_date ? row("Próximo ajuste", shortDate(d.next_adjustment_date)) : ""}
    ${d.deposit_amount ? row("Depósito", moneyIn(d.deposit_amount, d.deposit_currency || d.currency)) : ""}
    ${d.admin_commission_pct ? row("Comisión de administración", `${d.admin_commission_pct}%`) : ""}
    ${plan ? `<div class="sep"></div><div class="b">Conceptos recurrentes</div>${plan}` : ""}
    ${adj ? `<div class="sep"></div><div class="b">Ajustes</div><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr><th align="left">Fecha</th><th align="left">Estado</th><th class="r">Antes</th><th class="r">Después</th></tr></thead><tbody>${adj}</tbody></table>` : ""}
    ${d.notes ? `<div class="sep"></div><div>${esc(d.notes)}</div>` : ""}
    ${legal(d.notice || "Ficha resumen para uso interno. No es el contrato.")}
    <div class="legal">Generada el ${esc(dateTime(d.generated))}</div>`;
  printHtml(`Contrato ${d.number}`, body);
}

export function printPartyExport(d: any, agency: Agency | null) {
  const p = d.persona || {};
  const lines = (title: string, items: string[]) => items.length ? `<div class="sep"></div><div class="b">${esc(title)}</div>${items.map((i) => `<div>${esc(i)}</div>`).join("")}` : "";
  const body = `${agency ? header(agency) : "<h1>Datos de la persona</h1>"}<div class="sep"></div>
    <div class="c big">Datos que guardamos de ${esc(p.full_name)}</div>
    ${row("Documento", `${p.doc_type || ""} ${p.doc_number || ""}`.trim() || "—")}${row("CUIT", p.cuit || "—")}${row("Email", p.email || "—")}
    ${row("Teléfono", [p.phone_area, p.phone_number].filter(Boolean).join(" ") || "—")}${row("Domicilio", [p.address, p.city, p.province].filter(Boolean).join(", ") || "—")}
    ${row("Consentimiento", p.consent_at ? dateTime(p.consent_at) : "sin registrar")}
    ${lines("Contratos", (d.contratos || []).map((c: any) => `N.º ${c.numero} · ${c.rol} · ${c.estado} · ${c.propiedad || ""} (${shortDate(c.inicio)} al ${shortDate(c.fin)})`))}
    ${lines("Propiedades como propietario", (d.propiedades_como_propietario || []).map((x: any) => `${x.codigo} · ${x.direccion}`))}
    ${lines("Documentos", (d.documentos || []).map((x: any) => `${x.nombre} (${x.tipo})${x.vence ? " · vence " + shortDate(x.vence) : ""}`))}
    <div class="sep"></div><div class="legal">${esc(d.aviso || "")}</div>${legal()}
    <div class="legal">Generado el ${esc(dateTime(d.generado))}</div>`;
  printHtml(`Datos de ${p.full_name}`, body);
}

export function printDepositReturn(r: { agency: Agency; contract: { number: number; address: string; tenant: string | null }; deposit: any; result: any; returned_on: string }) {
  const cur = r.deposit.currency;
  const ded = (r.deposit.deductions || []).map((x: any) => row(x.concept, "- " + moneyIn(x.amount, cur))).join("");
  const body = `${header(r.agency)}<div class="sep"></div>
    <div class="c big">Devolución del depósito en garantía</div>
    ${row("Contrato", `N.º ${r.contract.number} · ${r.contract.address}`)}${r.contract.tenant ? row("Inquilino", r.contract.tenant) : ""}${row("Fecha", shortDate(r.returned_on))}
    <div class="sep"></div>${row("Depósito recibido", moneyIn(r.deposit.amount, cur))}
    ${r.result.base_amount !== r.deposit.amount ? row("Base de devolución", moneyIn(r.result.base_amount, cur)) : ""}
    ${ded ? `<div class="b">Descuentos documentados</div>${ded}` : ""}
    <div class="sep"></div>${row("Se devuelve", moneyIn(r.result.returned_amount, cur), "big")}
    ${r.result.receipt ? `<div>Parte aplicada a la deuda: recibo ${esc(r.result.receipt)}</div>` : ""}
    ${legal("Los descuentos se respaldan con las facturas y comprobantes que conserva la inmobiliaria.")}`;
  printHtml("Devolución de depósito", body);
}
