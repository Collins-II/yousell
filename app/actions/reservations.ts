"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { connectDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Auction, Car, Payment, Property, Reservation, User, isObjectId } from "@/lib/models";
import { NETWORKS, detectNetwork, maskMsisdn, normalizeMsisdn } from "@/lib/momo";
import { getProvider } from "@/lib/payments";
import { HOLD_MS, computeFee, expireStale, isAgent, newReference, postReservationMessage, refundPayment, settlePayment } from "@/lib/reservations";

type Doc = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

const startSchema = z.object({
  kind: z.enum(["property", "car"]),
  listingId: z.string().refine(isObjectId, "Invalid listing"),
  network: z.enum(["mtn", "airtel", "zamtel"]),
  phone: z.string().trim().min(7).max(25),
  key: z.string().min(16).max(64),
});

const MAX_ATTEMPTS_PER_HOUR = 6;

export async function startReservationPayment(input: z.input<typeof startSchema>): Promise<Result<{ paymentId: string; reservationId: string; amount: number; currency: string; phone: string }>> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Please sign in to reserve." };
  const parsed = startSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request" };
  const { kind, listingId, network, phone, key } = parsed.data;

  const msisdn = normalizeMsisdn(phone);
  if (!msisdn) return { ok: false, error: "Enter a valid Zambian mobile number, for example 097 123 4567." };
  const detected = detectNetwork(msisdn);
  if (detected !== network) {
    return { ok: false, error: detected ? `That number belongs to ${NETWORKS[detected].label}. Choose ${NETWORKS[detected].label} or use a ${NETWORKS[network].label} number.` : "That number isn't on a supported network." };
  }

  await connectDb();

  // Replaying the same attempt (double tap, flaky network) returns the original payment instead of charging twice.
  const replay = await Payment.findOne({ userId: session.id, idempotencyKey: key }).lean<Doc>();
  if (replay) {
    return { ok: true, paymentId: String(replay._id), reservationId: String(replay.reservationId), amount: replay.amount, currency: replay.currency, phone: replay.msisdnMasked ?? maskMsisdn(msisdn) };
  }

  const recent = await Payment.countDocuments({ userId: session.id, createdAt: { $gte: new Date(Date.now() - 3_600_000) } });
  if (recent >= MAX_ATTEMPTS_PER_HOUR) return { ok: false, error: "Too many payment attempts. Please wait a while and try again." };

  let provider;
  try {
    provider = getProvider();
  } catch {
    return { ok: false, error: "Payments are temporarily unavailable." };
  }

  await expireStale({ listingId });
  const listing = await (kind === "property" ? Property : Car).findById(listingId).lean<Doc>();
  if (!listing) return { ok: false, error: "Listing not found." };
  if (!listing.author) return { ok: false, error: "This listing has no seller to reserve with." };
  if (String(listing.author) === session.id) return { ok: false, error: "You can't reserve your own listing." };
  if (["SOLD", "PURCHASED", "RENTED"].includes(String(listing.status ?? "").toUpperCase())) return { ok: false, error: "This listing is no longer available." };
  const liveAuction = await Auction.exists({ kind, listingId, status: "live", endsAt: { $gt: new Date() } });
  if (liveAuction) return { ok: false, error: "This listing is in a live auction. Place a bid instead." };

  const type: "sale" | "rent" = String(listing.listingCategory ?? "").toLowerCase() === "rent" ? "rent" : "sale";
  const price = kind === "property" ? Number.parseFloat(String(listing.price).replace(/[^\d.]/g, "")) : Number(listing.price);
  const fee = computeFee(price, listing.currency ?? "USD", type);
  if (!fee) return { ok: false, error: "This listing can't be reserved online." };

  const now = new Date();
  const holdExpiresAt = new Date(now.getTime() + HOLD_MS);
  let reservation = await Reservation.findOne({ kind, listingId, active: true }).lean<Doc>();
  if (reservation) {
    if (String(reservation.buyerId) !== session.id) return { ok: false, error: "This listing is already reserved or being reserved by someone else." };
    if (reservation.status !== "pending_payment") return { ok: false, error: "You already have an active reservation for this listing." };
    await Reservation.updateOne({ _id: reservation._id }, { $set: { holdExpiresAt, feeAmount: fee.amount } });
  } else {
    try {
      reservation = (
        await Reservation.create({
          reference: newReference(),
          kind,
          listingId,
          listingTitle: listing.title || `${listing.make ?? ""} ${listing.carModel ?? ""}`.trim() || "Listing",
          listingImage: /^(https?:\/\/|\/api\/images\/)/.test(listing.featuredImage ?? "") ? listing.featuredImage : "",
          type,
          buyerId: session.id,
          buyerName: session.name,
          sellerId: listing.author,
          sellerName: (await User.findById(listing.author).select("name").lean<{ name?: string }>())?.name ?? "Seller",
          listingPrice: price,
          listingCurrency: listing.currency ?? "USD",
          feeAmount: fee.amount,
          feeCurrency: fee.currency,
          status: "pending_payment",
          active: true,
          holdExpiresAt,
          history: [{ at: now, event: "created", by: session.name, note: `${type} reservation started` }],
        })
      ).toObject();
    } catch (e) {
      if ((e as { code?: number }).code === 11000) return { ok: false, error: "Someone else just started reserving this listing." };
      throw e;
    }
  }

  await Payment.updateMany({ reservationId: reservation!._id, status: "pending" }, { $set: { status: "expired", failureReason: "Replaced by a new attempt", settledAt: now } });

  const masked = maskMsisdn(msisdn);
  let payment;
  try {
    payment = await Payment.create({ reservationId: reservation!._id, userId: session.id, idempotencyKey: key, provider: provider.name, network, msisdnMasked: masked, amount: fee.amount, currency: fee.currency, status: "pending" });
  } catch (e) {
    if ((e as { code?: number }).code === 11000) return { ok: false, error: "That payment is already being processed." };
    throw e;
  }

  try {
    const { providerRef } = await provider.initiate({ paymentId: String(payment._id), reference: reservation!.reference, amount: fee.amount, currency: fee.currency, msisdn, network });
    await Payment.updateOne({ _id: payment._id }, { $set: { providerRef } });
  } catch {
    await settlePayment(String(payment._id), { status: "failed", reason: "The mobile money provider could not be reached." });
    return { ok: false, error: "We couldn't send the payment request. Please try again." };
  }

  return { ok: true, paymentId: String(payment._id), reservationId: String(reservation!._id), amount: fee.amount, currency: fee.currency, phone: masked };
}

export async function abandonPayment(paymentId: string): Promise<Result> {
  const session = await getSession();
  if (!session || !isObjectId(paymentId)) return { ok: false, error: "Not allowed" };
  await connectDb();
  const p = await Payment.findOne({ _id: paymentId, userId: session.id }).select("_id").lean();
  if (!p) return { ok: false, error: "Payment not found" };
  await settlePayment(paymentId, { status: "failed", reason: "Cancelled by you." });
  return { ok: true };
}

// ---- lifecycle ------------------------------------------------------------

type Session = NonNullable<Awaited<ReturnType<typeof getSession>>>;
type Loaded = { session: Session; r: Doc; role: "buyer" | "seller" | "agent"; agent: boolean; error?: undefined } | { error: string; session?: undefined };

async function load(id: string): Promise<Loaded> {
  const session = await getSession();
  if (!session) return { error: "Please sign in." };
  if (!isObjectId(id)) return { error: "Reservation not found." };
  await connectDb();
  const r = await Reservation.findById(id).lean<Doc>();
  if (!r) return { error: "Reservation not found." };
  const agent = await isAgent(session.id);
  const role = String(r.buyerId) === session.id ? "buyer" : String(r.sellerId) === session.id ? "seller" : agent ? "agent" : null;
  if (!role) return { error: "You don't have access to this reservation." };
  return { session, r, role: role as "buyer" | "seller" | "agent", agent };
}

const entry = (event: string, by: string, note = "") => ({ at: new Date(), event, by, note });
const done = (r: Doc) => {
  revalidatePath("/reservations");
  revalidatePath(r.href ?? `/${r.kind === "property" ? "properties" : "cars"}/${r.listingId}`);
};

async function release(r: Doc, event: "cancelled" | "declined", by: string, note: string): Promise<Result> {
  const moved = await Reservation.findOneAndUpdate(
    { _id: r._id, active: true, status: { $in: ["pending_payment", "held", "confirmed"] } },
    { $set: { status: event, active: false }, $push: { history: entry(event, by, note) } },
    { returnDocument: "after" },
  ).lean<Doc>();
  if (!moved) return { ok: false, error: "This reservation can no longer be changed." };
  await Payment.updateMany({ reservationId: r._id, status: "pending" }, { $set: { status: "expired", failureReason: "Reservation closed", settledAt: new Date() } });
  let refunded = true;
  if (moved.paymentId) refunded = await refundPayment(moved.paymentId, `Reservation ${event}`).catch(() => false);
  if (!refunded) await Reservation.updateOne({ _id: r._id }, { $push: { history: entry("refund_failed", "system", "Refund needs an agent to retry") } });
  await postReservationMessage(moved, String(event === "cancelled" ? moved.buyerId : moved.sellerId), `Reservation ${event}${note ? `: ${note}` : ""}. ${refunded ? "The fee has been refunded." : "The refund is being processed."}`).catch((error) => {
    console.error("[messages] Unable to post reservation update", error);
  });
  done(moved);
  return refunded ? { ok: true } : { ok: false, error: "Closed, but the refund needs an agent to retry it." };
}

export async function confirmReservation(id: string): Promise<Result> {
  const c = await load(id);
  if (!c.session) return { ok: false, error: c.error };
  if (c.role === "buyer") return { ok: false, error: "Only the seller or an agent can confirm." };
  const moved = await Reservation.findOneAndUpdate(
    { _id: id, status: "held" },
    { $set: { status: "confirmed" }, $push: { history: entry("confirmed", c.session.name, c.role === "agent" ? "Confirmed by agent" : "Confirmed by seller") } },
    { returnDocument: "after" },
  ).lean<Doc>();
  if (!moved) return { ok: false, error: "Only paid reservations awaiting confirmation can be confirmed." };
  await postReservationMessage(moved, c.session.id, "Reservation confirmed. Let's arrange the viewing and handover here.").catch((error) => {
    console.error("[messages] Unable to post reservation confirmation", error);
  });
  done(moved);
  return { ok: true };
}

export async function declineReservation(id: string, note = ""): Promise<Result> {
  const c = await load(id);
  if (!c.session) return { ok: false, error: c.error };
  if (c.role === "buyer") return { ok: false, error: "Buyers can cancel instead." };
  return release(c.r, "declined", c.session.name, note.slice(0, 200));
}

export async function cancelReservation(id: string): Promise<Result> {
  const c = await load(id);
  if (!c.session) return { ok: false, error: c.error };
  if (c.role === "buyer" && c.r.status === "confirmed") return { ok: false, error: "The seller already confirmed. Message them or contact an agent to cancel." };
  if (c.role === "seller") return { ok: false, error: "Sellers can decline instead." };
  return release(c.r, "cancelled", c.session.name, c.role === "agent" ? "Cancelled by agent" : "Cancelled by buyer");
}

export async function completeReservation(id: string): Promise<Result> {
  const c = await load(id);
  if (!c.session) return { ok: false, error: c.error };
  if (c.role === "buyer") return { ok: false, error: "Only the seller or an agent can close the deal." };
  const moved = await Reservation.findOneAndUpdate(
    { _id: id, status: "confirmed", active: true },
    { $set: { status: "completed", active: false }, $push: { history: entry("completed", c.session.name, "Deal closed") } },
    { returnDocument: "after" },
  ).lean<Doc>();
  if (!moved) return { ok: false, error: "Only confirmed reservations can be closed." };
  const status = moved.type === "rent" ? "RENTED" : "SOLD";
  await (moved.kind === "property" ? Property : Car).updateOne({ _id: moved.listingId }, { $set: { status } });
  await postReservationMessage(moved, c.session.id, "Deal closed. Thank you for using YouSell.").catch((error) => {
    console.error("[messages] Unable to post deal completion", error);
  });
  done(moved);
  return { ok: true };
}

export async function retryRefund(id: string): Promise<Result> {
  const c = await load(id);
  if (!c.session) return { ok: false, error: c.error };
  if (!c.agent) return { ok: false, error: "Only agents can retry refunds." };
  if (!["cancelled", "declined"].includes(c.r.status) || !c.r.paymentId) return { ok: false, error: "Nothing to refund." };
  const ok = await refundPayment(c.r.paymentId, `Reservation ${c.r.status}`).catch(() => false);
  if (ok) await Reservation.updateOne({ _id: id }, { $push: { history: entry("refunded", c.session.name, "Refund retried by agent") } });
  done(c.r);
  return ok ? { ok: true } : { ok: false, error: "The refund still failed. Try again shortly." };
}
