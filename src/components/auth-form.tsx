"use client";

import Link from "next/link";
import { useActionState } from "react";
import { registerAction, signInAction } from "@/app/actions";

type AuthFormProps = {
  mode: "signin" | "signup";
};

export function AuthForm({ mode }: AuthFormProps) {
  const action = mode === "signin" ? signInAction : registerAction;
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="grid gap-4">
      {mode === "signup" ? (
        <label className="grid gap-2 text-sm font-medium text-stone-700">
          Name
          <input
            className="h-11 rounded-md border border-stone-300 bg-white px-3 text-base outline-none transition focus:border-emerald-700"
            name="name"
            placeholder="Maya Chen"
          />
        </label>
      ) : null}
      <label className="grid gap-2 text-sm font-medium text-stone-700">
        Email
        <input
          className="h-11 rounded-md border border-stone-300 bg-white px-3 text-base outline-none transition focus:border-emerald-700"
          name="email"
          placeholder="you@example.com"
          required
          type="email"
        />
      </label>
      <label className="grid gap-2 text-sm font-medium text-stone-700">
        Password
        <input
          className="h-11 rounded-md border border-stone-300 bg-white px-3 text-base outline-none transition focus:border-emerald-700"
          minLength={8}
          name="password"
          required
          type="password"
        />
      </label>
      {state.error ? (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}
      <button
        className="h-11 rounded-md bg-emerald-800 px-4 text-sm font-semibold text-white transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending
          ? "Working..."
          : mode === "signin"
            ? "Sign in"
            : "Create account"}
      </button>
      <p className="text-sm text-stone-600">
        {mode === "signin" ? "No account yet? " : "Already have an account? "}
        <Link
          className="font-semibold text-emerald-800 underline-offset-4 hover:underline"
          href={mode === "signin" ? "/signup" : "/signin"}
        >
          {mode === "signin" ? "Create one" : "Sign in"}
        </Link>
      </p>
    </form>
  );
}
