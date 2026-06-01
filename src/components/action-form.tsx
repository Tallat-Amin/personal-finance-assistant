"use client";

import { useActionState } from "react";

type ActionFormProps = {
  action: (
    state: { message?: string; error?: string },
    formData: FormData,
  ) => Promise<{
    message?: string;
    error?: string;
  }>;
  children: React.ReactNode;
  submitLabel: string;
};

export function ActionForm({ action, children, submitLabel }: ActionFormProps) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction} className="grid gap-3">
      {children}
      {state.message ? (
        <p className="text-sm text-emerald-800">{state.message}</p>
      ) : null}
      {state.error ? (
        <p className="text-sm text-red-700">{state.error}</p>
      ) : null}
      <button
        className="h-10 rounded-md bg-stone-950 px-4 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:opacity-60"
        disabled={pending}
        type="submit"
      >
        {pending ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}
