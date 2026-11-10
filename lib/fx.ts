import "server-only";
import { CURRENCIES, FALLBACK_RATES, type Rates } from "./currency";

const SOURCE = "https://open.er-api.com/v6/latest/USD";

/** Live exchange rates, cached for an hour by Next's data cache. Falls back to static rates if the source is down. */
export async function getRates(): Promise<Rates> {
  try {
    const res = await fetch(SOURCE, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error(String(res.status));
    const json = (await res.json()) as { result?: string; rates?: Record<string, number>; time_last_update_utc?: string };
    if (json.result !== "success" || !json.rates) throw new Error("bad payload");
    const rates: Record<string, number> = {};
    for (const c of CURRENCIES) {
      const v = json.rates[c.code];
      if (typeof v === "number" && v > 0) rates[c.code] = v;
    }
    if (!rates.USD) rates.USD = 1;
    for (const c of CURRENCIES) rates[c.code] ??= FALLBACK_RATES[c.code];
    return { base: "USD", rates, updatedAt: json.time_last_update_utc ? new Date(json.time_last_update_utc).toISOString() : new Date().toISOString(), live: true };
  } catch {
    return { base: "USD", rates: FALLBACK_RATES, updatedAt: new Date().toISOString(), live: false };
  }
}
