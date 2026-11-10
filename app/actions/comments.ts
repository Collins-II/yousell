"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getSession } from "@/lib/auth";
import { COMMENT_MAX } from "@/lib/comments";
import { connectDb } from "@/lib/db";
import { Car, Comment, Property, isObjectId } from "@/lib/models";

type Result = { ok: true } | { ok: false; error: string };

const schema = z.object({
  kind: z.enum(["property", "car"]),
  listingId: z.string().refine(isObjectId, "Listing not found"),
  body: z.string().trim().min(1, "Write a comment first.").max(COMMENT_MAX, `Comments are limited to ${COMMENT_MAX} characters.`),
});

const MAX_PER_HOUR = 10;
const pathFor = (kind: "property" | "car", id: string) => `/${kind === "property" ? "properties" : "cars"}/${id}`;

export async function addComment(input: z.input<typeof schema>): Promise<Result> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Please sign in to comment." };
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid comment" };
  const { kind, listingId, body } = parsed.data;

  await connectDb();
  if (!(await (kind === "property" ? Property : Car).exists({ _id: listingId }))) return { ok: false, error: "Listing not found." };
  const recent = await Comment.countDocuments({ authorId: session.id, createdAt: { $gte: new Date(Date.now() - 3_600_000) } });
  if (recent >= MAX_PER_HOUR) return { ok: false, error: "You're commenting too quickly. Please try again later." };

  await Comment.create({ kind, listingId, authorId: session.id, authorName: session.name, body });
  revalidatePath(pathFor(kind, listingId));
  return { ok: true };
}

/** Authors can remove their own comments; the listing owner can moderate the thread under their listing. */
export async function deleteComment(id: string): Promise<Result> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Please sign in." };
  if (!isObjectId(id)) return { ok: false, error: "Comment not found." };

  await connectDb();
  const comment = await Comment.findById(id).lean<{ kind: "property" | "car"; listingId: unknown; authorId: unknown }>();
  if (!comment) return { ok: false, error: "Comment not found." };
  const listing = await (comment.kind === "property" ? Property : Car).findById(comment.listingId).select("author").lean<{ author?: unknown }>();
  const allowed = String(comment.authorId) === session.id || (listing?.author != null && String(listing.author) === session.id);
  if (!allowed) return { ok: false, error: "You can't remove this comment." };

  await Comment.deleteOne({ _id: id });
  revalidatePath(pathFor(comment.kind, String(comment.listingId)));
  return { ok: true };
}
