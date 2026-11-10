"use server";

import { revalidatePath } from "next/cache";
import { connectDb } from "@/lib/db";
import { Favourite, isObjectId } from "@/lib/models";
import { getSession } from "@/lib/auth";

export async function toggleFavourite(kind: "property" | "car", listingId: string) {
  const session = await getSession();
  if (!session) return { ok: false as const, error: "auth" };
  if ((kind !== "property" && kind !== "car") || !isObjectId(listingId)) return { ok: false as const, error: "invalid" };

  await connectDb();
  const filter = { userId: session.id, kind, listingId };
  const removed = await Favourite.findOneAndDelete(filter);
  if (!removed) await Favourite.updateOne(filter, { $setOnInsert: filter }, { upsert: true });

  revalidatePath("/favourites");
  return { ok: true as const, saved: !removed };
}
