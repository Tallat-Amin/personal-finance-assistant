import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AuthForm } from "@/components/auth-form";

export default async function SignUpPage() {
  const session = await auth();
  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#f3f0e7] px-4 py-10">
      <section className="w-full max-w-md rounded-md border border-stone-300 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-800">
          Personal Finance Assistant
        </p>
        <h1 className="mt-3 text-3xl font-semibold text-stone-950">
          Create account
        </h1>
        <p className="mt-2 text-sm leading-6 text-stone-600">
          Credentials auth keeps this assessment self-contained while preserving
          user-level data isolation.
        </p>
        <div className="mt-8">
          <AuthForm mode="signup" />
        </div>
      </section>
    </main>
  );
}
