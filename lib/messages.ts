import "server-only";
import { Types } from "mongoose";
import { connectDb } from "./db";
import { Conversation, Message, isObjectId } from "./models";

export type ConversationView = {
  id: string;
  kind: "property" | "car";
  listingId: string;
  listingTitle: string;
  listingImage: string | null;
  otherName: string;
  lastMessage: string;
  lastMessageAt: string;
  unread: number;
  role: "buyer" | "seller";
};

export type MessageView = { id: string; mine: boolean; body: string; at: string };

type ConvDoc = {
  _id: unknown;
  kind: "property" | "car";
  listingId: unknown;
  listingTitle?: string;
  listingImage?: string;
  sellerId: unknown;
  buyerId: unknown;
  sellerName?: string;
  buyerName?: string;
  lastMessage?: string;
  lastMessageAt: Date;
  sellerUnread?: number;
  buyerUnread?: number;
};

export function toConversationView(c: ConvDoc, userId: string): ConversationView {
  const role = String(c.buyerId) === userId ? "buyer" : "seller";
  return {
    id: String(c._id),
    kind: c.kind,
    listingId: String(c.listingId),
    listingTitle: c.listingTitle ?? "Listing",
    listingImage: c.listingImage || null,
    otherName: (role === "buyer" ? c.sellerName : c.buyerName) || "User",
    lastMessage: c.lastMessage ?? "",
    lastMessageAt: c.lastMessageAt.toISOString(),
    unread: (role === "buyer" ? c.buyerUnread : c.sellerUnread) ?? 0,
    role,
  };
}

export async function getInbox(userId: string) {
  await connectDb();
  const docs = await Conversation.find({ $or: [{ buyerId: userId }, { sellerId: userId }] }).sort({ lastMessageAt: -1 }).limit(100).lean<ConvDoc[]>();
  return docs.map((d) => toConversationView(d, userId));
}

export async function getConversation(id: string, userId: string) {
  if (!isObjectId(id)) return null;
  await connectDb();
  const doc = await Conversation.findOne({ _id: id, $or: [{ buyerId: userId }, { sellerId: userId }] }).lean<ConvDoc>();
  return doc ? toConversationView(doc, userId) : null;
}

export async function getMessages(conversationId: string, userId: string, after?: string): Promise<MessageView[]> {
  await connectDb();
  const filter: Record<string, unknown> = { conversationId };
  if (after && !Number.isNaN(Date.parse(after))) filter.createdAt = { $gt: new Date(after) };
  const docs = await Message.find(filter).sort({ createdAt: 1 }).limit(200).lean<{ _id: unknown; senderId: unknown; body: string; createdAt: Date }[]>();
  return docs.map((m) => ({ id: String(m._id), mine: String(m.senderId) === userId, body: m.body, at: m.createdAt.toISOString() }));
}

export async function markRead(id: string, role: "buyer" | "seller") {
  await Conversation.updateOne({ _id: id }, { $set: { [role === "buyer" ? "buyerUnread" : "sellerUnread"]: 0 } });
}

export async function getUnreadCount(userId: string) {
  await connectDb();
  const id = new Types.ObjectId(userId);
  const [asBuyer, asSeller] = await Promise.all([
    Conversation.aggregate([{ $match: { buyerId: id } }, { $group: { _id: null, n: { $sum: "$buyerUnread" } } }]),
    Conversation.aggregate([{ $match: { sellerId: id } }, { $group: { _id: null, n: { $sum: "$sellerUnread" } } }]),
  ]);
  return (asBuyer[0]?.n ?? 0) + (asSeller[0]?.n ?? 0);
}
