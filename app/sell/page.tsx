import type { Metadata } from "next";
import { ListingForm } from "@/components/listing-form";
import { requireSession } from "@/lib/auth";

export const metadata: Metadata = { title: "List an item" };

export default async function Page() {
  await requireSession("/sell");
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="mb-8 space-y-2">
        <h1 className="dot-title text-[29px] font-semibold tracking-tight">Create a listing</h1>
        <p className="text-muted">Add the details, upload photos, pin the location and publish.</p>
      </div>
      <ListingForm />
    </div>
  );
}
