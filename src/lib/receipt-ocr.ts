import { inferCategory } from "@/lib/csv";
import { dollarsToCents } from "@/lib/money";

export type ReceiptExtraction = {
  text: string;
  confidence: number | null;
  merchant?: string;
  amountCents?: number;
  postedAt?: Date;
  category?: string;
  status: "extracted" | "needs_review" | "failed";
  note: string;
};

export async function extractReceipt(file: File): Promise<ReceiptExtraction> {
  try {
    const { recognize } = await import("tesseract.js");
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await recognize(buffer, "eng", {
      logger: () => undefined,
    });
    const text = normalizeOcrText(result.data.text);
    const confidence =
      typeof result.data.confidence === "number"
        ? result.data.confidence
        : null;

    if (!text || text.length < 8) {
      return {
        text,
        confidence,
        status: "needs_review",
        note: "OCR ran but did not find enough text. Enter the fields manually.",
      };
    }

    const merchant = extractMerchant(text);
    const amountCents = extractTotalCents(text);
    const postedAt = extractDate(text);
    const complete = Boolean(merchant && amountCents && postedAt);

    return {
      text,
      confidence,
      merchant,
      amountCents,
      postedAt,
      category: merchant ? inferCategory(merchant) : undefined,
      status:
        complete && confidence !== null && confidence >= 45
          ? "extracted"
          : "needs_review",
      note: complete
        ? "OCR extracted receipt fields. Review before relying on them for a real finance workflow."
        : "OCR found text but could not confidently extract merchant, date, and total.",
    };
  } catch (error) {
    return {
      text: "",
      confidence: null,
      status: "failed",
      note: `OCR failed: ${error instanceof Error ? error.message : "unknown error"}. Enter the fields manually.`,
    };
  }
}

function normalizeOcrText(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
}

function extractMerchant(text: string) {
  const ignored =
    /^(receipt|invoice|tax|total|subtotal|amount|date|time|visa|mastercard|card|change|cashier)\b/i;
  return (
    text
      .split("\n")
      .map((line) => line.replace(/[^a-zA-Z0-9 &'#.-]/g, "").trim())
      .find(
        (line) =>
          line.length >= 3 && /[a-zA-Z]/.test(line) && !ignored.test(line),
      ) || undefined
  );
}

function extractTotalCents(text: string) {
  const lines = text.split("\n");
  const totalLine = [...lines]
    .reverse()
    .find((line) => /\b(total|amount due|balance)\b/i.test(line));
  const candidates = (totalLine ? [totalLine] : lines).flatMap((line) =>
    [
      ...line.matchAll(
        /(?:\$|\bUSD\s*)?([0-9]{1,4}(?:[,.][0-9]{3})*(?:[.][0-9]{2})|[0-9]+[.][0-9]{2})\b/g,
      ),
    ].map((match) => match[1]),
  );
  const cents = candidates
    .map((value) => dollarsToCents(value))
    .filter((value) => value > 0)
    .sort((a, b) => b - a);
  return cents[0];
}

function extractDate(text: string) {
  const patterns = [
    /\b(\d{4}[-/]\d{1,2}[-/]\d{1,2})\b/,
    /\b(\d{1,2}[-/]\d{1,2}[-/]\d{2,4})\b/,
    /\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*\.?\s+\d{1,2},?\s+\d{2,4})\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const parsed = new Date(match[1]);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return undefined;
}
