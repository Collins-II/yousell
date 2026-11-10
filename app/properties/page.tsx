import type { Metadata } from "next";
import { Browse } from "@/components/browse";

export const metadata: Metadata = { title: "Properties" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <Browse kind="property" params={await searchParams} />;
}
