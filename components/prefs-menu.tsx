"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Globe } from "lucide-react";
import { setPrefs } from "@/app/actions/prefs";
import { LOCALES } from "@/lib/i18n";
import { CURRENCIES } from "@/lib/currency";
import { usePrefs } from "./prefs-provider";

export function PrefsMenu() {
  const { locale, currency, rates, t } = usePrefs();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const apply = (l: string, c: string) =>
    start(async () => {
      await setPrefs(l, c);
      router.refresh();
    });

  const time = new Date(rates.updatedAt).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`${t("language")} / ${t("currency")}`}
        className="inline-flex size-10 items-center justify-center gap-1.5 rounded border border-line text-xs font-semibold text-muted transition hover:text-fg sm:h-10 sm:w-auto sm:px-2.5"
      >
        <Globe className="size-4" />
        <span className="hidden uppercase sm:inline">{locale}</span>
        <span className="hidden text-line sm:inline">|</span>
        <span className="hidden sm:inline">{currency || "AUTO"}</span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div role="dialog" aria-label={t("language")} className={`fixed inset-x-4 top-28 z-50 max-h-[calc(100dvh-8rem)] overflow-y-auto rounded-xl border border-line bg-surface p-4 shadow-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-72 ${pending ? "opacity-70" : ""}`}>
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">{t("language")}</p>
            <ul className="mt-2 grid grid-cols-2 gap-1.5">
              {LOCALES.map((l) => (
                <li key={l.code}>
                  <button onClick={() => apply(l.code, currency)} className={`flex w-full items-center justify-between rounded-md border px-2.5 py-2 text-left text-xs font-semibold transition ${l.code === locale ? "border-indigo-600 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" : "border-line hover:border-indigo-500/40"}`}>
                    {l.label}
                    {l.code === locale && <Check className="size-3.5" />}
                  </button>
                </li>
              ))}
            </ul>

            <p className="mt-4 text-[10px] font-semibold uppercase tracking-widest text-muted">{t("currency")}</p>
            <ul className="mt-2 grid grid-cols-2 gap-1.5">
              <li className="col-span-2">
                <button onClick={() => apply(locale, "")} className={`flex w-full items-center justify-between rounded-md border px-2.5 py-2 text-left text-xs font-semibold transition ${currency === "" ? "border-indigo-600 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" : "border-line hover:border-indigo-500/40"}`}>
                  {t("listingCurrency")}
                  {currency === "" && <Check className="size-3.5" />}
                </button>
              </li>
              {CURRENCIES.map((c) => (
                <li key={c.code}>
                  <button onClick={() => apply(locale, c.code)} title={c.name} className={`flex w-full items-center justify-between rounded-md border px-2.5 py-2 text-left text-xs font-semibold transition ${c.code === currency ? "border-indigo-600 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300" : "border-line hover:border-indigo-500/40"}`}>
                    {c.code}
                    {c.code === currency && <Check className="size-3.5" />}
                  </button>
                </li>
              ))}
            </ul>

            <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted">
              <span className={`size-1.5 rounded-full ${rates.live ? "bg-emerald-500" : "bg-amber-500"}`} />
              {rates.live ? t("ratesUpdated", { time }) : "Offline rates"}
            </p>
          </div>
        </>
      )}
    </div>
  );
}
