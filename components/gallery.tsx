"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";

export function Gallery({ images, title }: { images: string[]; title: string }) {
  const [i, setI] = useState(0);

  if (images.length === 0) {
    return (
      <div className="grid aspect-[16/10] place-items-center rounded-xl border border-line bg-gradient-to-br from-indigo-500/10 to-violet-500/10 text-muted">
        <ImageOff className="size-10" aria-label="No photos available" />
      </div>
    );
  }

  const go = (d: number) => setI((i + d + images.length) % images.length);

  return (
    <div className="space-y-3">
      <div className="relative aspect-[16/10] overflow-hidden rounded-xl border border-line bg-line/40">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={images[i]} alt={`${title} — photo ${i + 1}`} className="size-full object-cover" />
        {images.length > 1 && (
          <>
            <button onClick={() => go(-1)} aria-label="Previous photo" className="absolute left-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-slate-800 shadow backdrop-blur hover:bg-white">
              <ChevronLeft className="size-5" />
            </button>
            <button onClick={() => go(1)} aria-label="Next photo" className="absolute right-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-slate-800 shadow backdrop-blur hover:bg-white">
              <ChevronRight className="size-5" />
            </button>
            <span className="absolute bottom-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white">
              {i + 1} / {images.length}
            </span>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((src, n) => (
            <button key={src} onClick={() => setI(n)} aria-label={`Show photo ${n + 1}`} className={`h-16 w-24 shrink-0 overflow-hidden rounded-lg border-2 transition ${n === i ? "border-indigo-500" : "border-transparent opacity-70 hover:opacity-100"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" loading="lazy" className="size-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
