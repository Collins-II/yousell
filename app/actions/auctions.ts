"use server";

import { revalidatePath } from "next/cache";
import { connectDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Auction, Bid, isObjectId } from "@/lib/models";
import { ANTI_SNIPE_MS, getAuctionById, minimumBid, type AuctionInfo } from "@/lib/auctions";

export type BidResult = { ok: true; auction: AuctionInfo } | { ok: false; error: string };

export async function placeBid(auctionId: string, amount: number): Promise<BidResult> {
  const session = await getSession();
  if (!session) return { ok: false, error: "auth" };
  if (!isObjectId(auctionId) || !Number.isFinite(amount) || amount <= 0 || amount > 1_000_000_000) return { ok: false, error: "Enter a valid bid" };
  amount = Math.round(amount * 100) / 100;

  await connectDb();
  const now = new Date();
  // One conditional update enforces every rule atomically, so concurrent bids can't both win
  const updated = await Auction.findOneAndUpdate(
    {
      _id: auctionId,
      status: "live",
      endsAt: { $gt: now },
      sellerId: { $ne: session.id },
      highBidderId: { $ne: session.id },
      $or: [
        { bidCount: 0, startingBid: { $lte: amount } },
        { bidCount: { $gt: 0 }, $expr: { $gte: [amount, { $add: ["$currentBid", "$minIncrement"] }] } },
      ],
    },
    [
      {
        $set: {
          currentBid: amount,
          highBidderId: { $toObjectId: session.id },
          bidCount: { $add: ["$bidCount", 1] },
          endsAt: {
            $cond: [{ $lte: ["$endsAt", new Date(now.getTime() + ANTI_SNIPE_MS)] }, { $add: ["$endsAt", ANTI_SNIPE_MS] }, "$endsAt"],
          },
        },
      },
    ],
    { returnDocument: "after", updatePipeline: true },
  );

  if (!updated) {
    const current = await getAuctionById(auctionId);
    if (!current) return { ok: false, error: "Auction not found" };
    if (current.sellerId === session.id) return { ok: false, error: "You can't bid on your own listing" };
    if (current.status !== "live" || new Date(current.endsAt) <= now) return { ok: false, error: "This auction has ended" };
    if (current.highBidderId === session.id) return { ok: false, error: "You're already the highest bidder" };
    return { ok: false, error: `Bid must be at least ${minimumBid(current).toLocaleString("en-US")}` };
  }

  await Bid.create({ auctionId, bidderId: session.id, bidderName: session.name, amount });
  const info = await getAuctionById(auctionId);
  revalidatePath(`/${updated.kind === "property" ? "properties" : "cars"}/${updated.listingId}`);
  return { ok: true, auction: info! };
}
