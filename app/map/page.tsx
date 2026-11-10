import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { MapView, type MapPoint } from "@/components/map-view";
import { convert, formatMoney } from "@/lib/currency";
import { intlLocale, translate } from "@/lib/i18n";
import { getRates } from "@/lib/fx";
import { getPrefs } from "@/lib/prefs";
import { getMapListings, type Kind } from "@/lib/listings";

export const metadata: Metadata = { title: "Map view" };

const tabs = [["all", "All"], ["property", "Properties"], ["car", "Cars"]] as const;

export default async function Page({ searchParams }: { searchParams: Promise<{ kind?: string; q?: string; country?: string; region?: string }> }) {
  const { kind: k, q, country, region } = await searchParams;
  const kind: Kind | "all" = k === "property" || k === "car" ? k : "all";
  const area = typeof country === "string" && country.trim() && typeof region === "string" && region.trim()
    ? { country: country.trim().slice(0, 100), state: region.trim().slice(0, 100) }
    : undefined;
  const [listings, rates, prefs] = await Promise.all([getMapListings(kind, q, 400, area), getRates(), getPrefs()]);
  const t = (key: Parameters<typeof translate>[1], vars?: Parameters<typeof translate>[2]) => translate(prefs.locale, key, vars);
  const money = (n: number, from: string) => formatMoney(convert(n, from, prefs.currency || from, rates.rates), prefs.currency || from, intlLocale(prefs.locale));

  const points: MapPoint[] = listings.map((l) => ({
    id: l.id,
    lat: l.map!.lat,
    lng: l.map!.lng,
    label: money(l.auction && l.auction.bidCount ? l.auction.currentBid : l.price, l.currency),
    title: l.title,
    subtitle: [l.auction ? "Auction" : `For ${l.category}`, l.location].filter(Boolean).join(" · "),
    href: `/${l.kind === "property" ? "properties" : "cars"}/${l.id}`,
    image: l.image,
    auction: Boolean(l.auction && l.auction.status === "live"),
  }));
  const href = (kk: string) => `/map?${new URLSearchParams({ ...(kk !== "all" ? { kind: kk } : {}), ...(q ? { q } : {}), ...(area ? { country: area.country, region: area.state } : {}) })}`;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Explore</p>
          <h1 className="dot-title text-[29px] font-semibold tracking-tight">{area ? `${area.state}, ${area.country}` : t("mapView")}</h1>
          <p className="mt-1 text-muted">{points.length} {points.length === 1 ? "listing" : "listings"} with a pinned location</p>
          {area && <Link href="/map" className="mt-2 inline-block text-sm font-semibold text-indigo-600 hover:underline dark:text-indigo-300">{t("regionsAllMap")}</Link>}
        </div>
        <form action="/map" className="flex gap-2">
          {kind !== "all" && <input type="hidden" name="kind" value={kind} />}
          {area && <><input type="hidden" name="country" value={area.country} /><input type="hidden" name="region" value={area.state} /></>}
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <input name="q" defaultValue={q} placeholder="Search area or title" aria-label="Search" className="field !pl-9" />
          </label>
          <button className="btn-primary">Search</button>
        </form>
      </div>
      <div className="mb-4 flex gap-2" role="tablist">
        {tabs.map(([key, label]) => (
          <Link key={key} href={href(key)} role="tab" aria-selected={kind === key} className={`rounded-full border px-4 py-1.5 text-sm font-semibold transition ${kind === key ? "border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300" : "border-line text-muted hover:text-fg"}`}>
            {label}
          </Link>
        ))}
      </div>
      {points.length === 0 && <p className="mb-4 rounded-xl border border-dashed border-line px-4 py-3 text-sm text-muted">{area ? t("regionsNoPins") : "No pinned listings match yet. Sellers can drop a map pin when creating or editing a listing."}</p>}
      {(!area || points.length > 0) && <MapView points={points} className="h-[68vh]" />}
    </div>
  );
}
