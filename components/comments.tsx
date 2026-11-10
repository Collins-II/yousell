import Link from "next/link";
import { BadgeCheck, MessageSquare } from "lucide-react";
import { getSession } from "@/lib/auth";
import { getComments } from "@/lib/comments";
import { getT } from "@/lib/prefs";
import { CommentDelete, CommentForm } from "./comment-form";

function ago(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 30 * 86_400) return `${Math.floor(s / 86_400)}d ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export async function Comments({ kind, listingId, sellerId, path }: { kind: "property" | "car"; listingId: string; sellerId: string | null; path: string }) {
  const [session, { t }, comments] = await Promise.all([getSession(), getT(), getComments(kind, listingId, sellerId)]);
  const isOwner = Boolean(session && sellerId === session.id);

  return (
    <section className="space-y-4" aria-labelledby="comments-title">
      <h2 id="comments-title" className="flex items-center gap-2 text-2xl font-semibold">
        <MessageSquare className="size-5 text-indigo-500" /> {t("commentsTitle")} <span className="text-base font-normal text-muted">({comments.length})</span>
      </h2>

      {session ? (
        <CommentForm kind={kind} listingId={listingId} />
      ) : (
        <p className="card px-4 py-3 text-sm text-muted">
          <Link href={`/login?next=${encodeURIComponent(path)}`} className="font-semibold text-indigo-500 hover:underline">{t("signIn")}</Link> {t("commentsSignIn")}
        </p>
      )}

      {comments.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-muted">{t("commentsEmpty")}</p>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => (
            <li key={c.id} className={`card flex gap-3 p-3.5 sm:p-4 ${c.isSeller ? "border-indigo-500/40 bg-indigo-500/5" : ""}`}>
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#1d2b41] text-sm font-semibold text-white">{c.author.charAt(0).toUpperCase()}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  {c.isSeller ? (
                    <Link href={`/agents/${c.authorId}`} className="text-sm font-semibold hover:underline">{c.author}</Link>
                  ) : (
                    <span className="text-sm font-semibold">{c.author}</span>
                  )}
                  {c.isSeller && <span className="badge !px-2 !py-0.5 bg-indigo-500/15 text-indigo-600 dark:text-indigo-300"><BadgeCheck className="size-3" /> {t("commentsSeller")}</span>}
                  <time dateTime={c.createdAt} className="text-xs text-muted">{ago(c.createdAt)}</time>
                </div>
                <p className="mt-1 whitespace-pre-line break-words text-sm leading-relaxed">{c.body}</p>
              </div>
              {session && (c.authorId === session.id || isOwner) && <CommentDelete id={c.id} />}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
