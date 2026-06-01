import crypto from "node:crypto";
import { z } from "zod";
import { dollarsToCents, normalizeMerchant } from "@/lib/money";

const rowSchema = z.object({
  date: z.string().min(4),
  merchant: z.string().min(1),
  amount: z.string().optional(),
  debit: z.string().optional(),
  credit: z.string().optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  id: z.string().optional(),
});

type ParsedTransaction = {
  externalId?: string;
  postedAt: Date;
  merchant: string;
  description?: string;
  category: string;
  amountCents: number;
  normalizedHash: string;
};

export type CsvParseResult = {
  validRows: ParsedTransaction[];
  rejectedRows: Array<{ row: number; reason: string }>;
};

const aliases: Record<string, string> = {
  transaction_date: "date",
  posted_at: "date",
  posted: "date",
  name: "merchant",
  vendor: "merchant",
  payee: "merchant",
  memo: "description",
  details: "description",
  transaction_id: "id",
  debit_amount: "debit",
  withdrawal: "debit",
  withdrawals: "debit",
  credit_amount: "credit",
  deposit: "credit",
  deposits: "credit",
};

export function parseTransactionsCsv(input: string): CsvParseResult {
  const lines = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) {
    return {
      validRows: [],
      rejectedRows: [
        { row: 0, reason: "CSV needs a header and at least one row." },
      ],
    };
  }

  const headers = splitCsvLine(lines[0]).map((header) => {
    const normalized = header.toLowerCase().trim().replace(/\s+/g, "_");
    return aliases[normalized] ?? normalized;
  });

  const validRows: ParsedTransaction[] = [];
  const rejectedRows: CsvParseResult["rejectedRows"] = [];

  for (let index = 1; index < lines.length; index += 1) {
    const values = splitCsvLine(lines[index]);
    const raw = Object.fromEntries(
      headers.map((key, i) => [key, values[i] ?? ""]),
    );
    const parsed = rowSchema.safeParse(raw);
    if (!parsed.success) {
      rejectedRows.push({
        row: index + 1,
        reason: "Missing date or merchant.",
      });
      continue;
    }

    const postedAt = new Date(parsed.data.date);
    const amountCents = parseSignedAmount(parsed.data);
    if (Number.isNaN(postedAt.getTime()) || amountCents === 0) {
      rejectedRows.push({
        row: index + 1,
        reason: "Invalid date or zero/invalid amount.",
      });
      continue;
    }

    const merchant = parsed.data.merchant.trim();
    const category = inferCategory(parsed.data.category || merchant);
    const normalizedHash = hashTransaction({
      postedAt,
      merchant,
      amountCents,
      externalId: parsed.data.id,
    });

    validRows.push({
      externalId: parsed.data.id || undefined,
      postedAt,
      merchant,
      description: parsed.data.description || undefined,
      category,
      amountCents,
      normalizedHash,
    });
  }

  return { validRows, rejectedRows };
}

export function inferCategory(value: string) {
  const text = value.toLowerCase();
  if (/grocery|market|whole foods|trader|kroger|aldi|costco/.test(text))
    return "Groceries";
  if (/uber|lyft|gas|shell|chevron|metro|transit/.test(text))
    return "Transport";
  if (/netflix|spotify|hulu|disney|prime|subscription|apple/.test(text))
    return "Subscriptions";
  if (/rent|mortgage|apartment|property/.test(text)) return "Housing";
  if (/restaurant|cafe|coffee|doordash|uber eats|grubhub/.test(text))
    return "Dining";
  if (/pharmacy|doctor|clinic|health/.test(text)) return "Health";
  if (/payroll|salary|deposit/.test(text)) return "Income";
  return value.trim() && !value.includes(" ") ? titleCase(value) : "General";
}

function hashTransaction(input: {
  postedAt: Date;
  merchant: string;
  amountCents: number;
  externalId?: string;
}) {
  const basis = [
    input.externalId ?? "",
    input.postedAt.toISOString().slice(0, 10),
    normalizeMerchant(input.merchant),
    input.amountCents,
  ].join("|");
  return crypto.createHash("sha256").update(basis).digest("hex");
}

function splitCsvLine(line: string) {
  const result: string[] = [];
  let current = "";
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"' && line[i + 1] === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function parseSignedAmount(input: {
  amount?: string;
  debit?: string;
  credit?: string;
}) {
  const debit = input.debit ? dollarsToCents(input.debit) : 0;
  const credit = input.credit ? dollarsToCents(input.credit) : 0;
  if (debit > 0) return -debit;
  if (credit > 0) return credit;

  const rawAmount = String(input.amount ?? "").trim();
  if (!rawAmount) return 0;
  const normalized = rawAmount.replace(/[,$\s]/g, "");
  const negative = normalized.startsWith("-") || /^\(.+\)$/.test(normalized);
  const cents = dollarsToCents(normalized.replace(/[()]/g, ""));
  return negative ? -Math.abs(cents) : cents;
}
