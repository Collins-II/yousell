"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Loader2, Send, Trash2 } from "lucide-react";
import { addComment, deleteComment } from "@/app/actions/comments";
import { useT } from "./prefs-provider";

export function CommentForm({ kind, listingId }: { kind: "property" | "car"; listingId: string }) {
  const t = useT();
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    start(async () => {
      const res = await addComment({ kind, listingId, body });
      if (!res.ok) return setError(res.error);
      setBody("");
      router.refresh();
    });
  };

  return (
    <form onSubmit={submit} className="space-y-2">
      <label htmlFor="comment-body" className="sr-only">{t("commentsWrite")}</label>
      <textarea id="comment-body" value={body} onChange={(e) => setBody(e.target.value)} maxLength={1000} rows={3} placeholder={t("commentsPlaceholder")} className="input resize-y" />
      {error && <p role="alert" className="error-box">{error}</p>}
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted tabular-nums">{body.length}/1000</span>
        <button disabled={pending || !body.trim()} className="btn-primary !px-4">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />} {t("commentsPost")}
        </button>
      </div>
    </form>
  );
}

export function CommentDelete({ id }: { id: string }) {
  const t = useT();
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      aria-label={t("commentsDelete")}
      title={t("commentsDelete")}
      onClick={() => {
        if (!window.confirm(t("commentsDeleteConfirm"))) return;
        start(async () => {
          await deleteComment(id);
          router.refresh();
        });
      }}
      className="rounded-md p-1.5 text-muted transition hover:bg-rose-500/10 hover:text-rose-600 disabled:opacity-50"
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
    </button>
  );
}
