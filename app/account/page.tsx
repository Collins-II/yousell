import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertCircle, BadgeCheck, Clock, PartyPopper, ShieldCheck } from "lucide-react";
import { ProfileForm } from "@/components/profile-form";
import { ACCOUNT_INFO, isSellerType } from "@/lib/account-types";
import { getAccount } from "@/lib/accounts";
import { requireSession } from "@/lib/auth";

export const metadata: Metadata = { title: "Account" };
export const dynamic = "force-dynamic";

const status = {
  none: { icon: AlertCircle, tone: "border-line bg-surface", title: "Not a seller account", text: "Choose Landlord or Agent below to start listing." },
  pending: { icon: Clock, tone: "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200", title: "Application under review", text: "We're checking your details. You can already create listings; the verified badge appears once approved." },
  verified: { icon: BadgeCheck, tone: "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200", title: "Verified seller", text: "Buyers see the verified badge on your listings and profile." },
  rejected: { icon: AlertCircle, tone: "border-rose-500/30 bg-rose-500/10 text-rose-800 dark:text-rose-200", title: "Changes needed", text: "Update the details below and resubmit. You can't publish new listings until this is resolved." },
} as const;

export default async function Page({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const session = await requireSession("/account");
  const [{ welcome }, account] = await Promise.all([searchParams, getAccount(session.id)]);
  if (!account) notFound();

  const seller = isSellerType(account.accountType);
  const s = status[seller || account.staff ? account.verification : "none"];
  const Icon = s.icon;

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6 sm:py-10">
      <header>
        <h1 className="text-2xl font-semibold">{account.name}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 text-sm text-muted">
          <span>{account.email}</span>
          <span className="font-medium">{account.accountType ? ACCOUNT_INFO[account.accountType].label : "Account type not set"}</span>
          {account.staff && <span className="inline-flex items-center gap-1 text-emerald-600"><ShieldCheck className="size-4" /> Platform staff</span>}
        </p>
      </header>

      {welcome && (
        <p className="flex items-start gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-3 text-sm font-medium text-indigo-700 dark:text-indigo-300">
          <PartyPopper className="mt-0.5 size-4 shrink-0" /> Welcome to YouSell! Your account is ready and your seller application has been sent for review.
        </p>
      )}

      {!account.accountType && (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          Tell us how you use YouSell. Existing sellers keep listing while you complete this.
        </p>
      )}

      <section className={`flex items-start gap-3 rounded-xl border p-4 ${s.tone}`} aria-live="polite">
        <Icon className="mt-0.5 size-5 shrink-0" />
        <div className="text-sm">
          <p className="font-semibold">{s.title}</p>
          <p className="mt-0.5 opacity-90">{s.text}</p>
          {account.verification === "rejected" && account.verificationNote && <p className="mt-2 rounded-lg bg-black/5 px-3 py-2 font-medium dark:bg-white/10">Reviewer note: {account.verificationNote}</p>}
        </div>
      </section>

      {seller && (
        <div className="flex flex-wrap gap-2 text-sm">
          <Link href={`/agents/${account.id}`} className="btn-ghost">View my public profile</Link>
          <Link href="/sell" className="btn-primary">Create a listing</Link>
        </div>
      )}

      <ProfileForm
        type={account.accountType ?? "client"}
        defaults={{ phone: account.phone, ...account.profile }}
        submitLabel={account.accountType ? "Save changes" : "Continue"}
      />
    </div>
  );
}
