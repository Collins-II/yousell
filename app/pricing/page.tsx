import type { Metadata } from "next";
import Link from "next/link";
import { Check, Crown, Sparkles } from "lucide-react";
import { getSession } from "@/lib/auth";
import { FREE_LISTING_LIMIT, getPlan, PRO_PRICE_USD, stripeConfigured } from "@/lib/billing";
import { openPortal, startCheckout } from "@/app/actions/billing";

export const metadata: Metadata = { title: "Pricing" };

const free = [`Up to ${FREE_LISTING_LIMIT} active listings`, "Photo uploads and map pins", "Fixed-price listings and auctions", "Direct messaging with buyers"];
const pro = ["Unlimited active listings", "Featured placement in search results", "Everything in Free", "Manage or cancel anytime"];

export default async function Page({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [{ error }, session] = await Promise.all([searchParams, getSession()]);
  const plan = session ? await getPlan(session.id) : null;
  const configured = stripeConfigured();

  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-6">
      <div className="mx-auto mb-12 max-w-2xl text-center">
        <p className="eyebrow">Pricing</p>
        <h1 className="dot-title mt-2 text-[29px] font-semibold tracking-tight">Simple plans for every seller</h1>
        <p className="mt-4 text-muted">Start free. Upgrade when you&apos;re ready to list more and get seen first.</p>
      </div>

      {(error === "not_configured" || !configured) && (
        <p className="mx-auto mb-8 max-w-xl rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center text-sm text-amber-700 dark:text-amber-300">
          Payments aren&apos;t configured yet. Add <code>STRIPE_SECRET_KEY</code> and <code>STRIPE_WEBHOOK_SECRET</code> to enable upgrades.
        </p>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <div className="card flex flex-col p-8">
          <h2 className="font-display text-2xl font-semibold">Free</h2>
          <p className="mt-3"><span className="font-display text-5xl font-semibold">$0</span><span className="text-muted"> / month</span></p>
          <ul className="mt-6 flex-1 space-y-3 text-sm">{free.map((f) => <li key={f} className="flex gap-2"><Check className="size-4 shrink-0 text-indigo-500" /> {f}</li>)}</ul>
          <Link href={session ? "/sell" : "/register"} className="btn-ghost mt-8">{session ? "Create a listing" : "Get started"}</Link>
        </div>

        <div className="relative flex flex-col overflow-hidden rounded-xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-[#0b2f56] p-8 text-white shadow-lg shadow-indigo-600/20">
          <span className="badge absolute right-6 top-6 bg-white/15 text-white"><Sparkles className="size-3" /> Most popular</span>
          <h2 className="flex items-center gap-2 font-display text-2xl font-semibold"><Crown className="size-5 text-amber-300" /> Pro</h2>
          <p className="mt-3"><span className="font-display text-5xl font-semibold">${PRO_PRICE_USD}</span><span className="text-indigo-200"> / month</span></p>
          <ul className="mt-6 flex-1 space-y-3 text-sm">{pro.map((f) => <li key={f} className="flex gap-2"><Check className="size-4 shrink-0 text-amber-300" /> {f}</li>)}</ul>
          {!session ? (
            <Link href="/login?next=/pricing" className="btn mt-8 bg-white text-indigo-700 hover:bg-indigo-50">Sign in to upgrade</Link>
          ) : plan?.isPro ? (
            <form action={openPortal}><button className="btn mt-8 w-full bg-white text-indigo-700 hover:bg-indigo-50">Manage subscription</button></form>
          ) : (
            <form action={startCheckout}><button className="btn mt-8 w-full bg-white text-indigo-700 hover:bg-indigo-50">Upgrade to Pro</button></form>
          )}
        </div>
      </div>
    </div>
  );
}
