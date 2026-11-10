import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ListingForm } from "@/components/listing-form";
import { requireSession } from "@/lib/auth";
import { getEditable } from "@/lib/listings";

export const metadata: Metadata = { title: "Edit listing" };

export default async function Page({ params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params;
  if (kind !== "property" && kind !== "car") notFound();
  const session = await requireSession(`/listings/${kind}/${id}/edit`);
  const listing = await getEditable(kind, id, session.id);
  if (!listing) notFound();

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="mb-8 space-y-2">
        <p className="eyebrow">Manage</p>
        <h1 className="dot-title text-[29px] font-semibold tracking-tight">Edit listing</h1>
        <p className="text-muted">Update details, photos and location. Changes go live immediately.</p>
      </div>
      <ListingForm edit={listing} />
    </div>
  );
}
