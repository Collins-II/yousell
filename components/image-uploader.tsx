"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Star, X } from "lucide-react";

const MAX = 12;

export function ImageUploader({ initial = [] }: { initial?: string[] }) {
  const [images, setImages] = useState<string[]>(initial);
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    const list = [...files].slice(0, MAX - images.length);
    setBusy((n) => n + list.length);
    for (const file of list) {
      try {
        const body = new FormData();
        body.set("file", file);
        const res = await fetch("/api/upload", { method: "POST", body });
        const data = (await res.json()) as { url?: string; error?: string };
        if (!res.ok || !data.url) setError(data.error ?? "Upload failed");
        else setImages((cur) => [...cur, data.url!]);
      } catch {
        setError("Upload failed — check your connection");
      } finally {
        setBusy((n) => n - 1);
      }
    }
    if (input.current) input.current.value = "";
  };

  const makeCover = (i: number) => setImages((cur) => [cur[i], ...cur.filter((_, n) => n !== i)]);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {images.map((src, i) => (
          <div key={src} className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-line bg-line/40">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={`Photo ${i + 1}`} className="size-full object-cover" />
            <input type="hidden" name="images" value={src} />
            {i === 0 && <span className="badge absolute left-2 top-2 bg-indigo-600 text-white"><Star className="size-3" /> Cover</span>}
            <div className="absolute inset-x-0 bottom-0 flex justify-between gap-1 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-100 sm:opacity-0 sm:transition sm:group-hover:opacity-100">
              {i !== 0 ? <button type="button" onClick={() => makeCover(i)} className="rounded-md bg-white/90 px-2 py-0.5 text-xs font-semibold text-slate-800">Make cover</button> : <span />}
              <button type="button" onClick={() => setImages((cur) => cur.filter((_, n) => n !== i))} aria-label="Remove photo" className="grid size-6 place-items-center rounded-md bg-white/90 text-rose-600"><X className="size-3.5" /></button>
            </div>
          </div>
        ))}
        {Array.from({ length: busy }).map((_, i) => (
          <div key={`busy-${i}`} className="grid aspect-[4/3] place-items-center rounded-xl border border-dashed border-line text-muted"><Loader2 className="size-5 animate-spin" /></div>
        ))}
        {images.length + busy < MAX && (
          <button type="button" onClick={() => input.current?.click()} className="grid aspect-[4/3] place-items-center rounded-xl border-2 border-dashed border-line text-muted transition hover:border-indigo-500/50 hover:bg-indigo-500/5 hover:text-indigo-600">
            <span className="flex flex-col items-center gap-1.5 text-xs font-semibold"><ImagePlus className="size-6" /> Add photos</span>
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple hidden onChange={(e) => upload(e.target.files)} />
      {error && <p role="alert" className="error-box">{error}</p>}
      <p className="text-xs text-muted">Up to {MAX} photos, 6 MB each (JPG, PNG, WebP or GIF). The first photo is the cover.</p>
    </div>
  );
}
