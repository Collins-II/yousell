"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Loader2, Lock, Send } from "lucide-react";
import { fetchMessages, sendMessage } from "@/app/actions/messages";
import type { MessageView } from "@/lib/messages";
import { useT } from "./prefs-provider";

export function Chat({ conversationId, initial, locked = false, listingHref }: { conversationId: string; initial: MessageView[]; locked?: boolean; listingHref: string }) {
  const t = useT();
  const [messages, setMessages] = useState(initial);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const bottom = useRef<HTMLDivElement>(null);
  const last = useRef(initial.at(-1)?.at);

  const merge = useCallback((incoming: MessageView[]) => {
    if (!incoming.length) return;
    setMessages((cur) => {
      const seen = new Set(cur.map((m) => m.id));
      const fresh = incoming.filter((m) => !seen.has(m.id));
      return fresh.length ? [...cur, ...fresh] : cur;
    });
    last.current = incoming.at(-1)!.at;
  }, []);

  useEffect(() => {
    const t = setInterval(async () => {
      if (document.hidden) return;
      merge(await fetchMessages(conversationId, last.current));
    }, 4000);
    return () => clearInterval(t);
  }, [conversationId, merge]);

  useEffect(() => bottom.current?.scrollIntoView({ block: "end" }), [messages.length]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setError(null);
    start(async () => {
      const res = await sendMessage(conversationId, body);
      if (res.ok) {
        setText("");
        merge([res.message]);
      } else setError(res.error);
    });
  };

  return (
    <div className="flex h-[60vh] flex-col">
      <div className="flex-1 space-y-2 overflow-y-auto p-4" aria-live="polite">
        {messages.length === 0 && <p className="py-10 text-center text-sm text-muted">{t("chatHello")}</p>}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.mine ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-xl px-4 py-2 text-sm ${m.mine ? "rounded-br-md bg-indigo-600 text-white" : "rounded-bl-md bg-line/60"}`}>
              <p className="whitespace-pre-wrap break-words">{m.body}</p>
              <p className={`mt-1 text-[10px] ${m.mine ? "text-indigo-100" : "text-muted"}`}>{new Date(m.at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</p>
            </div>
          </div>
        ))}
        <div ref={bottom} />
      </div>
      {locked ? (
        <div className="flex flex-col items-center gap-2 border-t border-line bg-cream p-5 text-center">
          <span className="grid size-10 place-items-center rounded-full bg-indigo-500/10 text-indigo-600"><Lock className="size-5" /></span>
          <p className="text-sm font-semibold">{t("chatLockedTitle")}</p>
          <p className="max-w-sm text-xs text-muted">{t("chatLockedText")}</p>
          <Link href={listingHref} className="btn-primary mt-1">{t("chatGoToListing")}</Link>
        </div>
      ) : (
      <form onSubmit={submit} className="border-t border-line p-3">
        {error && <p role="alert" className="error-box mb-2">{error}</p>}
        <div className="flex gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} placeholder={t("chatPlaceholder")} aria-label="Message" className="field" />
          <button disabled={pending || !text.trim()} className="btn-primary" aria-label="Send">
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </button>
        </div>
      </form>
      )}
    </div>
  );
}
