import type { Metadata } from "next";
import Link from "next/link";
import { Car, Crown, Gavel, Home, MessageCircle, Pencil, Plus, CheckCircle2, ExternalLink } from "lucide-react";
import { DeleteButton } from "@/components/delete-button";
import { EmptyState } from "@/components/listing-card";
import { requireSession } from "@/lib/auth";
import { getPlan } from "@/lib/billing";
import { timeLeft } from "@/lib/format";
import { Price } from "@/components/price";
import { getMyListings } from "@/lib/listings";
import { openPortal, startCheckout } from "@/app/actions/billing";

export const metadata: Metadata = { title: "Dashboard" };

export default async function Page({ searchParams }: { searchParams: Promise<{ upgraded?: string }> }) {
  const session = await requireSession("/dashboard");
  const [{ upgraded }, plan, listings] = await Promise.all([searchParams, getPlan(session.id), getMyListings(session.id)]);
  const pct = plan.limit ? Math.min(100, Math.round((plan.used / plan.limit) * 100)) : 100;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1 className="dot-title text-[29px] font-semibold tracking-tight">Hello, {session.name.split(" ")[0] || "there"}</h1>
        </div>
        <div className="flex gap-2">
          <Link href="/messages" className="btn-ghost"><MessageCircle className="size-4" /> Messages</Link>
          <Link href="/sell" className="btn-primary"><Plus className="size-4" /> New listing</Link>
        </div>
      </div>

      {upgraded && (
        <p className="mb-6 flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="size-4" /> Thanks for upgrading! Your Pro benefits activate as soon as Stripe confirms the payment.
        </p>
      )}

      <section className="card mb-10 grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-center">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <span className={`grid size-10 place-items-center rounded-xl ${plan.isPro ? "bg-amber-500/15 text-amber-600" : "bg-indigo-500/10 text-indigo-600"}`}><Crown className="size-5" /></span>
            <div>
              <h2 className="font-display text-xl font-semibold">{plan.isPro ? "YouSell Pro" : "Free plan"}</h2>
              <p className="text-sm text-muted">
                {plan.isPro
                  ? plan.cancelAtPeriodEnd && plan.currentPeriodEnd
                    ? `Cancels on ${new Date(plan.currentPeriodEnd).toLocaleDateString("en-US", { dateStyle: "medium" })}`
                    : plan.currentPeriodEnd ? `Renews on ${new Date(plan.currentPeriodEnd).toLocaleDateString("en-US", { dateStyle: "medium" })}` : "Active"
                  : `${plan.used} of ${plan.limit} listings used`}
              </p>
            </div>
          </div>
          {!plan.isPro && (
            <div className="h-2 max-w-md overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-indigo-600" style={{ width: `${pct}%` }} />
            </div>
          )}
        </div>
        {plan.isPro || plan.hasCustomer ? (
          <form action={openPortal}><button className="btn-ghost">Manage billing <ExternalLink className="size-4" /></button></form>
        ) : (
          <form action={startCheckout}><button className="btn-primary">Upgrade to Pro</button></form>
        )}
      </section>

      <h2 className="mb-4 font-display text-2xl font-semibold">Your listings</h2>
      {listings.length === 0 ? (
        <EmptyState title="No listings yet" hint="Create your first listing — it only takes a minute." href="/sell" cta="Create a listing" />
      ) : (
        <div className="card divide-y divide-line overflow-hidden">
          {listings.map((l) => {
            const href = `/${l.kind === "property" ? "properties" : "cars"}/${l.id}`;
            return (
              <div key={`${l.kind}:${l.id}`} className="flex flex-wrap items-center gap-4 p-4">
                <Link href={href} className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-indigo-500/10">
                  {l.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={l.image} alt="" className="size-full object-cover" />
                  ) : (
                    <span className="grid size-full place-items-center text-indigo-500/60">{l.kind === "property" ? <Home className="size-6" /> : <Car className="size-6" />}</span>
                  )}
                </Link>
                <div className="min-w-0 flex-1 space-y-1">
                  <Link href={href} className="line-clamp-1 font-semibold hover:underline">{l.title}</Link>
                  <p className="text-sm text-muted">
                    {l.auction ? (
                      <>
                        <span className="inline-flex items-center gap-1 font-medium text-amber-600"><Gavel className="size-3.5" /> {l.auction.status === "live" ? `Ends in ${timeLeft(l.auction.endsAt)}` : l.auction.status === "sold" ? "Sold" : "Ended"}</span>
                        {" · "}{l.auction.bidCount} bids · <Price amount={l.auction.bidCount ? l.auction.currentBid : l.auction.startingBid} currency={l.currency} />
                      </>
                    ) : (
                      <><Price amount={l.price} currency={l.currency} /> · For {l.category}</>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`/listings/${l.kind}/${l.id}/edit`} className="btn-ghost !px-3 !py-2"><Pencil className="size-4" /> Edit</Link>
                  <DeleteButton kind={l.kind} id={l.id} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
