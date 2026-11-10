"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { intlLocale, translate, type Key, type Locale } from "@/lib/i18n";
import { convert, formatMoney, type CurrencyPref, type Rates } from "@/lib/currency";

type Ctx = {
  locale: Locale;
  currency: CurrencyPref;
  rates: Rates;
  t: (key: Key, vars?: Record<string, string | number>) => string;
  /** Formats an amount posted in `from`, converted to the visitor's chosen currency. */
  money: (amount: number, from: string) => string;
};

const PrefsContext = createContext<Ctx | null>(null);

export function PrefsProvider({ locale, currency, rates: initial, children }: { locale: Locale; currency: CurrencyPref; rates: Rates; children: React.ReactNode }) {
  const [rates, setRates] = useState(initial);

  // Keep rates live while the tab stays open.
  useEffect(() => {
    const id = setInterval(async () => {
      if (document.hidden) return;
      try {
        const res = await fetch("/api/fx");
        if (res.ok) setRates((await res.json()) as Rates);
      } catch {}
    }, 10 * 60_000);
    return () => clearInterval(id);
  }, []);

  const t = useCallback<Ctx["t"]>((key, vars) => translate(locale, key, vars), [locale]);
  const money = useCallback<Ctx["money"]>(
    (amount, from) => formatMoney(convert(amount, from, currency || from, rates.rates), currency || from, intlLocale(locale)),
    [currency, locale, rates],
  );
  const value = useMemo(() => ({ locale, currency, rates, t, money }), [locale, currency, rates, t, money]);
  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs() {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error("usePrefs must be used inside PrefsProvider");
  return ctx;
}

export const useT = () => usePrefs().t;
