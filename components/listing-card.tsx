import Link from "next/link";
import { BedDouble, Bath, Calendar, Fuel, Gauge, Gavel, MapPin, Home, Car, Sparkles } from "lucide-react";
import { timeLeft } from "@/lib/format";
import type { Listing } from "@/lib/listings";
import { FavouriteButton } from "./favourite-button";
import { Price } from "./price";
import { Tr } from "./tr";

export function ListingCard({ listing, saved }: { listing: Listing; saved: boolean }) {
  const href = `/${listing.kind === "property" ? "properties" : "cars"}/${listing.id}`;
  const fact = (label: string) => listing.facts.find((f) => f.label === label)?.value;
  const auction = listing.auction;
  const live = auction?.status === "live";

  const chips =
    listing.kind === "property"
      ? [
          { icon: BedDouble, text: `${fact("Bedrooms")} bd` },
          { icon: Bath, text: `${fact("Bathrooms")} ba` },
        ]
      : [
          { icon: Calendar, text: fact("Year") },
          { icon: Gauge, text: fact("Mileage") },
          { icon: Fuel, text: fact("Fuel") },
        ];

  return (
    <article className="group card relative overflow-hidden transition duration-300 hover:-translate-y-1 hover:border-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/10">
      <Link href={href} className="block">
        <div className="relative aspect-square overflow-hidden sm:aspect-[4/3] bg-gradient-to-br from-indigo-500/15 to-violet-500/15">
          {listing.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={listing.image} alt={listing.title} loading="lazy" className="size-full object-cover transition duration-700 group-hover:scale-105" />
          ) : (
            <div className="grid size-full place-items-center text-indigo-500/50">
              {listing.kind === "property" ? <Home className="size-12" /> : <Car className="size-12" />}
            </div>
          )}
          <div aria-hidden className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/40 to-transparent" />
          <span className="badge absolute left-2 top-2 bg-white/90 !px-1.5 !py-0.5 !text-[9px] sm:left-3 sm:top-3 sm:!px-2.5 sm:!py-1 sm:!text-[11px] text-slate-800 backdrop-blur dark:bg-slate-900/80 dark:text-slate-100">
            {auction ? <Tr k="forAuction" /> : <Tr k={listing.category === "Rent" ? "forRent" : "forSale"} />}
          </span>
          <div className="absolute bottom-2 left-2 flex flex-wrap gap-1 text-[9px] sm:bottom-3 sm:left-3 sm:gap-1.5 sm:text-xs">
            {listing.featured && (
              <span className="badge bg-indigo-600 text-white"><Sparkles className="size-3" /> <Tr k="featured" /></span>
            )}
            {live && (
              <span className="badge bg-amber-500 text-white"><Gavel className="size-3" /> {timeLeft(auction.endsAt)}</span>
            )}
            {auction && !live && <span className="badge bg-slate-800 text-white">{auction.status === "sold" ? "Sold" : "Ended"}</span>}
            {listing.reserved && <span className="badge bg-emerald-600 text-white"><Tr k="reserved" /></span>}
          </div>
        </div>
        <div className="space-y-1 p-2.5 sm:space-y-2 sm:p-4">
          <div className="flex items-baseline justify-between gap-2">
            <p className="font-display text-sm font-semibold tracking-tight sm:text-xl">
              <Price amount={auction && auction.bidCount > 0 ? auction.currentBid : listing.price} currency={listing.currency} />
              {listing.category === "Rent" && !auction && <span className="font-sans text-xs font-medium text-muted"> /mo</span>}
            </p>
            {auction && <span className="hidden text-xs font-medium text-muted sm:inline">{auction.bidCount > 0 ? `${auction.bidCount} bid${auction.bidCount > 1 ? "s" : ""}` : "Starting bid"}</span>}
          </div>
          <h3 className="line-clamp-1 text-xs font-semibold sm:text-base">{listing.title}</h3>
          {listing.location && (
            <p className="flex items-center gap-1 text-[11px] text-muted sm:text-sm">
              <MapPin className="size-3.5 shrink-0" />
              <span className="line-clamp-1">{listing.location}</span>
            </p>
          )}
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 border-t border-line pt-2 text-[11px] text-muted sm:gap-x-4 sm:pt-3 sm:text-sm">
            {chips.map(({ icon: Icon, text }) => (
              <span key={text} className="inline-flex items-center gap-1.5">
                <Icon className="size-3 sm:size-4" /> {text}
              </span>
            ))}
          </div>
        </div>
      </Link>
      <FavouriteButton kind={listing.kind} id={listing.id} initial={saved} className="absolute right-1.5 top-1.5 scale-90 sm:right-3 sm:top-3 sm:scale-100" />
    </article>
  );
}

export function EmptyState({ title, hint, href, cta }: { title: string; hint: string; href?: string; cta?: string }) {
  return (
    <div className="card flex flex-col items-center gap-3 border-dashed px-6 py-16 text-center">
      <h3 className="font-display text-xl font-semibold">{title}</h3>
      <p className="max-w-sm text-sm text-muted">{hint}</p>
      {href && cta && (
        <Link href={href} className="btn-primary mt-2">
          {cta}
        </Link>
      )}
    </div>
  );
}
