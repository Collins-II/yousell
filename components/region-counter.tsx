"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Building2, CarFront, MapPin } from "lucide-react";
import type { CountryRegions } from "@/lib/regions";
import { usePrefs } from "./prefs-provider";

/** Counts from 0 to `target` once `run` turns true. */
function useCountUp(target: number, run: boolean, ms = 1100) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!run) return;
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = reduce ? 1 : Math.min(1, (now - start) / ms);
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, run, ms]);
  return run ? value : 0;
}

function Counter({ value, run, className }: { value: number; run: boolean; className?: string }) {
  const v = useCountUp(value, run);
  return <span className={`tabular-nums ${className ?? ""}`}>{v.toLocaleString()}</span>;
}

export function RegionCounter({ data }: { data: CountryRegions[] }) {
  const { t } = usePrefs();
  const [country, setCountry] = useState(data[0]?.country ?? "");
  const [seen, setSeen] = useState(false);
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const current = data.find((c) => c.country === country) ?? data[0];
  if (!current) return null;
  const max = Math.max(1, ...current.regions.map((r) => r.total));

  return (
    <section ref={root} aria-labelledby="regions" className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line bg-cream px-4 py-4 sm:px-7 sm:py-5">
        <div>
          <p className="eyebrow">{t("regionsEyebrow")}</p>
          <h2 id="regions" className="mt-1 text-xl font-semibold">{t("regionsTitle")}</h2>
          <p className="mt-1 text-sm text-muted">{t("regionsSub")}</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">{t("regionsTotal")}</p>
          <Counter key={current.country} value={current.total} run={seen} className="text-4xl font-semibold leading-none sm:text-5xl tracking-tight text-indigo-600 dark:text-indigo-300" />
        </div>
      </div>

      {data.length > 1 && (
        <div role="tablist" aria-label={t("regionsCountry")} className="flex flex-wrap gap-2 border-b border-line px-5 py-3 sm:px-7">
          {data.map((c) => (
            <button
              key={c.country}
              role="tab"
              aria-selected={c.country === current.country}
              onClick={() => setCountry(c.country)}
              className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${c.country === current.country ? "border-indigo-600 bg-indigo-600 text-white" : "border-line text-muted hover:border-indigo-500/50 hover:text-fg"}`}
            >
              {c.country}
              <span className={`rounded-full px-1.5 text-[10px] ${c.country === current.country ? "bg-white/20" : "bg-line"}`}>{c.total}</span>
            </button>
          ))}
        </div>
      )}

      <ul key={current.country} className="grid grid-cols-2 gap-2.5 p-3 sm:grid-cols-3 sm:gap-3 sm:p-6 lg:grid-cols-4 xl:grid-cols-5">
        {current.regions.map((r, i) => (
          <li key={r.name} className={`group relative overflow-hidden rounded-xl border border-line p-3 transition sm:p-4 hover:-translate-y-0.5 hover:border-indigo-500/40 hover:shadow-md ${r.total ? "bg-bg" : "bg-bg/50"}`}>
            <div className="flex items-start justify-between gap-2">
              <p className="flex items-center gap-1.5 text-xs font-semibold sm:text-[13px]"><MapPin className="size-3.5 text-indigo-500" />{r.name}</p>
            </div>
            <Counter value={r.total} run={seen} className={`mt-2 block text-3xl font-semibold sm:mt-3 sm:text-4xl leading-none tracking-tight ${r.total ? "" : "text-muted/50"}`} />
            <p className="mt-1 text-xs text-muted">{r.total === 0 ? t("regionsEmpty") : r.total === 1 ? t("regionsOne") : t("regionsListings", { n: r.total })}</p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-indigo-600 transition-[width] duration-1000 ease-out"
                style={{ width: seen ? `${(r.total / max) * 100}%` : "0%", transitionDelay: `${i * 60}ms` }}
              />
            </div>
            {r.total > 0 && (
              <div className="mt-3 flex gap-2 text-[11px] font-semibold">
                <Link href={`/properties?q=${encodeURIComponent(r.name)}`} className="inline-flex items-center gap-1 rounded-full bg-indigo-500/10 px-2 py-1 text-indigo-700 hover:bg-indigo-500/20 dark:text-indigo-300">
                  <Building2 className="size-3" /> {r.properties}
                </Link>
                <Link href={`/cars?q=${encodeURIComponent(r.name)}`} className="inline-flex items-center gap-1 rounded-full bg-indigo-500/10 px-2 py-1 text-indigo-700 hover:bg-indigo-500/20 dark:text-indigo-300">
                  <CarFront className="size-3" /> {r.cars}
                </Link>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
