// Impresiones del grupo G2 (recibo, estado de cuenta y rendición al propietario). Todas llevan «Documento no válido como factura».
import { dateTime, moneyIn, shortDate } from "../../config";
import { NOT_INVOICE, esc, printHtml } from "./printDoc";

interface Agency {
  name: string | null; legal_name: string | null; cuit_text: string | null; tax_condition_text: string | null; address: string | null;
  phone: string | null; email: string | null; broker_name: string | null; broker_license: string | null; broker_college: string | null;
  receipt_footer?: string | null; payment_alias?: string | null;
}

const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
export function periodName(period: string | null | undefined): string {
  if (!period) return "";
  const [y, m] = period.split("-").map(Number);
  return `${MONTHS[(m || 1) - 1]} ${y}`;
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

export function printReceipt(r: any) {
  const items = (r.items || []).map((i: any) => row(`${i.concept_label}${i.period ? " " + periodName(i.period) : ""}`, moneyIn(i.amount, r.currency))).join("");
  const body = `${header(r.agency)}<div class="sep"></div>
    <div class="c big">Recibo ${esc(r.number_text)}</div>
    ${row("Fecha", shortDate(r.issued_on))}
    ${r.payer ? row("Recibimos de", r.payer) : ""}
    ${r.contract ? row("Contrato", `N.º ${r.contract.number} · ${r.contract.address}`) : ""}
    <div class="sep"></div>${items || '<div class="c">Pago a cuenta</div>'}
    ${r.credit_created ? row("Saldo a favor generado", moneyIn(r.credit_created, r.currency)) : ""}
    <div class="sep"></div>${row("Total cobrado", moneyIn(r.total, r.currency), "big")}
    ${r.currency === "USD" && r.fx_rate ? row("Cotización", `$ ${r.fx_rate} = $ ${Math.round(r.total_ars).toLocaleString("es-AR")}`) : ""}
    ${row("Forma de pago", `${r.method_label}${r.reference ? " · " + r.reference : ""}`)}
    ${r.notes ? `<div>${esc(r.notes)}</div>` : ""}
    ${r.status === "ANULADO" ? `<div class="warn c">RECIBO ANULADO${r.voided_reason ? ": " + esc(r.voided_reason) : ""}</div>` : ""}
    ${legal(r.agency.receipt_footer || "")}`;
  printHtml(`Recibo ${r.number_text}`, body);
}

export function printStatement(d: any) {
  const lines = (d.charges || []).map((c: any) => `<tr><td>${esc(c.concept_label)} ${esc(periodName(c.period))}</td><td>${shortDate(c.due_date)}</td>
    <td class="r">${esc(moneyIn(c.amount, c.currency))}</td><td class="r">${esc(moneyIn(c.paid_amount, c.currency))}</td><td class="r b">${esc(moneyIn(c.balance, c.currency))}</td></tr>`).join("");
  const bal = Object.entries(d.balances || {}).map(([cur, b]: any) => row(`Saldo a pagar (${cur})`, moneyIn(b.net, cur), "big")).join("");
  const body = `${header(d.agency)}<div class="sep"></div><div class="c big">Estado de cuenta al ${shortDate(d.as_of)}</div>
    ${row("Contrato", `N.º ${d.contract.number} · ${d.contract.address}`)}${d.contract.tenant ? row("Inquilino", d.contract.tenant.full_name) : ""}
    <div class="sep"></div><table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr><th align="left">Concepto</th><th align="left">Vence</th><th class="r">Importe</th><th class="r">Pagado</th><th class="r">Saldo</th></tr></thead><tbody>${lines}</tbody></table>
    <div class="sep"></div>${bal || row("Saldo", "$ 0")}
    ${d.agency.payment_alias ? row("Transferencia a", d.agency.payment_alias) : ""}${legal()}`;
  printHtml("Estado de cuenta", body);
}

export function printSettlement(s: any) {
  const lines = (s.lines || []).map((l: any) => `<tr><td>${esc(l.description)}</td><td class="r b">${esc(moneyIn(l.amount, s.currency))}</td></tr>`).join("");
  const body = `${header(s.agency)}<div class="sep"></div><div class="c big">Rendición de ${esc(periodName(s.period))}</div>
    ${row("Propietario", s.owner_name)}${s.status === "BORRADOR" ? '<div class="warn c">BORRADOR: todavía no está cerrada</div>' : ""}
    <div class="sep"></div><table style="width:100%;border-collapse:collapse;font-size:12px"><tbody>${lines}</tbody></table>
    <div class="sep"></div>${row("Cobrado", moneyIn(s.gross_collected, s.currency))}${row("Comisión", moneyIn(-s.commission_total, s.currency))}
    ${s.commission_iva ? row("IVA sobre la comisión", moneyIn(-s.commission_iva, s.currency)) : ""}${row("Gastos y descuentos", moneyIn(-s.deductions_total, s.currency))}
    ${s.carried_balance_in ? row("Saldo anterior", moneyIn(s.carried_balance_in, s.currency)) : ""}
    <div class="sep"></div>${row("Neto a pagar", moneyIn(s.net_amount, s.currency), "big")}
    ${s.carried_balance_out ? row("Saldo a descontar en la próxima", moneyIn(s.carried_balance_out, s.currency)) : ""}
    ${s.status === "PAGADA" ? row("Pagada", `${shortDate(s.paid_on)} · ${s.paid_method || ""} · ${s.paid_reference || ""}`) : ""}
    ${s.commission_invoice_ref ? row("Factura de la comisión", s.commission_invoice_ref) : ""}
    ${s.closed_at ? `<div class="legal">Cerrada el ${esc(dateTime(s.closed_at))}</div>` : ""}${legal()}`;
  printHtml(`Rendición ${periodName(s.period)}`, body);
}
