import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { Network } from "./momo";

export type Outcome =
  | { status: "pending" }
  | { status: "succeeded" }
  | { status: "failed"; reason: string }
  | { status: "expired"; reason: string };

export interface PaymentProvider {
  name: string;
  sandbox: boolean;
  initiate(input: { paymentId: string; reference: string; amount: number; currency: string; msisdn: string; network: Network }): Promise<{ providerRef: string }>;
  poll(payment: { providerRef?: string | null; createdAt: Date }): Promise<Outcome>;
  refund(payment: { providerRef?: string | null; amount: number; currency: string }): Promise<void>;
}

export const PENDING_TIMEOUT_MS = 3 * 60_000;
const SANDBOX_DELAY_MS = 5_000;

// Simulates the mobile-money "approve on your phone" round trip without calling any network.
// The outcome is derived from the phone number and encoded in the reference, so no number is stored.
//   ...00 -> insufficient funds, ...99 -> customer never approves, anything else -> approved after ~5 s
const sandbox: PaymentProvider = {
  name: "sandbox",
  sandbox: true,
  async initiate({ msisdn }) {
    const tail = msisdn.slice(-2);
    const mode = tail === "00" ? "fail" : tail === "99" ? "timeout" : "ok";
    return { providerRef: `sbx_${mode}_${randomBytes(6).toString("hex")}` };
  },
  async poll({ providerRef, createdAt }) {
    const elapsed = Date.now() - createdAt.getTime();
    if (elapsed < SANDBOX_DELAY_MS) return { status: "pending" };
    if (providerRef?.startsWith("sbx_fail_")) return { status: "failed", reason: "Insufficient funds in the mobile wallet." };
    if (providerRef?.startsWith("sbx_timeout_")) return elapsed > 20_000 ? { status: "expired", reason: "The payment request was not approved in time." } : { status: "pending" };
    return { status: "succeeded" };
  },
  async refund() {},
};

/**
 * Real aggregators (MTN MoMo, Airtel Money, Lenco, DPO, Flutterwave…) plug in here by implementing
 * PaymentProvider and being returned for their PAYMENT_PROVIDER name. Until one is configured,
 * production fails closed instead of silently accepting simulated payments.
 */
export function getProvider(): PaymentProvider {
  const name = process.env.PAYMENT_PROVIDER || "sandbox";
  if (name === "sandbox") {
    if (process.env.NODE_ENV === "production" && process.env.ALLOW_SANDBOX_PAYMENTS !== "true") {
      throw new Error("Payments are not configured. Set PAYMENT_PROVIDER to a live provider.");
    }
    return sandbox;
  }
  throw new Error(`Unknown payment provider "${name}".`);
}

export const isSandbox = () => {
  try {
    return getProvider().sandbox;
  } catch {
    return false;
  }
};

export function verifyWebhookSignature(rawBody: string, signature: string | null) {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest();
  const given = Buffer.from(signature.replace(/^sha256=/, ""), "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}
