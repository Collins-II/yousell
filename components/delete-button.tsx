"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { deleteListing } from "@/app/actions/listings";

export function DeleteButton({ kind, id, redirectTo, label = "Delete" }: { kind: "property" | "car"; id: string; redirectTo?: string; label?: string }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const run = () =>
    start(async () => {
      const res = await deleteListing(kind, id);
      if (res.error) {
        setError(res.error);
        setConfirming(false);
      } else if (redirectTo) router.push(redirectTo);
      else router.refresh();
    });

  if (!confirming) {
    return (
      <div className="space-y-1">
        <button type="button" onClick={() => setConfirming(true)} className="btn-danger !px-3 !py-2">
          <Trash2 className="size-4" /> {label}
        </button>
        {error && <p role="alert" className="max-w-56 text-xs text-rose-600 dark:text-rose-300">{error}</p>}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2" role="alertdialog" aria-label="Confirm delete">
      <button type="button" onClick={run} disabled={pending} className="btn-danger !bg-rose-600 !px-3 !py-2 !text-white">
        {pending && <Loader2 className="size-4 animate-spin" />} Confirm delete
      </button>
      <button type="button" onClick={() => setConfirming(false)} disabled={pending} className="btn-ghost !px-3 !py-2">Cancel</button>
    </div>
  );
}
