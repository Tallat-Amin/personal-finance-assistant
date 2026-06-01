import type { Transaction } from "@/generated/prisma/client";
import {
  centsToDollars,
  endOfMonth,
  normalizeMerchant,
  previousMonthRange,
  startOfMonth,
} from "@/lib/money";
import { prisma } from "@/lib/prisma";

export async function getDashboardData(userId: string) {
  const now = new Date();
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const previous = previousMonthRange(now);

  const [transactions, budgets, memories, receipts, csvImports] =
    await Promise.all([
      prisma.transaction.findMany({
        where: { userId },
        orderBy: { postedAt: "desc" },
        take: 500,
      }),
      prisma.budget.findMany({
        where: { userId },
        orderBy: { category: "asc" },
      }),
      prisma.userMemory.findMany({
        where: { userId },
        orderBy: { updatedAt: "desc" },
      }),
      prisma.receipt.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
      prisma.csvImport.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
    ]);

  const thisMonth = transactions.filter((tx) =>
    inRange(tx.postedAt, monthStart, monthEnd),
  );
  const lastMonth = transactions.filter((tx) =>
    inRange(tx.postedAt, previous.start, previous.end),
  );
  const categoryTotals = totalByCategory(thisMonth);
  const subscriptions = detectSubscriptions(transactions);
  const unusual = detectUnusualActivity(transactions);
  const totalSpend = sumExpenses(thisMonth);
  const previousSpend = sumExpenses(lastMonth);

  return {
    transactions,
    budgets,
    memories,
    receipts,
    csvImports,
    categoryTotals,
    subscriptions,
    unusual,
    totalSpend,
    previousSpend,
    summary: summarizeFinances({
      totalSpend,
      previousSpend,
      categoryTotals,
      subscriptionsCount: subscriptions.length,
      unusualCount: unusual.length,
    }),
  };
}

export async function answerFinanceQuestion(userId: string, question: string) {
  const lower = question.toLowerCase();
  const transactions = await prisma.transaction.findMany({
    where: { userId },
    orderBy: { postedAt: "desc" },
    take: 5000,
  });

  if (transactions.length === 0) {
    return {
      intent: "no_data",
      answer:
        "I do not have any transactions yet. Import a CSV or add a receipt, then I can answer spending questions from your data.",
    };
  }

  if (
    /remember|i get paid|don't count|do not count|my payday|exclude/.test(lower)
  ) {
    const key = lower.includes("paid") ? "payday" : `note-${Date.now()}`;
    await prisma.userMemory.upsert({
      where: { userId_key: { userId, key } },
      create: { userId, key, value: question },
      update: { value: question },
    });
    return {
      intent: "memory",
      answer:
        "I saved that preference and will include it in future budget and spending explanations.",
    };
  }

  if (/subscription|recurring/.test(lower)) {
    const subscriptions = detectSubscriptions(transactions);
    return {
      intent: "subscriptions",
      answer:
        subscriptions.length === 0
          ? "I did not find clear recurring charges yet. More history will improve this signal."
          : `Likely recurring charges: ${subscriptions
              .slice(0, 6)
              .map(
                (item) =>
                  `${item.merchant} around ${centsToDollars(item.averageCents)} every ${item.cadence}`,
              )
              .join("; ")}.`,
    };
  }

  if (/unusual|weird|anomal|out of pattern|suspicious/.test(lower)) {
    const unusual = detectUnusualActivity(transactions);
    return {
      intent: "anomaly",
      answer:
        unusual.length === 0
          ? "I did not find charges that were clearly outside your usual pattern."
          : `Unusual activity to review: ${unusual
              .slice(0, 5)
              .map(
                (tx) =>
                  `${tx.merchant} for ${centsToDollars(Math.abs(tx.amountCents))} on ${formatDate(tx.postedAt)}`,
              )
              .join("; ")}.`,
    };
  }

  if (/cut back|save money|reduce|suggest/.test(lower)) {
    return { intent: "cuts", answer: suggestCuts(transactions) };
  }

  if (/more than usual|compare|this month|last month/.test(lower)) {
    const current = sumExpenses(
      transactions.filter((tx) =>
        inRange(tx.postedAt, startOfMonth(), endOfMonth()),
      ),
    );
    const previous = previousMonthRange();
    const previousTotal = sumExpenses(
      transactions.filter((tx) =>
        inRange(tx.postedAt, previous.start, previous.end),
      ),
    );
    const diff = current - previousTotal;
    return {
      intent: "comparison",
      answer: `This month you have spent ${centsToDollars(current)} versus ${centsToDollars(previousTotal)} last month. That is ${diff >= 0 ? "up" : "down"} ${centsToDollars(Math.abs(diff))}.`,
    };
  }

  if (/biggest|largest/.test(lower)) {
    const tx = [...transactions]
      .filter((item) => item.amountCents < 0)
      .sort((a, b) => a.amountCents - b.amountCents)[0];
    return {
      intent: "largest_purchase",
      answer: tx
        ? `Your biggest purchase in the imported history is ${tx.merchant} for ${centsToDollars(Math.abs(tx.amountCents))} on ${formatDate(tx.postedAt)}.`
        : "I could not find any expense transactions.",
    };
  }

  const category = inferQuestionCategory(lower);
  if (category) {
    const range = lower.includes("last month")
      ? previousMonthRange()
      : { start: startOfMonth(), end: endOfMonth() };
    const total = sumExpenses(
      transactions.filter(
        (tx) =>
          tx.category === category &&
          inRange(tx.postedAt, range.start, range.end),
      ),
    );
    return {
      intent: "category_spend",
      answer: `You spent ${centsToDollars(total)} on ${category.toLowerCase()} ${lower.includes("last month") ? "last month" : "this month"}.`,
    };
  }

  const dashboard = await getDashboardData(userId);
  return { intent: "summary", answer: dashboard.summary };
}

export function totalByCategory(transactions: Transaction[]) {
  return transactions
    .filter((tx) => tx.amountCents < 0)
    .reduce<Record<string, number>>((totals, tx) => {
      totals[tx.category] =
        (totals[tx.category] ?? 0) + Math.abs(tx.amountCents);
      return totals;
    }, {});
}

export function detectSubscriptions(transactions: Transaction[]) {
  const groups = new Map<string, Transaction[]>();
  for (const tx of transactions.filter((item) => item.amountCents < 0)) {
    const key = normalizeMerchant(tx.merchant);
    groups.set(key, [...(groups.get(key) ?? []), tx]);
  }

  return [...groups.values()]
    .filter((items) => items.length >= 2)
    .map((items) => {
      const sorted = [...items].sort(
        (a, b) => a.postedAt.getTime() - b.postedAt.getTime(),
      );
      const gaps = sorted
        .slice(1)
        .map((item, index) =>
          daysBetween(sorted[index].postedAt, item.postedAt),
        );
      const averageGap = gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
      const averageCents = Math.round(
        sorted.reduce((sum, item) => sum + Math.abs(item.amountCents), 0) /
          sorted.length,
      );
      return {
        merchant: sorted[0].merchant,
        averageCents,
        cadence:
          averageGap > 20 && averageGap < 40
            ? "month"
            : `${Math.round(averageGap)} days`,
        count: sorted.length,
      };
    })
    .filter((item) => item.count >= 3 || item.cadence === "month")
    .sort((a, b) => b.averageCents - a.averageCents);
}

export function detectUnusualActivity(transactions: Transaction[]) {
  const categoryAverages = new Map<string, number>();
  const byCategory = new Map<string, Transaction[]>();
  for (const tx of transactions.filter((item) => item.amountCents < 0)) {
    byCategory.set(tx.category, [...(byCategory.get(tx.category) ?? []), tx]);
  }
  for (const [category, items] of byCategory) {
    categoryAverages.set(category, sumExpenses(items) / items.length);
  }
  return transactions
    .filter((tx) => tx.amountCents < 0)
    .filter(
      (tx) =>
        Math.abs(tx.amountCents) >
        Math.max((categoryAverages.get(tx.category) ?? 0) * 2.5, 20_000),
    )
    .slice(0, 8);
}

export function summarizeFinances(input: {
  totalSpend: number;
  previousSpend: number;
  categoryTotals: Record<string, number>;
  subscriptionsCount: number;
  unusualCount: number;
}) {
  const topCategories = Object.entries(input.categoryTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([category, cents]) => `${category} (${centsToDollars(cents)})`);
  const direction = input.totalSpend >= input.previousSpend ? "above" : "below";
  return `You have spent ${centsToDollars(input.totalSpend)} this month, ${direction} last month by ${centsToDollars(Math.abs(input.totalSpend - input.previousSpend))}. Top categories: ${topCategories.join(", ") || "none yet"}. I found ${input.subscriptionsCount} likely subscriptions and ${input.unusualCount} unusual charges to review.`;
}

function suggestCuts(transactions: Transaction[]) {
  const categories = totalByCategory(
    transactions.filter((tx) =>
      inRange(tx.postedAt, startOfMonth(), endOfMonth()),
    ),
  );
  const [category, cents] = Object.entries(categories).sort(
    (a, b) => b[1] - a[1],
  )[0] ?? ["discretionary spending", 0];
  if (!cents)
    return "I need this month's transaction history before I can suggest specific cutbacks.";
  const target = Math.round(cents * 0.15);
  return `Your clearest opportunity is ${category}: trimming it by 15% would save about ${centsToDollars(target)} this month. Start with the largest merchants in that category and keep subscriptions only if you used them in the last 30 days.`;
}

function inferQuestionCategory(lower: string) {
  const categories = [
    "Groceries",
    "Transport",
    "Subscriptions",
    "Housing",
    "Dining",
    "Health",
    "General",
  ];
  return categories.find((category) => lower.includes(category.toLowerCase()));
}

function sumExpenses(transactions: Transaction[]) {
  return transactions.reduce(
    (sum, tx) => sum + (tx.amountCents < 0 ? Math.abs(tx.amountCents) : 0),
    0,
  );
}

function inRange(date: Date, start: Date, end: Date) {
  return date >= start && date <= end;
}

function daysBetween(a: Date, b: Date) {
  return Math.abs(b.getTime() - a.getTime()) / 86_400_000;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}
