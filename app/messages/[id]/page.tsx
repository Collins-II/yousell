import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Chat } from "@/components/chat";
import { requireSession } from "@/lib/auth";
import { getConversation, getMessages, markRead } from "@/lib/messages";
import { hasPaidReservation } from "@/lib/reservations";

export const metadata: Metadata = { title: "Conversation" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession(`/messages/${id}`);
  const conv = await getConversation(id, session.id);
  if (!conv) notFound();
  const messages = await getMessages(id, session.id);
  await markRead(id, conv.role);
  const locked = conv.role === "buyer" && !(await hasPaidReservation(session.id, conv.kind, conv.listingId));

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <Link href="/messages" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-fg">
        <ChevronLeft className="size-4" /> All messages
      </Link>
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-line bg-surface p-4">
          <div className="min-w-0">
            <p className="font-semibold">{conv.otherName}</p>
            <Link href={`/${conv.kind === "property" ? "properties" : "cars"}/${conv.listingId}`} className="line-clamp-1 text-sm text-indigo-600 hover:underline dark:text-indigo-300">{conv.listingTitle}</Link>
          </div>
        </div>
        <Chat conversationId={id} initial={messages} locked={locked} listingHref={`/${conv.kind === "property" ? "properties" : "cars"}/${conv.listingId}`} />
      </div>
    </div>
  );
}
