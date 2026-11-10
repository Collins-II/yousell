import Link from "next/link";
import { ChevronLeft, MapPin, Check, Pencil, Sparkles, BadgeCheck, Lock, UserRound } from "lucide-react";
import { getSession } from "@/lib/auth";
import { getBids } from "@/lib/auctions";
import { isSandbox } from "@/lib/payments";
import { computeFee, getActiveReservation, hasPaidReservation } from "@/lib/reservations";
import { getT } from "@/lib/prefs";
import { Price } from "./price";
import { ReserveDialog } from "./reserve-dialog";
import { StartConversation } from "./start-conversation";
import { getFavouriteKeys, type Listing } from "@/lib/listings";
import { AuctionPanel } from "./auction-panel";
import { Comments } from "./comments";
import { DeleteButton } from "./delete-button";
import { FavouriteButton } from "./favourite-button";
import { Gallery } from "./gallery";
import { MapView } from "./map-view";

export async function ListingDetail({ listing, locked = false }: { listing: Listing; locked?: boolean }) {
  const session = await getSession();
  const { t } = await getT();
  const saved = (await getFavouriteKeys(session?.id)).has(`${listing.kind}:${listing.id}`);
  const base = listing.kind === "property" ? "/properties" : "/cars";
  const path = `${base}/${listing.id}`;
  const isOwner = Boolean(session && listing.authorId === session.id);
  const auction = listing.auction;
  const bids = auction ? await getBids(auction.id) : [];

  const active = await getActiveReservation(listing.kind, listing.id);
  const type = listing.category === "Rent" ? "rent" : "sale";
  const fee = computeFee(Number.parseFloat(String(listing.price).replace(/[^\d.]/g, "")), listing.currency, type);
  const liveAuction = auction?.status === "live";
  const canMessage = Boolean(session && !isOwner && (await hasPaidReservation(session.id, listing.kind, listing.id)));
  let reserveBlock: React.ReactNode = null;
  if (active && session && active.buyerId === session.id) {
    reserveBlock = (
      <Link href="/reservations" className="btn-ghost w-full border-emerald-500/40 text-emerald-700 dark:text-emerald-300">
        <BadgeCheck className="size-4" /> {t("yourReservation")} · {active.reference}
      </Link>
    );
  } else if (active && active.status !== "pending_payment") {
    reserveBlock = <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-center text-sm font-medium text-emerald-700 dark:text-emerald-300">{t("reservedByOther")}</p>;
  } else if (active) {
    reserveBlock = <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-center text-sm font-medium text-amber-700 dark:text-amber-300">{t("reservingNow")}</p>;
  } else if (fee && !liveAuction && session) {
    reserveBlock = <ReserveDialog kind={listing.kind} listingId={listing.id} title={listing.title} type={type} fee={fee.amount} basis={fee.basis} sandbox={isSandbox()} />;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <Link href={base} className="mb-6 inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-fg">
        <ChevronLeft className="size-4" /> {t("backTo")} · {listing.kind === "property" ? t("properties") : t("cars")}
      </Link>

      <div className="grid gap-8 lg:grid-cols-[1fr_390px]">
        <div className="space-y-10">
          <Gallery images={listing.images} title={listing.title} />

          <section className="space-y-3">
            <h2 className="text-2xl font-semibold">{listing.kind === "property" ? t("aboutProperty") : t("aboutVehicle")}</h2>
            <p className="whitespace-pre-line leading-relaxed text-muted">{listing.description || "No description provided."}</p>
          </section>

          <section className="space-y-4">
            <h2 className="text-2xl font-semibold">{t("keyDetails")}</h2>
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
              {listing.facts.map((f) => (
                <div key={f.label} className="bg-surface p-4">
                  <dt className="text-xs font-medium uppercase tracking-wider text-muted">{f.label}</dt>
                  <dd className="mt-1 font-semibold">{f.value}</dd>
                </div>
              ))}
            </dl>
          </section>

          {listing.highlights.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-2xl font-semibold">{t("amenities")}</h2>
              <ul className="grid gap-2 sm:grid-cols-2">
                {listing.highlights.map((h) => (
                  <li key={h} className="flex items-center gap-2 text-sm">
                    <Check className="size-4 text-indigo-500" /> {h}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {listing.map && (
            <section className="space-y-3">
              <h2 className="text-2xl font-semibold">{t("location")}</h2>
              <MapView
                single
                className="h-72"
                points={[{ id: listing.id, lat: listing.map.lat, lng: listing.map.lng, label: listing.location || "Here", title: listing.title, subtitle: "", href: path, image: null, auction: Boolean(auction) }]}
              />
            </section>
          )}

          <Comments kind={listing.kind} listingId={listing.id} sellerId={listing.authorId} path={path} />
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          {auction && <AuctionPanel initial={auction} initialBids={bids} userId={session?.id ?? null} path={path} />}

          <div className="card space-y-5 p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <span className="badge bg-indigo-500/10 text-indigo-600 dark:text-indigo-300">{auction ? t("forAuction") : listing.category === "Rent" ? t("forRent") : t("forSale")}</span>
                {listing.featured && <span className="badge bg-amber-500/15 text-amber-700 dark:text-amber-300"><Sparkles className="size-3" /> {t("featured")}</span>}
              </div>
              <FavouriteButton kind={listing.kind} id={listing.id} initial={saved} className="!bg-line/60" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">{listing.title}</h1>
              {listing.location && (
                <p className="mt-1.5 flex items-center gap-1 text-sm text-muted">
                  <MapPin className="size-4" /> {listing.location}
                </p>
              )}
            </div>
            {!auction && (
              <p className="font-display text-4xl font-semibold tracking-tight">
                <Price amount={listing.price} currency={listing.currency} />
                {listing.category === "Rent" && <span className="font-sans text-base font-medium text-muted"> {t("perMonth")}</span>}
              </p>
            )}

            {listing.authorId && (
              <Link href={`/agents/${listing.authorId}`} className="flex items-center gap-2 rounded-lg bg-bg px-3 py-2 text-sm font-medium text-indigo-600 transition hover:bg-indigo-500/10 dark:text-indigo-300">
                <UserRound className="size-4" /> {t("viewSellerProfile")}
              </Link>
            )}

            {isOwner ? (
              <div className="flex flex-wrap gap-2 border-t border-line pt-5">
                <Link href={`/listings/${listing.kind}/${listing.id}/edit`} className="btn-ghost flex-1"><Pencil className="size-4" /> {t("edit")}</Link>
                <DeleteButton kind={listing.kind} id={listing.id} redirectTo="/dashboard" />
              </div>
            ) : session && listing.authorId ? (
              <div className="space-y-2 border-t border-line pt-5">
                {locked && !canMessage && <p role="status" className="rounded-lg bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-700 dark:text-amber-300">{t("lockedBanner")}</p>}
                {reserveBlock}
                {canMessage ? (
                  <StartConversation kind={listing.kind} listingId={listing.id} />
                ) : (
                  <p className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-line px-3 py-2.5 text-center text-xs font-medium text-muted"><Lock className="size-3.5 shrink-0" /> {t("unlockMessaging")}</p>
                )}
              </div>
            ) : !session ? (
              <Link href={`/login?next=${path}`} className="btn-primary w-full">{t("signInToAct")}</Link>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
