import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDb } from "@/lib/db";
import { Payment } from "@/lib/models";
import { verifyWebhookSignature } from "@/lib/payments";
import { settlePayment } from "@/lib/reservations";

const bodySchema = z.object({
  providerRef: z.string().min(1).max(100),
  status: z.enum(["succeeded", "failed"]),
  amount: z.number().positive(),
  reason: z.string().max(200).optional(),
});

export async function POST(req: Request) {
  const raw = await req.text();
  if (raw.length > 10_000 || !verifyWebhookSignature(raw, req.headers.get("x-signature"))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }
  let parsed;
  try {
    parsed = bodySchema.safeParse(JSON.parse(raw));
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  if (!parsed.success) return NextResponse.json({ error: "Bad request" }, { status: 400 });
  const { providerRef, status, amount, reason } = parsed.data;

  await connectDb();
  const payment = await Payment.findOne({ providerRef }).select("amount").lean<{ _id: unknown; amount: number }>();
  if (!payment) return NextResponse.json({ error: "Unknown payment" }, { status: 404 });
  // Never mark a payment paid for less than the fee we asked for.
  if (status === "succeeded" && amount < payment.amount) return NextResponse.json({ error: "Amount mismatch" }, { status: 422 });

  await settlePayment(String(payment._id), status === "succeeded" ? { status } : { status, reason: reason ?? "Payment failed" });
  return NextResponse.json({ ok: true });
}
