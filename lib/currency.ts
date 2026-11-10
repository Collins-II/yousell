export const CURRENCIES = [
  { code: "ZMW", name: "Zambian kwacha" },
  { code: "USD", name: "US dollar" },
  { code: "EUR", name: "Euro" },
  { code: "GBP", name: "British pound" },
  { code: "ZAR", name: "South African rand" },
  { code: "KES", name: "Kenyan shilling" },
  { code: "NGN", name: "Nigerian naira" },
] as const;

export type CurrencyCode = (typeof CURRENCIES)[number]["code"];
/** "" means: show each listing in the currency it was posted in. */
export type CurrencyPref = CurrencyCode | "";
export const isCurrency = (v: unknown): v is CurrencyCode => CURRENCIES.some((c) => c.code === v);

/** Units of each currency per 1 USD. Used only when the live source is unreachable. */
export const FALLBACK_RATES: Record<string, number> = { USD: 1, ZMW: 27, EUR: 0.92, GBP: 0.78, ZAR: 18.2, KES: 129, NGN: 1550 };

export type Rates = { base: "USD"; rates: Record<string, number>; updatedAt: string; live: boolean };

export function convert(amount: number, from: string, to: string, rates: Record<string, number>) {
  if (from === to) return amount;
  const a = rates[from];
  const b = rates[to];
  if (!a || !b) return amount;
  return (amount / a) * b;
}

export function formatMoney(amount: number, currency: string, locale: string) {
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount).toLocaleString(locale)}`;
  }
}
