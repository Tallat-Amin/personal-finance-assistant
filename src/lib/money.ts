export function centsToDollars(cents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function dollarsToCents(value: string | number) {
  const numeric =
    typeof value === "number"
      ? value
      : Number.parseFloat(String(value).replace(/[$,\s]/g, ""));
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return Math.round(numeric * 100);
}

export function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function endOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

export function previousMonthRange(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth() - 1, 1);
  const end = new Date(date.getFullYear(), date.getMonth(), 0, 23, 59, 59, 999);
  return { start, end };
}

export function normalizeMerchant(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\b(inc|llc|co|store|market|payment|pos|purchase)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
