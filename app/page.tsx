import Link from "next/link";
import { ArrowRight, Building2, CarFront, Gavel, Search, UserCheck } from "lucide-react";
import { ListingCard } from "@/components/listing-card";
import { RegionCounter } from "@/components/region-counter";
import { getAgentCount } from "@/lib/agents";
import { getSession } from "@/lib/auth";
import { getT } from "@/lib/prefs";
import { getCounts, getFavouriteKeys, getLatest, getLiveAuctions } from "@/lib/listings";
import { getRegionCounts } from "@/lib/regions";

export default async function HomePage() {
  const session = await getSession();
  const { t } = await getT();
  const [properties, cars, auctions, counts, favourites, regions, agentCount] = await Promise.all([
    getLatest("property", 4),
    getLatest("car", 4),
    getLiveAuctions(4),
    getCounts(),
    getFavouriteKeys(session?.id),
    getRegionCounts(),
    getAgentCount().catch(() => 0),
  ]);

  const pills = [
    { label: t("pillProperties"), value: counts.properties, icon: Building2, href: "/properties" },
    { label: t("pillCars"), value: counts.cars, icon: CarFront, href: "/cars" },
    { label: t("pillAuctions"), value: auctions.length, icon: Gavel, href: "/auctions" },
    { label: t("pillAgents"), value: agentCount, icon: UserCheck, href: "/properties#agents-property" },
  ];

  const steps = [
    { title: t("step1"), text: t("step1Text") },
    { title: t("step2"), text: t("step2Text") },
    { title: t("step3"), text: t("step3Text") },
    { title: t("step4"), text: t("step4Text") },
  ];

  const sections = [
    { eyebrow: t("justListed"), title: t("latestProperties"), href: "/properties", items: properties },
    { eyebrow: t("justListed"), title: t("latestCars"), href: "/cars", items: cars },
    { eyebrow: t("endingSoon"), title: t("liveAuctions"), href: "/auctions", items: auctions },
  ];

  return (
    <div className="campus-container space-y-9 py-6 sm:space-y-12 sm:py-8">
      <header className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
           {/*  <h1 className="dot-title text-2xl sm:text-[29px] font-semibold">{session ? `${t("welcome")}, ${session.name.split(" ")[0]}` : t("welcomeTo")}</h1>*/}
            <p className="mt-1 text-sm text-muted">{t("homeSub")}</p>
          </div>
          <form action="/properties" className="flex w-full max-w-sm items-center gap-2 rounded-full border border-line bg-surface px-4 sm:w-auto">
            <Search className="size-4 text-muted" />
            <input name="q" placeholder={t("searchPlaceholder")} aria-label={t("search")} className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none placeholder:text-muted/70" />
          </form>
        </div>

        <ul className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-2.5">
          {pills.map(({ label, value, icon: Icon, href }) => (
            <li key={label}>
              <Link href={href} className="flex items-center gap-2 rounded-full border border-line bg-cream py-1.5 pl-1.5 pr-3 sm:inline-flex sm:gap-2.5 sm:py-2 sm:pl-2 sm:pr-5 transition hover:border-indigo-500/50 hover:bg-surface">
                <span className="grid size-8 place-items-center rounded-full bg-indigo-600 text-white"><Icon className="size-4" /></span>
                <span className="text-base font-bold tabular-nums leading-none sm:text-lg">{value}</span>
                <span className="truncate text-[11px] font-semibold text-muted sm:text-xs">{label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </header>

      <section aria-labelledby="how">
        <p className="eyebrow">{t("agentService")}</p>
        <h2 id="how" className="mt-1 text-xl font-semibold">{t("howTitle")}</h2>
        <ol className="mt-4 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 lg:grid-cols-4 lg:gap-4">
          {steps.map(({ title, text }, i) => (
            <li key={title} className="relative flex items-start gap-3.5 overflow-hidden rounded-2xl border border-line bg-cream p-4 transition hover:border-indigo-500/40 sm:p-5 lg:flex-col lg:gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-indigo-600 text-sm font-bold text-white shadow-sm shadow-indigo-600/30">{i + 1}</span>
              <div className="min-w-0">
                <h3 className="text-[15px] font-semibold leading-tight">{title}</h3>
                <p className="mt-1 text-[13px] leading-relaxed text-muted">{text}</p>
              </div>
              <span aria-hidden className="pointer-events-none absolute -right-1 -top-3 select-none text-6xl font-black text-indigo-500/[0.07]">{i + 1}</span>
            </li>
          ))}
        </ol>
      </section>

      <RegionCounter data={regions} />

      {sections.map(
        (s) =>
          s.items.length > 0 && (
            <section key={s.title}>
              <div className="mb-4 flex items-end justify-between">
                <div>
                  <p className="eyebrow">{s.eyebrow}</p>
                  <h2 className="mt-1 text-xl font-semibold">{s.title}</h2>
                </div>
                <Link href={s.href} className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-500 hover:underline">
                  {t("viewAll")} <ArrowRight className="size-4" />
                </Link>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
                {s.items.map((l) => (
                  <ListingCard key={`${l.kind}:${l.id}`} listing={l} saved={favourites.has(`${l.kind}:${l.id}`)} />
                ))}
              </div>
            </section>
          ),
      )}
    </div>
  );
}
