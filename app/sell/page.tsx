import type { Metadata } from "next";
import { ListingForm } from "@/components/listing-form";
import Link from "next/link";
import { Clock, Lock } from "lucide-react";
import { getAccount, listingAccess } from "@/lib/accounts";
import { requireSession } from "@/lib/auth";

export const metadata: Metadata = { title: "List an item" };
export const dynamic = "force-dynamic";

export default async function Page() {
  const session = await requireSession("/sell");
  const account = await getAccount(session.id);
  const access = account ? listingAccess(account) : ({ ok: false, reason: "Account not found" } as const);

  if (!access.ok) {
    const isClient = account?.accountType === "client";
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center sm:px-6">
        <Lock className="mx-auto size-10 text-muted" />
        <h1 className="mt-4 text-2xl font-semibold">{isClient ? "Become a seller to list" : "Listing unavailable"}</h1>
        <p className="mt-2 text-muted">{isClient ? "Client accounts are for browsing, saving and reserving. Switch to a Landlord or Agent account to publish listings." : access.reason}</p>
        <Link href="/account" className="btn-primary mt-6 inline-flex">{isClient ? "Choose seller type" : "Open my account"}</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      {account?.accountType && account.verification === "pending" && (
        <p className="mb-6 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          <Clock className="mt-0.5 size-4 shrink-0" /> Your seller application is under review. You can list now; the verified badge appears once approved.
        </p>
      )}
      <div className="mb-8 space-y-2">
        <h1 className="dot-title text-[29px] font-semibold tracking-tight">Create a listing</h1>
        <p className="text-muted">Add the details, upload photos, pin the location and publish.</p>
      </div>
      <ListingForm />
    </div>
  );
}
