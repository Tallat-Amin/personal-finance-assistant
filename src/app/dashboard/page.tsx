import {
  AlertTriangle,
  BadgeDollarSign,
  Database,
  FileUp,
  PiggyBank,
  ReceiptText,
  Repeat2,
} from "lucide-react";
import {
  budgetAction,
  importCsvAction,
  receiptAction,
  seedDemoAction,
  signOutAction,
} from "@/app/actions";
import { ActionForm } from "@/components/action-form";
import { AssistantPanel } from "@/components/assistant-panel";
import { getDashboardData } from "@/lib/analytics";
import { requireUserId } from "@/lib/auth-guard";
import { centsToDollars } from "@/lib/money";

export default async function DashboardPage() {
  const userId = await requireUserId();
  const data = await getDashboardData(userId);

  return (
    <main className="min-h-screen bg-[#f3f0e7] text-stone-950">
      <header className="border-b border-stone-300 bg-[#fbfaf6]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">
              Personal Finance Assistant
            </p>
            <h1 className="text-2xl font-semibold">Private money workspace</h1>
          </div>
          <form action={signOutAction}>
            <button
              className="rounded-md border border-stone-300 px-3 py-2 text-sm font-semibold hover:bg-white"
              type="submit"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_420px] lg:px-8">
        <section className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              title="This month"
              value={centsToDollars(data.totalSpend)}
              icon={<BadgeDollarSign size={18} />}
            />
            <Metric
              title="Last month"
              value={centsToDollars(data.previousSpend)}
              icon={<Database size={18} />}
            />
            <Metric
              title="Transactions"
              value={String(data.transactions.length)}
              icon={<FileUp size={18} />}
            />
            <Metric
              title="Subscriptions"
              value={String(data.subscriptions.length)}
              icon={<Repeat2 size={18} />}
            />
          </div>

          <section className="rounded-md border border-stone-300 bg-[#fbfaf6] p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold">Ledger intake</h2>
                <p className="text-sm text-stone-600">
                  Import CSV data or seed a local demo dataset.
                </p>
              </div>
              <form action={seedDemoAction}>
                <button
                  className="rounded-md bg-emerald-800 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-900"
                  type="submit"
                >
                  Seed demo
                </button>
              </form>
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <ActionForm action={importCsvAction} submitLabel="Import CSV">
                <input
                  accept=".csv,text/csv"
                  className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
                  name="csvFile"
                  type="file"
                />
                <textarea
                  className="min-h-44 rounded-md border border-stone-300 bg-white p-3 font-mono text-xs outline-none focus:border-emerald-800"
                  name="csv"
                  placeholder={`Or paste CSV here:\ndate,merchant,amount,category,description\n2026-05-02,Green Basket Market,-96.42,Groceries,weekly shop`}
                />
              </ActionForm>
              <ActionForm action={receiptAction} submitLabel="Record receipt">
                <input
                  accept="image/*"
                  className="rounded-md border border-stone-300 bg-white px-3 py-2 text-sm"
                  name="receipt"
                  type="file"
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    className="field"
                    name="merchant"
                    placeholder="Merchant"
                  />
                  <input className="field" name="amount" placeholder="Amount" />
                  <input
                    className="field"
                    name="category"
                    placeholder="Category"
                  />
                  <input className="field" name="date" type="date" />
                </div>
                <p className="text-xs leading-5 text-stone-500">
                  OCR runs first. Empty fields are filled from the receipt when
                  Tesseract can extract them with usable confidence.
                </p>
              </ActionForm>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-md border border-stone-300 bg-[#fbfaf6] p-5">
              <div className="mb-4 flex items-center gap-2">
                <FileUp className="text-emerald-800" size={20} />
                <h2 className="text-lg font-semibold">Recent CSV imports</h2>
              </div>
              <div className="space-y-3">
                {data.csvImports.map((item) => (
                  <div
                    className="rounded-md border border-stone-200 bg-white p-3 text-sm"
                    key={item.id}
                  >
                    <div className="flex justify-between gap-3">
                      <span className="font-semibold">
                        {item.fileName || "Pasted CSV"}
                      </span>
                      <span className="text-stone-500">
                        {formatShortDate(item.createdAt)}
                      </span>
                    </div>
                    <p className="mt-1 text-stone-600">
                      {item.insertedRows} inserted, {item.duplicateRows}{" "}
                      duplicates, {item.rejectedRows} rejected.
                    </p>
                    {item.rejectedJson ? (
                      <p className="mt-1 text-xs text-amber-800">
                        First rejected rows:{" "}
                        {summarizeRejected(item.rejectedJson)}
                      </p>
                    ) : null}
                  </div>
                ))}
                {data.csvImports.length === 0 ? (
                  <p className="text-sm text-stone-600">
                    Import a CSV to see row-level results here.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="rounded-md border border-stone-300 bg-[#fbfaf6] p-5">
              <div className="mb-4 flex items-center gap-2">
                <ReceiptText className="text-emerald-800" size={20} />
                <h2 className="text-lg font-semibold">Receipt OCR queue</h2>
              </div>
              <div className="space-y-3">
                {data.receipts.map((receipt) => (
                  <div
                    className="rounded-md border border-stone-200 bg-white p-3 text-sm"
                    key={receipt.id}
                  >
                    <div className="flex justify-between gap-3">
                      <span className="font-semibold">{receipt.fileName}</span>
                      <span className="rounded-sm bg-stone-100 px-2 py-0.5 text-xs text-stone-700">
                        {receipt.status}
                      </span>
                    </div>
                    <p className="mt-1 text-stone-600">
                      Confidence:{" "}
                      {typeof receipt.ocrConfidence === "number"
                        ? `${Math.round(receipt.ocrConfidence)}%`
                        : "n/a"}
                    </p>
                    {receipt.notes ? (
                      <p className="mt-1 text-xs leading-5 text-stone-500">
                        {receipt.notes}
                      </p>
                    ) : null}
                    {receipt.ocrText ? (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs font-semibold text-emerald-800">
                          OCR text
                        </summary>
                        <pre className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap rounded-md bg-stone-950 p-2 text-xs text-stone-100">
                          {receipt.ocrText}
                        </pre>
                      </details>
                    ) : null}
                  </div>
                ))}
                {data.receipts.length === 0 ? (
                  <p className="text-sm text-stone-600">
                    Upload a receipt to run OCR and record or review the result.
                  </p>
                ) : null}
              </div>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-md border border-stone-300 bg-[#fbfaf6] p-5">
              <div className="mb-4 flex items-center gap-2">
                <PiggyBank className="text-emerald-800" size={20} />
                <h2 className="text-lg font-semibold">Budget tracking</h2>
              </div>
              <ActionForm action={budgetAction} submitLabel="Save budget">
                <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
                  <input
                    className="field"
                    name="category"
                    placeholder="Dining"
                  />
                  <input className="field" name="amount" placeholder="450" />
                </div>
              </ActionForm>
              <div className="mt-5 space-y-3">
                {data.budgets.map((budget) => {
                  const spent = data.categoryTotals[budget.category] ?? 0;
                  const percent = Math.min(
                    100,
                    Math.round((spent / budget.monthlyCents) * 100),
                  );
                  return (
                    <div key={budget.id}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span className="font-medium">{budget.category}</span>
                        <span className="text-stone-600">
                          {centsToDollars(spent)} /{" "}
                          {centsToDollars(budget.monthlyCents)}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-stone-200">
                        <div
                          className="h-2 rounded-full bg-emerald-800"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                {data.budgets.length === 0 ? (
                  <p className="text-sm text-stone-600">
                    Set a category budget to track burn rate.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="rounded-md border border-stone-300 bg-[#fbfaf6] p-5">
              <div className="mb-4 flex items-center gap-2">
                <AlertTriangle className="text-amber-700" size={20} />
                <h2 className="text-lg font-semibold">Attention queue</h2>
              </div>
              <div className="space-y-3">
                {data.unusual.slice(0, 5).map((tx) => (
                  <div
                    className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm"
                    key={tx.id}
                  >
                    <div className="flex justify-between gap-3">
                      <span className="font-semibold">{tx.merchant}</span>
                      <span>{centsToDollars(Math.abs(tx.amountCents))}</span>
                    </div>
                    <p className="text-amber-900">{tx.category}</p>
                  </div>
                ))}
                {data.unusual.length === 0 ? (
                  <p className="text-sm text-stone-600">
                    No unusual charges detected yet.
                  </p>
                ) : null}
              </div>
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <ListPanel
              empty="No recurring charges found yet."
              icon={<Repeat2 size={20} />}
              items={data.subscriptions.slice(0, 6).map((item) => ({
                label: item.merchant,
                value: `${centsToDollars(item.averageCents)} / ${item.cadence}`,
              }))}
              title="Recurring subscriptions"
            />
            <ListPanel
              empty="Import transactions to populate category totals."
              icon={<ReceiptText size={20} />}
              items={Object.entries(data.categoryTotals)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 6)
                .map(([label, cents]) => ({
                  label,
                  value: centsToDollars(cents),
                }))}
              title="Category totals"
            />
          </section>
        </section>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <AssistantPanel initialSummary={data.summary} />
        </aside>
      </div>
    </main>
  );
}

function formatShortDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function summarizeRejected(raw: string) {
  try {
    const rows = JSON.parse(raw) as Array<{ row: number; reason: string }>;
    return rows
      .slice(0, 3)
      .map((row) => `row ${row.row}: ${row.reason}`)
      .join("; ");
  } catch {
    return "Could not parse rejection report.";
  }
}

function Metric({
  title,
  value,
  icon,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-stone-300 bg-[#fbfaf6] p-4">
      <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-md bg-emerald-900 text-white">
        {icon}
      </div>
      <p className="text-sm text-stone-600">{title}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function ListPanel({
  title,
  icon,
  items,
  empty,
}: {
  title: string;
  icon: React.ReactNode;
  items: Array<{ label: string; value: string }>;
  empty: string;
}) {
  return (
    <div className="rounded-md border border-stone-300 bg-[#fbfaf6] p-5">
      <div className="mb-4 flex items-center gap-2 text-emerald-800">
        {icon}
        <h2 className="text-lg font-semibold text-stone-950">{title}</h2>
      </div>
      <div className="space-y-2">
        {items.map((item) => (
          <div
            className="flex justify-between gap-4 border-b border-stone-200 py-2 text-sm"
            key={item.label}
          >
            <span className="font-medium">{item.label}</span>
            <span className="text-right text-stone-600">{item.value}</span>
          </div>
        ))}
        {items.length === 0 ? (
          <p className="text-sm text-stone-600">{empty}</p>
        ) : null}
      </div>
    </div>
  );
}
