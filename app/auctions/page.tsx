import type { Metadata } from "next";
import Link from "next/link";
import { Gavel } from "lucide-react";
import { EmptyState, ListingCard } from "@/components/listing-card";
import { getSession } from "@/lib/auth";
import { getFavouriteKeys, getLiveAuctions } from "@/lib/listings";

export const metadata: Metadata = { title: "Live auctions" };

export default async function Page() {
  const session = await getSession();
  const [items, favourites] = await Promise.all([getLiveAuctions(), getFavouriteKeys(session?.id)]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow flex items-center gap-1.5"><Gavel className="size-3.5" /> Auctions</p>
          <h1 className="dot-title text-[29px] font-semibold tracking-tight">Live auctions</h1>
          <p className="mt-1 text-muted">{items.length} {items.length === 1 ? "auction" : "auctions"} ending soonest first</p>
        </div>
        <Link href="/sell" className="btn-ghost">Start an auction</Link>
      </div>
      {items.length === 0 ? (
        <EmptyState title="No live auctions right now" hint="Check back soon, or list something yourself and choose the auction sale type." href="/sell" cta="Start an auction" />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((l) => <ListingCard key={`${l.kind}:${l.id}`} listing={l} saved={favourites.has(`${l.kind}:${l.id}`)} />)}
        </div>
      )}
    </div>
  );
}
