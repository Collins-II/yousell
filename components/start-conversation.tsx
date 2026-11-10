"use client";

import { useActionState } from "react";
import { Loader2, MessageCircle } from "lucide-react";
import { startConversation } from "@/app/actions/messages";
import { useT } from "./prefs-provider";

export function StartConversation({ kind, listingId }: { kind: "property" | "car"; listingId: string }) {
  const t = useT();
  const [state, action, pending] = useActionState(startConversation.bind(null, kind, listingId), {});

  return (
    <form action={action} className="space-y-2">
      {state.error && <p role="alert" className="error-box">{state.error}</p>}
      <button disabled={pending} className="btn-ghost w-full">
        {pending ? <Loader2 className="size-4 animate-spin" /> : <MessageCircle className="size-4" />}
        {t("messageSeller")}
      </button>
    </form>
  );
}
