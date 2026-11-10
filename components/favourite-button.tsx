"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { toggleFavourite } from "@/app/actions/favourites";

export function FavouriteButton({ kind, id, initial, className = "" }: { kind: "property" | "car"; id: string; initial: boolean; className?: string }) {
  const [saved, setSaved] = useState(initial);
  const [pending, start] = useTransition();
  const router = useRouter();

  const onClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const previous = saved;
    setSaved(!previous);
    start(async () => {
      const res = await toggleFavourite(kind, id);
      if (!res.ok) {
        setSaved(previous);
        if (res.error === "auth") router.push(`/login?next=${encodeURIComponent(window.location.pathname)}`);
      } else {
        setSaved(res.saved);
      }
    });
  };

  return (
    <button
      onClick={onClick}
      disabled={pending}
      aria-pressed={saved}
      aria-label={saved ? "Remove from favourites" : "Save to favourites"}
      className={`grid size-9 place-items-center rounded-full bg-white/90 text-slate-700 shadow-sm backdrop-blur transition hover:scale-105 dark:bg-slate-900/80 dark:text-slate-100 ${className}`}
    >
      <Heart className={`size-4.5 ${saved ? "fill-rose-500 text-rose-500" : ""}`} />
    </button>
  );
}
