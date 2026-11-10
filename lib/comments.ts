import "server-only";
import { connectDb } from "./db";
import { Comment, isObjectId } from "./models";

export type Kind = "property" | "car";

export type CommentView = {
  id: string;
  authorId: string;
  author: string;
  body: string;
  createdAt: string;
  isSeller: boolean;
};

export const COMMENT_MAX = 1000;
export const COMMENTS_PAGE = 50;

export async function getComments(kind: Kind, listingId: string, sellerId: string | null): Promise<CommentView[]> {
  if (!isObjectId(listingId)) return [];
  await connectDb();
  const docs = await Comment.find({ kind, listingId }).sort({ createdAt: -1 }).limit(COMMENTS_PAGE).lean<{ _id: unknown; authorId: unknown; authorName?: string; body: string; createdAt: Date }[]>();
  return docs.map((d) => ({
    id: String(d._id),
    authorId: String(d.authorId),
    author: d.authorName?.trim() || "Member",
    body: d.body,
    createdAt: d.createdAt.toISOString(),
    isSeller: Boolean(sellerId) && String(d.authorId) === sellerId,
  }));
}
