import "server-only";
import { connectDb } from "./db";
import { Auction, Bid, Car, Reservation, isObjectId } from "./models";

export type Kind = "property" | "car";

export type AuctionInfo = {
  id: string;
  kind: Kind;
  listingId: string;
  sellerId: string;
  status: "live" | "sold" | "unsold" | "cancelled";
  currency: string;
  startingBid: number;
  currentBid: number;
  minIncrement: number;
  bidCount: number;
  endsAt: string;
  highBidderId: string | null;
  winnerId: string | null;
  reserveMet: boolean;
  hasReserve: boolean;
};

type AuctionDoc = {
  _id: unknown;
  kind: Kind;
  listingId: unknown;
  sellerId: unknown;
  status: AuctionInfo["status"];
  currency?: string;
  startingBid: number;
  reservePrice?: number;
  currentBid?: number;
  minIncrement: number;
  bidCount?: number;
  endsAt: Date;
  highBidderId?: unknown;
  winnerId?: unknown;
};

export const ANTI_SNIPE_MS = 2 * 60_000;

export function toAuctionInfo(a: AuctionDoc): AuctionInfo {
  const current = a.currentBid ?? 0;
  return {
    id: String(a._id),
    kind: a.kind,
    listingId: String(a.listingId),
    sellerId: String(a.sellerId),
    status: a.status,
    currency: a.currency ?? "USD",
    startingBid: a.startingBid,
    currentBid: current,
    minIncrement: a.minIncrement,
    bidCount: a.bidCount ?? 0,
    endsAt: a.endsAt.toISOString(),
    highBidderId: a.highBidderId ? String(a.highBidderId) : null,
    winnerId: a.winnerId ? String(a.winnerId) : null,
    hasReserve: (a.reservePrice ?? 0) > 0,
    reserveMet: !(a.reservePrice ?? 0) || current >= (a.reservePrice ?? 0),
  };
}

export const minimumBid = (a: Pick<AuctionInfo, "bidCount" | "startingBid" | "currentBid" | "minIncrement">) =>
  a.bidCount === 0 ? a.startingBid : a.currentBid + a.minIncrement;

export const suggestIncrement = (start: number) => {
  if (start >= 100_000) return 1000;
  if (start >= 10_000) return 250;
  if (start >= 1_000) return 50;
  return Math.max(1, Math.round(start / 50));
};

// Auctions are settled lazily: whoever reads an expired auction first closes it, atomically.
export async function settleExpired(filter: Record<string, unknown> = {}) {
  const now = new Date();
  const expired = await Auction.find({ status: "live", endsAt: { $lte: now }, ...filter }).limit(50).lean<AuctionDoc[]>();
  for (const a of expired) {
    const reserveMet = !(a.reservePrice ?? 0) || (a.currentBid ?? 0) >= (a.reservePrice ?? 0);
    const sold = (a.bidCount ?? 0) > 0 && reserveMet;
    const res = await Auction.updateOne(
      { _id: a._id, status: "live" },
      { $set: { status: sold ? "sold" : "unsold", ...(sold ? { winnerId: a.highBidderId } : {}) } },
    );
    if (sold && res.modifiedCount && a.kind === "car") await Car.updateOne({ _id: a.listingId }, { $set: { status: "SOLD" } });
  }
}

export async function withAuctions<T extends { id: string; kind: Kind; auction: AuctionInfo | null; reserved?: boolean }>(items: T[]) {
  if (items.length === 0) return items;
  await connectDb();
  const ids = items.map((i) => i.id);
  await settleExpired({ listingId: { $in: ids } });
  const [docs, held] = await Promise.all([
    Auction.find({ listingId: { $in: ids } }).lean<AuctionDoc[]>(),
    Reservation.find({ listingId: { $in: ids }, active: true, status: { $in: ["held", "confirmed"] } }).select("kind listingId").lean<{ kind: Kind; listingId: unknown }[]>(),
  ]);
  const byKey = new Map(docs.map((d) => [`${d.kind}:${String(d.listingId)}`, toAuctionInfo(d)]));
  const reserved = new Set(held.map((h) => `${h.kind}:${String(h.listingId)}`));
  for (const item of items) {
    item.auction = byKey.get(`${item.kind}:${item.id}`) ?? null;
    item.reserved = reserved.has(`${item.kind}:${item.id}`);
  }
  return items;
}

export async function getAuctionById(id: string) {
  if (!isObjectId(id)) return null;
  await connectDb();
  await settleExpired({ _id: id });
  const doc = await Auction.findById(id).lean<AuctionDoc>();
  return doc ? toAuctionInfo(doc) : null;
}

export async function getBids(auctionId: string, limit = 10) {
  await connectDb();
  const bids = await Bid.find({ auctionId }).sort({ amount: -1 }).limit(limit).lean<{ _id: unknown; bidderId: unknown; bidderName?: string; amount: number; createdAt: Date }[]>();
  return bids.map((b) => ({
    id: String(b._id),
    bidder: b.bidderName ? `${b.bidderName.split(" ")[0]}` : "Bidder",
    bidderId: String(b.bidderId),
    amount: b.amount,
    at: b.createdAt.toISOString(),
  }));
}

export type BidView = Awaited<ReturnType<typeof getBids>>[number];
