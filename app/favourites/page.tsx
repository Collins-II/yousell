import type { Metadata } from "next";
import { EmptyState, ListingCard } from "@/components/listing-card";
import { requireSession } from "@/lib/auth";
import { getFavouriteListings } from "@/lib/listings";

export const metadata: Metadata = { title: "Favourites" };

export default async function Page() {
  const session = await requireSession("/favourites");
  const items = await getFavouriteListings(session.id);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <h1 className="dot-title mb-8 text-[29px] font-semibold tracking-tight">Your favourites</h1>
      {items.length === 0 ? (
        <EmptyState title="Nothing saved yet" hint="Tap the heart on any listing to keep it here." href="/properties" cta="Browse properties" />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((l) => (
            <ListingCard key={`${l.kind}:${l.id}`} listing={l} saved />
          ))}
        </div>
      )}
    </div>
  );
}
