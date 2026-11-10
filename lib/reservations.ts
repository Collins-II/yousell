import "server-only";
import { randomBytes } from "node:crypto";
import { connectDb } from "./db";
import { Conversation, Message, Payment, Reservation, User } from "./models";
import { getProvider, PENDING_TIMEOUT_MS, type Outcome } from "./payments";

export type Kind = "property" | "car";
export type ReservationStatus = "pending_payment" | "held" | "confirmed" | "completed" | "cancelled" | "declined" | "expired";

export const HOLD_MS = 10 * 60_000;

// Mobile money settles in kwacha, so listing prices in other currencies are converted for the fee only.
const FX_TO_ZMW: Record<string, number> = {
  ZMW: 1,
  USD: Number(process.env.FX_USD_ZMW) || 27,
  EUR: Number(process.env.FX_EUR_ZMW) || 29,
  GBP: Number(process.env.FX_GBP_ZMW) || 34,
};

export const FEE_RULES = {
  sale: { rate: 0.015, label: "1.5% of the sale price" },
  rent: { rate: 0.1, label: "10% of one month's rent" },
  min: 50,
  max: 5000,
} as const;

export function computeFee(price: number, currency: string, type: "sale" | "rent") {
  const fx = FX_TO_ZMW[currency];
  if (!fx || !(price > 0)) return null;
  const raw = price * fx * FEE_RULES[type].rate;
  return { amount: Math.min(FEE_RULES.max, Math.max(FEE_RULES.min, Math.ceil(raw))), currency: "ZMW" as const, basis: FEE_RULES[type].label };
}

export const newReference = () => `YS-${randomBytes(5).toString("hex").toUpperCase()}`;

export async function isAgent(userId: string) {
  await connectDb();
  const u = await User.findById(userId).select("role").lean<{ role?: string }>();
  return u?.role === "agent";
}

/** A buyer may only talk to a seller once the reservation fee for that listing has been paid and not refunded. */
export async function hasPaidReservation(buyerId: string, kind: Kind, listingId: string) {
  await connectDb();
  return Boolean(await Reservation.exists({ buyerId, kind, listingId, status: { $in: ["held", "confirmed", "completed"] } }));
}

/** Releases holds whose payment window has passed so the listing becomes reservable again. */
export async function expireStale(filter: Record<string, unknown> = {}) {
  await connectDb();
  const now = new Date();
  await Reservation.updateMany(
    { status: "pending_payment", holdExpiresAt: { $lte: now }, ...filter },
    { $set: { status: "expired", active: false }, $push: { history: { at: now, event: "expired", by: "system", note: "Payment window closed" } } },
  );
}

export type ReservationView = {
  id: string;
  reference: string;
  kind: Kind;
  listingId: string;
  href: string;
  listingTitle: string;
  listingImage: string | null;
  type: "sale" | "rent";
  status: ReservationStatus;
  feeAmount: number;
  feeCurrency: string;
  buyerId: string;
  buyerName: string;
  sellerId: string;
  sellerName: string;
  holdExpiresAt: string | null;
  paidAt: string | null;
  createdAt: string;
  history: { at: string; event: string; by: string; note: string }[];
  paymentStatus: string | null;
};

type Doc = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function toView(d: Doc, paymentStatus: string | null): ReservationView {
  return {
    id: String(d._id),
    reference: d.reference,
    kind: d.kind,
    listingId: String(d.listingId),
    href: `/${d.kind === "property" ? "properties" : "cars"}/${d.listingId}`,
    listingTitle: d.listingTitle ?? "Listing",
    listingImage: d.listingImage || null,
    type: d.type,
    status: d.status,
    feeAmount: d.feeAmount,
    feeCurrency: d.feeCurrency ?? "ZMW",
    buyerId: String(d.buyerId),
    buyerName: d.buyerName ?? "Buyer",
    sellerId: String(d.sellerId),
    sellerName: d.sellerName ?? "Seller",
    holdExpiresAt: d.holdExpiresAt ? new Date(d.holdExpiresAt).toISOString() : null,
    paidAt: d.paidAt ? new Date(d.paidAt).toISOString() : null,
    createdAt: new Date(d.createdAt).toISOString(),
    history: (d.history ?? []).map((h: Doc) => ({ at: new Date(h.at).toISOString(), event: h.event ?? "", by: h.by ?? "", note: h.note ?? "" })),
    paymentStatus,
  };
}

async function withPayments(docs: Doc[]) {
  const ids = docs.map((d) => d.paymentId).filter(Boolean);
  const payments = ids.length ? await Payment.find({ _id: { $in: ids } }).select("status").lean<{ _id: unknown; status: string }[]>() : [];
  const byId = new Map(payments.map((p) => [String(p._id), p.status]));
  return docs.map((d) => toView(d, d.paymentId ? byId.get(String(d.paymentId)) ?? null : null));
}

export async function getReservationLists(userId: string, agent: boolean) {
  await connectDb();
  await expireStale();
  const visible = { status: { $ne: "expired" } };
  const [mine, incoming, all] = await Promise.all([
    Reservation.find({ buyerId: userId, ...visible }).sort({ createdAt: -1 }).limit(100).lean<Doc[]>(),
    Reservation.find({ sellerId: userId, ...visible, status: { $nin: ["expired", "pending_payment"] } }).sort({ createdAt: -1 }).limit(100).lean<Doc[]>(),
    agent ? Reservation.find({}).sort({ createdAt: -1 }).limit(200).lean<Doc[]>() : Promise.resolve([] as Doc[]),
  ]);
  const [m, i, a] = await Promise.all([withPayments(mine), withPayments(incoming), withPayments(all)]);
  return { mine: m, incoming: i, all: a };
}

export async function getActiveReservation(kind: Kind, listingId: string) {
  await connectDb();
  await expireStale({ listingId });
  const r = await Reservation.findOne({ kind, listingId, active: true }).select("status buyerId reference holdExpiresAt").lean<Doc>();
  return r ? { status: r.status as ReservationStatus, buyerId: String(r.buyerId), reference: r.reference as string, id: String(r._id) } : null;
}

/** Number of reservations waiting on this user (sellers: paid and unanswered; agents: all paid and unanswered). */
export async function getPendingReservationCount(userId: string, agent: boolean) {
  await connectDb();
  return Reservation.countDocuments(agent ? { status: "held" } : { sellerId: userId, status: "held" });
}

/** Posts a line into the buyer/seller conversation so the whole deal stays in one thread. */
export async function postReservationMessage(r: Doc, senderId: string, text: string) {
  const filter = { kind: r.kind, listingId: r.listingId, buyerId: r.buyerId };
  const conv = await Conversation.findOneAndUpdate(
    filter,
    {
      $setOnInsert: {
        ...filter,
        sellerId: r.sellerId,
        sellerName: r.sellerName ?? "Seller",
        buyerName: r.buyerName ?? "Buyer",
        listingTitle: r.listingTitle ?? "Listing",
        listingImage: r.listingImage ?? "",
      },
    },
    { upsert: true, returnDocument: "after" },
  );
  const body = `[${r.reference}] ${text}`.slice(0, 2000);
  const msg = await Message.create({ conversationId: conv._id, senderId, body });
  const otherUnread = String(senderId) === String(r.buyerId) ? "sellerUnread" : "buyerUnread";
  await Conversation.updateOne({ _id: conv._id }, { $set: { lastMessage: body.slice(0, 140), lastMessageAt: msg.createdAt }, $inc: { [otherUnread]: 1 } });
}

export async function refundPayment(paymentId: unknown, reason: string) {
  const payment = await Payment.findOne({ _id: paymentId, status: "succeeded" }).lean<Doc>();
  if (!payment) return false;
  await getProvider().refund({ providerRef: payment.providerRef, amount: payment.amount, currency: payment.currency });
  const res = await Payment.updateOne({ _id: paymentId, status: "succeeded" }, { $set: { status: "refunded", refundedAt: new Date(), refundReason: reason } });
  return res.modifiedCount > 0;
}

/** Pulls the provider result for an owner's payment and settles it. Not a server action: callers must pass the verified user id. */
export async function refreshPayment(paymentId: string, userId: string) {
  await connectDb();
  const payment = await Payment.findOne({ _id: paymentId, userId }).lean<Doc>();
  if (!payment) return null;
  if (payment.status === "pending") {
    if (Date.now() - new Date(payment.createdAt).getTime() > PENDING_TIMEOUT_MS) {
      await settlePayment(paymentId, { status: "expired", reason: "The payment request timed out." });
    } else {
      try {
        await settlePayment(paymentId, await getProvider().poll({ providerRef: payment.providerRef, createdAt: payment.createdAt }));
      } catch {
        /* transient provider error: keep polling */
      }
    }
  }
  const fresh = await Payment.findById(paymentId).lean<Doc>();
  const reservation = fresh ? await Reservation.findById(fresh.reservationId).select("reference status").lean<Doc>() : null;
  return fresh && reservation
    ? { status: fresh.status as string, reason: (fresh.failureReason as string | undefined) ?? null, amount: fresh.amount as number, currency: fresh.currency as string, reference: reservation.reference as string, reservationStatus: reservation.status as string, reservationId: String(fresh.reservationId) }
    : null;
}

/**
 * The single place where a provider result changes state. Every transition is an atomic
 * compare-and-set, so webhooks, polling and retries can all call it concurrently and only one wins.
 */
export async function settlePayment(paymentId: string, outcome: Outcome) {
  if (outcome.status === "pending") return;
  await connectDb();
  const now = new Date();
  const payment = await Payment.findOneAndUpdate(
    { _id: paymentId, status: "pending" },
    { $set: { status: outcome.status, settledAt: now, ...(outcome.status !== "succeeded" ? { failureReason: outcome.reason } : {}) } },
    { returnDocument: "after" },
  ).lean<Doc>();
  if (!payment) return;

  if (outcome.status !== "succeeded") {
    await Reservation.updateOne(
      { _id: payment.reservationId, status: "pending_payment" },
      { $push: { history: { at: now, event: "payment_failed", by: "system", note: outcome.reason } } },
    );
    return;
  }

  const reservation = await Reservation.findOneAndUpdate(
    { _id: payment.reservationId, active: true, status: "pending_payment" },
    {
      $set: { status: "held", paidAt: now, paymentId: payment._id },
      $unset: { holdExpiresAt: 1 },
      $push: { history: { at: now, event: "paid", by: "system", note: `${payment.network.toUpperCase()} ${payment.msisdnMasked ?? ""}`.trim() } },
    },
    { returnDocument: "after" },
  ).lean<Doc>();

  if (!reservation) {
    // Paid after the hold lapsed: never keep money for a reservation we can't honour.
    await refundPayment(payment._id, "Reservation was no longer available when payment completed").catch(() => {});
    return;
  }
  await postReservationMessage(reservation, String(reservation.buyerId), `I've paid the K${payment.amount.toLocaleString("en-US")} reservation fee for ${reservation.listingTitle}. Please confirm the next step.`).catch((error) => {
    console.error("[messages] Unable to post payment confirmation", error);
  });
}
