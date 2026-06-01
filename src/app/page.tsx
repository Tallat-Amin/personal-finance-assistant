import { ArrowRight, LockKeyhole, ReceiptText, Sparkles } from "lucide-react";
import Link from "next/link";
import { auth } from "@/auth";

export default async function Home() {
  const session = await auth();

  return (
    <main className="min-h-screen overflow-hidden bg-[#f3f0e7] text-stone-950">
      <section className="mx-auto grid min-h-[92vh] max-w-7xl content-center gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_440px] lg:px-8">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-800">
            Personal finance assistant
          </p>
          <h1 className="mt-5 max-w-4xl text-5xl font-semibold leading-[1.02] sm:text-7xl">
            A finance assistant that starts with the ledger.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-stone-700">
            Multi-user transaction storage, budget tracking, receipt intake,
            recurring charge detection, anomaly surfacing, and a conversational
            layer that routes cheap questions to deterministic analytics.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              className="inline-flex h-11 items-center gap-2 rounded-md bg-emerald-800 px-4 text-sm font-semibold text-white hover:bg-emerald-900"
              href={session?.user ? "/dashboard" : "/signup"}
            >
              {session?.user ? "Open dashboard" : "Create account"}
              <ArrowRight size={17} />
            </Link>
            <Link
              className="inline-flex h-11 items-center rounded-md border border-stone-400 px-4 text-sm font-semibold hover:bg-white"
              href="/signin"
            >
              Sign in
            </Link>
          </div>
        </div>
        <div className="grid gap-3 self-end">
          <Feature
            icon={<LockKeyhole size={18} />}
            text="Every query and mutation is scoped by the Auth.js session user id."
            title="Private per user"
          />
          <Feature
            icon={<ReceiptText size={18} />}
            text="CSV parsing rejects bad rows without aborting the import and deduplicates repeats."
            title="Messy input ready"
          />
          <Feature
            icon={<Sparkles size={18} />}
            text="Simple finance questions use indexed data and heuristics before any model call would be considered."
            title="Cost-aware assistant"
          />
        </div>
      </section>
    </main>
  );
}

function Feature({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-md border border-stone-300 bg-[#fbfaf6] p-4 shadow-sm">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-md bg-stone-950 text-white">
        {icon}
      </div>
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-stone-600">{text}</p>
    </div>
  );
}
