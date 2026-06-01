"use client";

import { SendHorizontal } from "lucide-react";
import { useState, useTransition } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export function AssistantPanel({ initialSummary }: { initialSummary: string }) {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: initialSummary },
  ]);
  const [input, setInput] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = input.trim();
    if (!message) return;
    setInput("");
    setMessages((items) => [...items, { role: "user", content: message }]);

    startTransition(async () => {
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await response.json();
      setMessages((items) => [
        ...items,
        {
          role: "assistant",
          content:
            data.answer ?? data.error ?? "I could not answer that request.",
        },
      ]);
    });
  }

  return (
    <section className="grid min-h-[520px] grid-rows-[1fr_auto] rounded-md border border-stone-300 bg-[#fbfaf6]">
      <div className="space-y-3 overflow-y-auto p-4">
        {messages.map((message, index) => (
          <div
            className={`max-w-[88%] rounded-md px-3 py-2 text-sm leading-6 ${
              message.role === "assistant"
                ? "border border-stone-200 bg-white text-stone-800"
                : "ml-auto bg-emerald-900 text-white"
            }`}
            key={`${message.role}-${index}-${message.content.slice(0, 12)}`}
          >
            {message.content}
          </div>
        ))}
        {pending ? (
          <div className="max-w-[70%] rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-500">
            Reading your ledger...
          </div>
        ) : null}
      </div>
      <form
        className="flex gap-2 border-t border-stone-300 p-3"
        onSubmit={submit}
      >
        <input
          className="min-w-0 flex-1 rounded-md border border-stone-300 bg-white px-3 text-sm outline-none focus:border-emerald-800"
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask: How much did I spend on groceries last month?"
          value={input}
        />
        <button
          aria-label="Send message"
          className="grid h-10 w-10 place-items-center rounded-md bg-emerald-800 text-white transition hover:bg-emerald-900"
          disabled={pending}
          type="submit"
        >
          <SendHorizontal aria-hidden size={18} />
        </button>
      </form>
    </section>
  );
}
