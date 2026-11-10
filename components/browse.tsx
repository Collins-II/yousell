import Link from "next/link";
import { Map as MapIcon, Search } from "lucide-react";
import { getSession } from "@/lib/auth";
import { getFavouriteKeys, searchListings, type Filters, type Kind } from "@/lib/listings";
import { getT } from "@/lib/prefs";
import { EmptyState, ListingCard } from "./listing-card";
import { TopAgents } from "./top-agents";

type Params = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;
const num = (v: string | string[] | undefined) => {
  const n = Number(one(v));
  return Number.isFinite(n) && one(v) ? n : undefined;
};

export function parseFilters(p: Params): Filters {
  const sort = one(p.sort);
  return {
    q: one(p.q),
    category: one(p.category),
    min: num(p.min),
    max: num(p.max),
    beds: num(p.beds),
    make: one(p.make),
    fuel: one(p.fuel),
    transmission: one(p.transmission),
    sort: sort === "price_asc" || sort === "price_desc" ? sort : "newest",
    page: num(p.page),
  };
}

function Select({ name, label, value, options, any }: { name: string; label: string; value?: string; options: [string, string][]; any: string }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-muted">{label}</span>
      <select name={name} defaultValue={value ?? ""} className="field">
        <option value="">{any}</option>
        {options.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
    </label>
  );
}

export async function Browse({ kind, params }: { kind: Kind; params: Params }) {
  const filters = parseFilters(params);
  const session = await getSession();
  const [{ items, total, page, pages }, favourites, { t }] = await Promise.all([searchListings(kind, filters), getFavouriteKeys(session?.id), getT()]);
  const any = t("any");
  const base = kind === "property" ? "/properties" : "/cars";

  const pageHref = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      const val = one(v);
      if (val && k !== "page") sp.set(k, val);
    }
    sp.set("page", String(p));
    return `${base}?${sp}`;
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="eyebrow">{kind === "property" ? t("properties") : t("carsEyebrow")}</p>
          <h2 className="text-2xl font-semibold tracking-tight">{total === 1 ? t("listingAvailable") : t("listingsAvailable", { n: total })}</h2>
        </div>
        <Link href={`/map?kind=${kind}`} className="btn-ghost"><MapIcon className="size-4" /> {t("mapView")}</Link>
      </div>

      <TopAgents kind={kind} />

      <form action={base} className="card mb-8 grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-6">
        <label className="relative block space-y-1.5 sm:col-span-2">
          <span className="text-xs font-medium text-muted">{t("search")}</span>
          <Search className="pointer-events-none absolute bottom-3 left-3 size-4 text-muted" />
          <input name="q" defaultValue={filters.q} placeholder={kind === "property" ? t("propSearchPh") : t("carSearchPh")} className="field !pl-9" />
        </label>
        <Select any={any} name="category" label={t("listing")} value={filters.category} options={[["Sale", t("forSale")], ["Rent", t("forRent")]]} />
        {kind === "property" ? (
          <Select any={any} name="beds" label={t("bedrooms")} value={filters.beds?.toString()} options={[["1", "1+"], ["2", "2+"], ["3", "3+"], ["4", "4+"]]} />
        ) : (
          <Select any={any} name="fuel" label={t("fuel")} value={filters.fuel} options={[["PETROL", "Petrol"], ["DIESEL", "Diesel"], ["ELECTRIC", "Electric"], ["HYBRID", "Hybrid"]]} />
        )}
        <Select any={any} name="sort" label={t("sortBy")} value={filters.sort} options={[["newest", t("newest")], ["price_asc", t("priceLow")], ["price_desc", t("priceHigh")]]} />
        <div className="flex items-end gap-2">
          <button className="btn-primary flex-1">{t("apply")}</button>
          <Link href={base} className="btn-ghost">{t("reset")}</Link>
        </div>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted">{t("minPrice")}</span>
          <input name="min" type="number" min={0} defaultValue={filters.min} placeholder="0" className="field" />
        </label>
        <label className="block space-y-1.5">
          <span className="text-xs font-medium text-muted">{t("maxPrice")}</span>
          <input name="max" type="number" min={0} defaultValue={filters.max} placeholder="No limit" className="field" />
        </label>
        {kind === "car" && <Select any={any} name="transmission" label={t("gearbox")} value={filters.transmission} options={[["AUTOMATIC", "Automatic"], ["MANUAL", "Manual"]]} />}
      </form>

      {items.length === 0 ? (
        <EmptyState title={t("noMatch")} hint={t("noMatchHint")} href={base} cta={t("clearFilters")} />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((l) => (
            <ListingCard key={l.id} listing={l} saved={favourites.has(`${l.kind}:${l.id}`)} />
          ))}
        </div>
      )}

      {pages > 1 && (
        <nav className="mt-10 flex items-center justify-center gap-3" aria-label="Pagination">
          {page > 1 && <Link href={pageHref(page - 1)} className="btn-ghost">{t("previous")}</Link>}
          <span className="text-sm text-muted">{t("pageOf", { p: page, n: pages })}</span>
          {page < pages && <Link href={pageHref(page + 1)} className="btn-ghost">{t("next")}</Link>}
        </nav>
      )}
    </div>
  );
}
