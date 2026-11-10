import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Crown, ShieldCheck } from "lucide-react";
import { ListingCard } from "@/components/listing-card";
import { getAgentProfile, type Grade } from "@/lib/agents";
import { getSession } from "@/lib/auth";
import { intlLocale } from "@/lib/i18n";
import { getAgentListings, getFavouriteKeys } from "@/lib/listings";
import { getT } from "@/lib/prefs";

type Props = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

const tone: Record<Grade, string> = {
  "A+": "bg-amber-400/20 text-amber-700 ring-amber-500/40 dark:text-amber-300",
  A: "bg-indigo-500/15 text-indigo-700 ring-indigo-500/40 dark:text-indigo-300",
  "B+": "bg-emerald-500/15 text-emerald-700 ring-emerald-500/40 dark:text-emerald-300",
  B: "bg-sky-500/15 text-sky-700 ring-sky-500/40 dark:text-sky-300",
  C: "bg-slate-500/15 text-slate-600 ring-slate-500/30 dark:text-slate-300",
  D: "bg-slate-500/10 text-slate-500 ring-slate-500/20",
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const profile = await getAgentProfile((await params).id);
  return { title: profile ? `${profile.name} · Seller profile` : "Seller not found" };
}

export default async function AgentProfilePage({ params }: Props) {
  const { id } = await params;
  const [session, { t, locale }, profile] = await Promise.all([getSession(), getT(), getAgentProfile(id)]);
  if (!profile) notFound();
  const [listings, favourites] = await Promise.all([getAgentListings(id), getFavouriteKeys(session?.id)]);

  const stats = [
    [t("profileListings"), profile.listings],
    [t("profileSales"), profile.sales],
    [t("profileEngagement"), profile.engagement],
    [t("profileResponse"), profile.conversations ? `${Math.round(profile.responsiveness * 100)}%` : "—"],
  ];
  const labels = { listings: t("profileListings"), sales: t("profileSales"), engagement: t("profileEngagement"), responsiveness: t("profileResponse") };
  const since = profile.memberSince ? new Date(profile.memberSince).toLocaleDateString(intlLocale(locale), { month: "long", year: "numeric" }) : null;

  return (
    <div className="campus-container space-y-8 py-6 sm:space-y-10 sm:py-8">
      <Link href="/" className="inline-flex items-center gap-1 text-sm font-medium text-muted hover:text-fg">
        <ChevronLeft className="size-4" /> {t("profileBack")}
      </Link>

      <header className="card space-y-5 p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-4">
          <span className="grid size-16 shrink-0 place-items-center rounded-full bg-[#1d2b41] text-2xl font-semibold text-white sm:size-20 sm:text-3xl">{profile.name.charAt(0).toUpperCase()}</span>
          <div className="min-w-0 flex-1">
            <p className="eyebrow">{t("profileEyebrow")}</p>
            <h1 className="mt-1 flex flex-wrap items-center gap-2 text-2xl font-semibold sm:text-3xl">
              <span className="break-words">{profile.name}</span>
              {profile.grade === "A+" && <Crown className="size-5 text-amber-500" aria-hidden />}
            </h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
              {profile.verified && <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><ShieldCheck className="size-4" /> {t("profileVerified")}</span>}
              {since && <span>{t("profileMemberSince", { date: since })}</span>}
              {profile.accountType && <span className="capitalize">{profile.accountType}</span>}
              {profile.agency && <span className="font-medium text-fg">{profile.agency}</span>}
              {profile.yearsExperience != null && <span>{profile.yearsExperience} yrs experience</span>}
            </p>
            {profile.bio && <p className="mt-3 max-w-2xl text-sm leading-relaxed">{profile.bio}</p>}
            {(profile.regions.length > 0 || profile.specialties.length > 0) && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {[...profile.regions, ...profile.specialties].map((x) => <span key={x} className="rounded-full border border-line px-2.5 py-0.5 text-xs text-muted">{x}</span>)}
              </div>
            )}
          </div>
          <div className="text-center">
            <span className={`inline-block rounded-lg px-3 py-1.5 text-2xl font-extrabold ring-1 ${tone[profile.grade]}`}>{profile.grade}</span>
            <p className="mt-1 text-xs text-muted">{profile.score}/100</p>
          </div>
        </div>

        <div className="h-2 overflow-hidden rounded-full bg-line" role="meter" aria-valuenow={profile.score} aria-valuemin={0} aria-valuemax={100} aria-label={t("profileScore")}>
          <div className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-indigo-600" style={{ width: `${profile.score}%` }} />
        </div>

        <dl className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
          {stats.map(([label, value]) => (
            <div key={label} className="rounded-xl bg-bg px-3 py-3 text-center">
              <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
              <dt className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-muted">{label}</dt>
            </div>
          ))}
        </dl>

        <details className="text-sm">
          <summary className="cursor-pointer font-medium text-muted hover:text-fg">{t("profileBreakdown")}</summary>
          <ul className="mt-3 space-y-2.5">
            {profile.breakdown.map((b) => (
              <li key={b.key}>
                <div className="flex justify-between text-xs">
                  <span className="font-medium">{labels[b.key]}</span>
                  <span className="tabular-nums text-muted">{b.points}/{b.max}</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line">
                  <div className="h-full rounded-full bg-indigo-500" style={{ width: `${(b.points / b.max) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">{profile.byKind.properties} {t("profileProperties").toLowerCase()} · {profile.byKind.cars} {t("profileCars").toLowerCase()}</p>
        </details>
      </header>

      <section aria-labelledby="agent-listings">
        <h2 id="agent-listings" className="mb-4 text-xl font-semibold">{t("profileListingsTitle", { name: profile.name })}</h2>
        {listings.length === 0 ? (
          <p className="card p-6 text-center text-sm text-muted">{t("profileNoListings")}</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
            {listings.map((l) => (
              <ListingCard key={`${l.kind}:${l.id}`} listing={l} saved={favourites.has(`${l.kind}:${l.id}`)} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
