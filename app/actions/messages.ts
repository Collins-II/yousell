"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { connectDb } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Car, Conversation, Message, Property, User, isObjectId } from "@/lib/models";
import { getConversation, markRead, getMessages, type MessageCursor, type MessageView } from "@/lib/messages";
import { hasPaidReservation } from "@/lib/reservations";

type Kind = "property" | "car";

export type StartConversationState = { error?: string };

export async function startConversation(kind: Kind, listingId: string): Promise<StartConversationState> {
  let destination: string;
  try {
    const session = await getSession();
    const listingPath = `/${kind === "property" ? "properties" : "cars"}/${listingId}`;
    if (!session) {
      destination = `/login?next=${encodeURIComponent(listingPath)}`;
    } else if ((kind !== "property" && kind !== "car") || !isObjectId(listingId)) {
      return { error: "This listing is not available." };
    } else {
      await connectDb();
      const listing = await (kind === "property" ? Property : Car).findById(listingId).lean<{ author?: unknown; title?: string; make?: string; carModel?: string; featuredImage?: string }>();
      if (!listing?.author) return { error: "This listing has no seller available to message." };
      const sellerId = String(listing.author);
      if (sellerId === session.id) {
        destination = "/dashboard";
      } else if (!(await hasPaidReservation(session.id, kind, listingId))) {
        destination = `${listingPath}?locked=1`;
      } else {
        const seller = await User.findById(sellerId).select("name").lean<{ name?: string }>();
        if (!seller) return { error: "This listing's seller is no longer available." };
        const filter = { kind, listingId, buyerId: session.id };
        const conv = await Conversation.findOneAndUpdate(
          filter,
          {
            $setOnInsert: {
              ...filter,
              sellerId,
              sellerName: seller.name ?? "Seller",
              buyerName: session.name,
              listingTitle: listing.title || `${listing.make ?? ""} ${listing.carModel ?? ""}`.trim() || "Listing",
              listingImage: /^(https?:\/\/|\/api\/images\/)/.test(listing.featuredImage ?? "") ? listing.featuredImage : "",
              lastMessageAt: new Date(),
            },
          },
          { upsert: true, returnDocument: "after" },
        );
        destination = `/messages/${conv._id}`;
      }
    }
  } catch (error) {
    console.error("[messages] Unable to start conversation", error);
    return { error: "We couldn't start the conversation. Please try again." };
  }
  redirect(destination);
}

const bodySchema = z.string().trim().min(1).max(2000);
const lastSent = new Map<string, number>();

export async function sendMessage(conversationId: string, body: string): Promise<{ ok: true; message: MessageView } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Please sign in" };
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return { ok: false, error: "Message can't be empty or longer than 2000 characters" };

  const now = Date.now();
  if (now - (lastSent.get(session.id) ?? 0) < 700) return { ok: false, error: "You're sending messages too fast" };
  lastSent.set(session.id, now);

  const conv = await getConversation(conversationId, session.id);
  if (!conv) return { ok: false, error: "Conversation not found" };
  if (conv.role === "buyer" && !(await hasPaidReservation(session.id, conv.kind, conv.listingId))) {
    return { ok: false, error: "Pay the reservation fee to message the seller" };
  }

  await connectDb();
  const msg = await Message.create({ conversationId, senderId: session.id, body: parsed.data });
  const otherUnread = conv.role === "buyer" ? "sellerUnread" : "buyerUnread";
  await Conversation.updateOne(
    { _id: conversationId },
    { $set: { lastMessage: parsed.data.slice(0, 140), lastMessageAt: msg.createdAt }, $inc: { [otherUnread]: 1 } },
  );
  revalidatePath("/messages");
  return { ok: true, message: { id: String(msg._id), mine: true, body: parsed.data, at: msg.createdAt.toISOString() } };
}

export async function fetchMessages(conversationId: string, after?: MessageCursor): Promise<{ ok: true; messages: MessageView[] } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Please sign in again to refresh messages." };
  const conv = await getConversation(conversationId, session.id);
  if (!conv) return { ok: false, error: "Conversation not found." };
  const messages = await getMessages(conversationId, session.id, after);
  if (messages.some((m) => !m.mine)) await markRead(conversationId, conv.role);
  return { ok: true, messages };
}
