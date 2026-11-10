import type { Metadata } from "next";
import { Browse } from "@/components/browse";

export const metadata: Metadata = { title: "Cars" };

export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <Browse kind="car" params={await searchParams} />;
}
