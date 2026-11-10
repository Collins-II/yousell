import type { Metadata } from "next";
import Link from "next/link";
import { Car, Home } from "lucide-react";
import { EmptyState } from "@/components/listing-card";
import { requireSession } from "@/lib/auth";
import { timeAgo } from "@/lib/format";
import { getInbox } from "@/lib/messages";

export const metadata: Metadata = { title: "Messages" };

export default async function Page() {
  const session = await requireSession("/messages");
  const inbox = await getInbox(session.id);

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <p className="eyebrow">Inbox</p>
      <h1 className="dot-title mb-8 text-[29px] font-semibold tracking-tight">Messages</h1>
      {inbox.length === 0 ? (
        <EmptyState title="No conversations yet" hint="Message a seller from any listing and your conversation will appear here." href="/properties" cta="Browse listings" />
      ) : (
        <ul className="card divide-y divide-line overflow-hidden">
          {inbox.map((c) => (
            <li key={c.id}>
              <Link href={`/messages/${c.id}`} className="flex items-center gap-4 p-4 transition hover:bg-indigo-500/5">
                <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-indigo-500/10 text-indigo-500/60">
                  {c.listingImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.listingImage} alt="" className="size-full object-cover" />
                  ) : c.kind === "property" ? <Home className="size-6" /> : <Car className="size-6" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className={`line-clamp-1 ${c.unread ? "font-bold" : "font-semibold"}`}>{c.otherName}</span>
                    <span className="shrink-0 text-xs text-muted">{timeAgo(c.lastMessageAt)}</span>
                  </span>
                  <span className="line-clamp-1 text-xs text-indigo-600 dark:text-indigo-300">{c.listingTitle}</span>
                  <span className={`line-clamp-1 text-sm ${c.unread ? "font-medium" : "text-muted"}`}>{c.lastMessage || "No messages yet"}</span>
                </span>
                {c.unread > 0 && <span className="grid min-w-6 place-items-center rounded-full bg-rose-500 px-1.5 text-xs font-bold leading-6 text-white">{c.unread}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
