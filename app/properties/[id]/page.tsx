import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ListingDetail } from "@/components/listing-detail";
import { getListing } from "@/lib/listings";

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ locked?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const l = await getListing("property", (await params).id);
  return { title: l?.title ?? "Property not found", description: l?.description.slice(0, 160) };
}

export default async function Page({ params, searchParams }: Props) {
  const listing = await getListing("property", (await params).id);
  if (!listing) notFound();
  return <ListingDetail listing={listing} locked={(await searchParams).locked === "1"} />;
}
