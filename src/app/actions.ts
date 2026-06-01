"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { z } from "zod";
import { signIn, signOut } from "@/auth";
import { requireUserId } from "@/lib/auth-guard";
import { parseTransactionsCsv } from "@/lib/csv";
import { dollarsToCents, normalizeMerchant } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { extractReceipt } from "@/lib/receipt-ocr";

type ActionState = {
  message?: string;
  error?: string;
};

const credentialsSchema = z.object({
  name: z.string().trim().min(2).optional().or(z.literal("")),
  email: z.email().trim().toLowerCase(),
  password: z.string().min(8),
});

export async function registerAction(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = credentialsSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return {
      error: "Use a valid email and a password with at least 8 characters.",
    };
  }

  const existing = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });
  if (existing) {
    return { error: "An account with this email already exists." };
  }

  await prisma.user.create({
    data: {
      name: parsed.data.name || parsed.data.email.split("@")[0],
      email: parsed.data.email,
      hashedPassword: await bcrypt.hash(parsed.data.password, 12),
    },
  });

  await signIn("credentials", {
    email: parsed.data.email,
    password: parsed.data.password,
    redirectTo: "/dashboard",
  });
  return { message: "Account created." };
}

export async function signInAction(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Invalid email or password." };
    }
    throw error;
  }
  return { message: "Signed in." };
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}

export async function importCsvAction(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId();
  const csvFile = formData.get("csvFile");
  const csv =
    csvFile instanceof File && csvFile.size > 0
      ? await csvFile.text()
      : String(formData.get("csv") ?? "");
  const parsed = parseTransactionsCsv(csv);

  let inserted = 0;
  let duplicates = 0;
  for (const tx of parsed.validRows) {
    const existing = await prisma.transaction.findUnique({
      where: {
        userId_normalizedHash: { userId, normalizedHash: tx.normalizedHash },
      },
    });
    if (existing) {
      duplicates += 1;
      continue;
    }
    await prisma.transaction.create({ data: { ...tx, userId } });
    inserted += 1;
  }

  await prisma.csvImport.create({
    data: {
      userId,
      fileName:
        csvFile instanceof File && csvFile.size > 0 ? csvFile.name : undefined,
      totalRows: parsed.validRows.length + parsed.rejectedRows.length,
      insertedRows: inserted,
      duplicateRows: duplicates,
      rejectedRows: parsed.rejectedRows.length,
      rejectedJson: parsed.rejectedRows.length
        ? JSON.stringify(parsed.rejectedRows.slice(0, 20))
        : undefined,
    },
  });

  revalidatePath("/dashboard");
  return {
    message: `Imported ${inserted} new transactions. Skipped ${duplicates} duplicates and rejected ${parsed.rejectedRows.length} messy rows.`,
  };
}

export async function budgetAction(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId();
  const category = String(formData.get("category") ?? "").trim();
  const monthlyCents = dollarsToCents(String(formData.get("amount") ?? ""));
  if (!category || monthlyCents <= 0) {
    return { error: "Choose a category and a positive monthly amount." };
  }

  await prisma.budget.upsert({
    where: { userId_category: { userId, category } },
    create: { userId, category, monthlyCents },
    update: { monthlyCents },
  });
  revalidatePath("/dashboard");
  return { message: `Budget saved for ${category}.` };
}

export async function receiptAction(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId();
  const file = formData.get("receipt");
  const merchant = String(formData.get("merchant") ?? "").trim();
  const amountCents = dollarsToCents(String(formData.get("amount") ?? ""));
  const category =
    String(formData.get("category") ?? "General").trim() || "General";
  const rawDate = String(formData.get("date") ?? "").trim();
  const postedAt = rawDate ? new Date(rawDate) : undefined;

  if (!(file instanceof File) || !file.name) {
    return { error: "Upload a receipt image." };
  }

  const ocr = await extractReceipt(file);
  const finalMerchant = merchant || ocr.merchant || "";
  const finalAmountCents =
    amountCents > 0 ? amountCents : (ocr.amountCents ?? 0);
  const finalPostedAt =
    postedAt && !Number.isNaN(postedAt.getTime())
      ? postedAt
      : (ocr.postedAt ?? new Date());
  const finalCategory =
    category !== "General" ? category : (ocr.category ?? category);

  if (
    !finalMerchant ||
    finalAmountCents <= 0 ||
    Number.isNaN(finalPostedAt.getTime())
  ) {
    await prisma.receipt.create({
      data: {
        userId,
        fileName: file.name,
        status: ocr.status === "failed" ? "ocr_failed" : "needs_review",
        ocrText: ocr.text,
        ocrConfidence: ocr.confidence,
        extractedJson: JSON.stringify({
          merchant: ocr.merchant,
          amountCents: ocr.amountCents,
          category: ocr.category,
          postedAt: ocr.postedAt,
        }),
        notes: ocr.note,
      },
    });
    revalidatePath("/dashboard");
    return {
      message:
        "Receipt OCR completed but needs review. Add merchant, date, and amount to record it as an expense.",
    };
  }

  const normalizedHash = [
    "receipt",
    finalPostedAt.toISOString().slice(0, 10),
    normalizeMerchant(finalMerchant),
    finalAmountCents,
    file.name,
  ].join("|");

  const transaction = await prisma.transaction.upsert({
    where: {
      userId_normalizedHash: { userId, normalizedHash },
    },
    update: {},
    create: {
      userId,
      source: "receipt",
      postedAt: finalPostedAt,
      merchant: finalMerchant,
      category: finalCategory,
      amountCents: -Math.abs(finalAmountCents),
      normalizedHash,
      description: `Receipt upload: ${file.name}`,
    },
  });
  const existingReceiptForTransaction = await prisma.receipt.findUnique({
    where: { transactionId: transaction.id },
  });
  await prisma.receipt.create({
    data: {
      userId,
      fileName: file.name,
      status:
        ocr.status === "extracted" && !merchant ? "ocr_recorded" : "recorded",
      transactionId: existingReceiptForTransaction ? undefined : transaction.id,
      ocrText: ocr.text,
      ocrConfidence: ocr.confidence,
      extractedJson: JSON.stringify({
        merchant: finalMerchant,
        amountCents: finalAmountCents,
        category: finalCategory,
        postedAt: finalPostedAt,
        ocrStatus: ocr.status,
      }),
      notes: ocr.note,
    },
  });

  revalidatePath("/dashboard");
  return {
    message:
      ocr.status === "extracted" && !merchant
        ? "Receipt OCR extracted fields and recorded an expense."
        : "Receipt recorded as an expense.",
  };
}

export async function seedDemoAction() {
  const userId = await requireUserId();
  const now = new Date();
  const demo = [
    ["2026-05-01", "Payroll Deposit", "Income", 420000],
    ["2026-05-02", "Green Basket Market", "Groceries", -9642],
    ["2026-05-03", "Metro Rent", "Housing", -155000],
    ["2026-05-06", "Spotify", "Subscriptions", -1099],
    ["2026-05-08", "Blue Bottle Coffee", "Dining", -1875],
    ["2026-05-13", "Shell Gas", "Transport", -5220],
    ["2026-05-16", "Netflix", "Subscriptions", -1899],
    ["2026-05-22", "City Pharmacy", "Health", -3400],
    ["2026-06-01", "Payroll Deposit", "Income", 420000],
    ["2026-06-02", "Metro Rent", "Housing", -155000],
    ["2026-06-03", "Green Basket Market", "Groceries", -12420],
    ["2026-06-05", "Spotify", "Subscriptions", -1099],
    ["2026-06-07", "Kitchen Social", "Dining", -8460],
    ["2026-06-09", "ElectroHub", "General", -79999],
    ["2026-06-16", "Netflix", "Subscriptions", -1899],
  ] as const;

  for (const [date, merchant, category, amountCents] of demo) {
    const postedAt = new Date(date);
    await prisma.transaction.upsert({
      where: {
        userId_normalizedHash: {
          userId,
          normalizedHash: `demo-${date}-${merchant}-${amountCents}`,
        },
      },
      create: {
        userId,
        source: "demo",
        postedAt: postedAt > now ? now : postedAt,
        merchant,
        category,
        amountCents,
        normalizedHash: `demo-${date}-${merchant}-${amountCents}`,
      },
      update: {},
    });
  }

  await prisma.budget.upsert({
    where: { userId_category: { userId, category: "Dining" } },
    create: { userId, category: "Dining", monthlyCents: 45000 },
    update: { monthlyCents: 45000 },
  });
  revalidatePath("/dashboard");
  redirect("/dashboard");
}
