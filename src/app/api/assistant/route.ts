import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { answerFinanceQuestion } from "@/lib/analytics";
import { prisma } from "@/lib/prisma";

const bodySchema = z.object({
  message: z.string().trim().min(2).max(1000),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Ask a concrete question." },
      { status: 400 },
    );
  }

  await prisma.chatMessage.create({
    data: {
      userId: session.user.id,
      role: "user",
      content: parsed.data.message,
    },
  });

  const response = await answerFinanceQuestion(
    session.user.id,
    parsed.data.message,
  );

  await prisma.chatMessage.create({
    data: {
      userId: session.user.id,
      role: "assistant",
      content: response.answer,
      intent: response.intent,
    },
  });

  return NextResponse.json(response);
}
