"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cancelReservation, completeReservation, confirmReservation, declineReservation, retryRefund } from "@/app/actions/reservations";

type Action = "confirm" | "decline" | "cancel" | "complete" | "refund";

const run = {
  confirm: confirmReservation,
  decline: (id: string) => declineReservation(id),
  cancel: cancelReservation,
  complete: completeReservation,
  refund: retryRefund,
};

const label: Record<Action, string> = { confirm: "Confirm", decline: "Decline & refund", cancel: "Cancel & refund", complete: "Close deal", refund: "Retry refund" };
const confirmText: Partial<Record<Action, string>> = {
  decline: "Decline this reservation? The buyer's fee will be refunded.",
  cancel: "Cancel this reservation? The fee will be refunded.",
  complete: "Mark the deal as closed? The listing will be taken off the marketplace.",
};

export function ReservationActions({ id, actions }: { id: string; actions: Action[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");

  const go = (a: Action) => {
    if (confirmText[a] && !window.confirm(confirmText[a])) return;
    setError("");
    start(async () => {
      const res = await run[a](id);
      if (!res.ok) setError(res.error);
      router.refresh();
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {actions.map((a) => (
          <button key={a} disabled={pending} onClick={() => go(a)} className={a === "confirm" || a === "complete" ? "btn-primary" : "btn-ghost"}>
            {label[a]}
          </button>
        ))}
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
