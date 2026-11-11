"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowDownUp, ArrowLeft, ArrowRight, Building2, CarFront, MapPin } from "lucide-react";
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
  const rail = useRef<HTMLUListElement>(null);

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
  const scroll = (direction: -1 | 1) => {
    const el = rail.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  };

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
        <div aria-label={t("regionsCountry")} className="flex flex-wrap gap-2 border-b border-line px-5 py-3 sm:px-7">
          {data.map((c) => (
            <button
              key={c.country}
              aria-pressed={c.country === current.country}
              onClick={() => {
                setCountry(c.country);
                rail.current?.scrollTo({ left: 0 });
              }}
              className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition ${c.country === current.country ? "border-indigo-600 bg-indigo-600 text-white" : "border-line text-muted hover:border-indigo-500/50 hover:text-fg"}`}
            >
              {c.country}
              <span className={`rounded-full px-1.5 text-[10px] ${c.country === current.country ? "bg-white/20" : "bg-line"}`}>{c.total}</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 px-4 pt-5 sm:px-7">
        <p className="flex items-center gap-2 text-xs font-medium text-muted">
          <ArrowDownUp className="size-3.5 rotate-90 text-indigo-500" aria-hidden="true" />
          {t("regionsScroll")}
        </p>
        <div className="flex gap-2">
          <button type="button" onClick={() => scroll(-1)} aria-label={t("regionsScrollPrevious")} aria-controls="region-list" className="grid size-9 place-items-center rounded-full border border-line bg-surface text-fg transition hover:border-indigo-500 hover:text-indigo-600">
            <ArrowLeft className="size-4" aria-hidden="true" />
          </button>
          <button type="button" onClick={() => scroll(1)} aria-label={t("regionsScrollNext")} aria-controls="region-list" className="grid size-9 place-items-center rounded-full border border-line bg-surface text-fg transition hover:border-indigo-500 hover:text-indigo-600">
            <ArrowRight className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
      <ul ref={rail} id="region-list" aria-label={t("regionsTitle")} tabIndex={0} className="grid snap-x snap-mandatory grid-flow-col grid-rows-2 auto-cols-[minmax(190px,42%)] gap-3 overflow-x-auto overscroll-x-contain p-4 sm:auto-cols-[230px] sm:px-7 sm:pb-6">
        {current.regions.map((r, i) => (
          <li key={r.name} className="min-w-0 snap-start">
            <Link prefetch={false} href={`/map?${new URLSearchParams({ country: current.country, region: r.name })}`} className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-line bg-bg p-4 transition hover:border-indigo-500/50 hover:bg-indigo-500/5 hover:shadow-md focus-visible:outline-offset-[-2px]">
              <div className="flex items-start justify-between gap-2">
                <span className="flex min-w-0 items-center gap-2 text-sm font-semibold"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-300"><MapPin className="size-4" aria-hidden="true" /></span><span className="break-words">{r.name}</span></span>
                <ArrowRight className="size-4 shrink-0 text-muted transition group-hover:translate-x-1 group-hover:text-indigo-500" aria-hidden="true" />
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <Counter value={r.total} run={seen} className={`text-3xl font-semibold leading-none tracking-tight ${r.total ? "" : "text-muted/60"}`} />
                <span className="text-xs text-muted">{r.total === 0 ? t("regionsEmpty") : t("regionCountLabel")}</span>
              </div>
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-line">
                <div className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-indigo-600 transition-[width] duration-1000 ease-out motion-reduce:transition-none" style={{ width: seen ? `${(r.total / max) * 100}%` : "0%", transitionDelay: `${i * 60}ms` }} />
              </div>
              <div className="mt-auto flex items-center justify-between gap-2 pt-4 text-xs">
                <span className="flex items-center gap-3 font-semibold text-muted">
                  <span className="inline-flex items-center gap-1" title={t("properties")}><Building2 className="size-3.5" aria-hidden="true" /> <span className="sr-only">{t("properties")} </span>{r.properties}</span>
                  <span className="inline-flex items-center gap-1" title={t("cars")}><CarFront className="size-3.5" aria-hidden="true" /> <span className="sr-only">{t("cars")} </span>{r.cars}</span>
                </span>
                <span className="font-semibold text-indigo-600 dark:text-indigo-300">{t("mapView")}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
