import { t } from "./i18n";
/**
 * Importar la "Actividad" de PayPal (CSV): cada cobro se cruza con el cliente por su correo
 * y se propone como pago de su comisión con deuda. Lógica pura: el CSV entra como texto.
 */
import { round2, paymentSummary } from "./commissionHelpers";
import { parseCsv } from "./formImport";

export type PaypalRow = {
  txId: string;
  /** AAAA-MM-DD */
  date: string;
  currency: string;
  /** Lo que pagó el cliente */
  gross: number;
  /** Lo que te llegó, ya sin comisión */
  net: number;
  email: string;
};

/** "1.234,56", "1,234.56", "-6,22" o "113.78". El último separador es el decimal. */
export function parseAmount(text: string): number | null {
  const clean = text.trim().replace(/[^\d.,-]/g, "");
  const decimal = Math.max(clean.lastIndexOf(","), clean.lastIndexOf("."));
  const normalized =
    decimal < 0 ? clean : `${clean.slice(0, decimal).replace(/[.,]/g, "")}.${clean.slice(decimal + 1)}`;
  const value = Number(normalized);

  return clean !== "" && Number.isFinite(value) ? value : null;
}

/** "04/10/2026" (día primero, como lo exporta PayPal en español) o "2026-10-04". */
export function parsePaypalDate(text: string): string | null {
  const iso = text.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  const dayFirst = text.trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);

  // ponytail: si tu PayPal exportara mes/día/año (en inglés de EE. UU.), saldrían fechas cambiadas
  return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : dayFirst ? `${dayFirst[3]}-${dayFirst[2].padStart(2, "0")}-${dayFirst[1].padStart(2, "0")}` : null;
}

/** Los cobros recibidos (importe positivo y completado) con correo del que paga. */
export function parsePaypalCsv(text: string): { rows: PaypalRow[]; error?: string } {
  const [header, ...lines] = parseCsv(text);

  if (!header) {
    return { rows: [], error: t("The file is empty") };
  }

  const find = (pattern: RegExp) => header.findIndex((title) => pattern.test(title.trim()));
  const [dateC, statusC, currencyC, grossC, feeC, netC, fromC, txC] = [
    /^(date|fecha)/i,
    /^(status|estado)/i,
    /^(currency|divisa|moneda)/i,
    /^(gross|bruto)/i,
    /^(fee|tarifa|comisi)/i,
    /^(net|neto)/i,
    /from email|remitente|correo.*(remit|de )/i,
    /transaction id|transacci/i,
  ].map(find);

  if ([dateC, currencyC, grossC, fromC, txC].some((index) => index < 0)) {
    return { rows: [], error: t("This doesn't look like a PayPal activity CSV (date, currency, gross, sender email, transaction id)") };
  }

  const rows: PaypalRow[] = [];

  for (const line of lines) {
    const gross = parseAmount(line[grossC] ?? "");
    const fee = feeC >= 0 ? (parseAmount(line[feeC] ?? "") ?? 0) : 0;
    const net = netC >= 0 ? parseAmount(line[netC] ?? "") : null;
    const date = parsePaypalDate(line[dateC] ?? "");
    const email = (line[fromC] ?? "").trim().toLowerCase();
    const txId = (line[txC] ?? "").trim();
    const status = statusC >= 0 ? (line[statusC] ?? "") : "completed";

    if (gross === null || gross <= 0 || !date || !email || !txId || !/complet|hecho|liberad/i.test(status)) {
      continue;
    }

    rows.push({ txId, date, currency: (line[currencyC] ?? "").trim().toUpperCase(), gross, net: round2(net ?? gross + fee), email });
  }

  return { rows };
}

export type PaypalMatch = {
  row: PaypalRow;
  /** ready: listo para importar · duplicate: ya importado · unknown: ningún cliente con ese correo · nodebt: ninguna comisión con deuda */
  status: "ready" | "duplicate" | "unknown" | "nodebt";
  clientId: number | null;
  commissionId: number | null;
};

type MatchClient = { id: number; email: string | null };
type MatchCommission = { id: number; client_id: number | null; price: number | null; currency: string | null };
type MatchPayment = { commission_id: number; amount: number; received: number | null; external_id: string | null };

/**
 * Cruza cada cobro con un cliente (por correo) y con su comisión con deuda en la misma divisa:
 * primero la que debe exactamente ese importe y, si no, la más antigua. Las ya importadas se saltan.
 */
export function matchPaypalRows(
  rows: PaypalRow[],
  clients: MatchClient[],
  commissions: MatchCommission[],
  payments: MatchPayment[],
): PaypalMatch[] {
  const imported = new Set(payments.map((payment) => payment.external_id).filter(Boolean));
  // lo que cada comisión aún debe; baja a medida que se asignan cobros de este mismo archivo
  const remaining = new Map(
    commissions.map((commission) => [
      commission.id,
      paymentSummary(commission.price, payments.filter((payment) => payment.commission_id === commission.id)).remaining,
    ]),
  );

  return [...rows]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((row): PaypalMatch => {
      const none = { row, clientId: null, commissionId: null };

      if (imported.has(row.txId)) {
        return { ...none, status: "duplicate" };
      }

      const client = clients.find((item) => item.email?.trim().toLowerCase() === row.email);

      if (!client) {
        return { ...none, status: "unknown" };
      }

      const open = commissions
        .filter(
          (commission) =>
            commission.client_id === client.id &&
            (remaining.get(commission.id) ?? 0) > 0 &&
            (!commission.currency || !row.currency || commission.currency.toUpperCase() === row.currency),
        )
        .sort((a, b) => a.id - b.id);
      const chosen = open.find((commission) => remaining.get(commission.id) === row.gross) ?? open[0];

      if (!chosen) {
        return { ...none, status: "nodebt", clientId: client.id };
      }

      remaining.set(chosen.id, round2(Math.max((remaining.get(chosen.id) ?? 0) - row.gross, 0)));

      return { row, status: "ready", clientId: client.id, commissionId: chosen.id };
    });
}
