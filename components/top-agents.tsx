import { Crown, ShieldCheck } from "lucide-react";
import { getTopAgents, type Grade, type Kind } from "@/lib/agents";
import { getT } from "@/lib/prefs";

const tone: Record<Grade, string> = {
  "A+": "bg-amber-400/20 text-amber-700 ring-amber-500/40 dark:text-amber-300",
  A: "bg-indigo-500/15 text-indigo-700 ring-indigo-500/40 dark:text-indigo-300",
  "B+": "bg-emerald-500/15 text-emerald-700 ring-emerald-500/40 dark:text-emerald-300",
  B: "bg-sky-500/15 text-sky-700 ring-sky-500/40 dark:text-sky-300",
  C: "bg-slate-500/15 text-slate-600 ring-slate-500/30 dark:text-slate-300",
  D: "bg-slate-500/10 text-slate-500 ring-slate-500/20",
};

export async function TopAgents({ kind }: { kind: Kind }) {
  const [{ t }, agents] = await Promise.all([getT(), getTopAgents(kind, 4)]);

  return (
    <section aria-labelledby={`agents-${kind}`} className="mb-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="eyebrow">{t("agentsEyebrow")}</p>
          <h2 id={`agents-${kind}`} className="mt-1 text-xl font-semibold">{kind === "property" ? t("agentsTitleProperty") : t("agentsTitleCar")}</h2>
        </div>
        <p className="max-w-md text-xs text-muted">{t("agentsSub")}</p>
      </div>

      {agents.length === 0 ? (
        <p className="card p-5 text-sm text-muted">{t("agentNone")}</p>
      ) : (
        <ol className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {agents.map((a, i) => (
            <li key={a.id} className="card relative overflow-hidden p-3 sm:p-4">
              {i === 0 && <Crown className="absolute right-1.5 top-1.5 size-3 sm:right-3 sm:top-3 sm:size-4 text-amber-500" aria-hidden />}
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="relative grid size-9 shrink-0 sm:size-11 place-items-center rounded-full bg-[#1d2b41] text-base font-semibold text-white">
                  {a.name.charAt(0).toUpperCase()}
                  <span className="absolute -bottom-1 -left-1 grid size-5 place-items-center rounded-full border-2 border-surface bg-indigo-600 text-[10px] font-bold">{i + 1}</span>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{a.name}</p>
                  <p className="flex items-center gap-1 text-[11px] text-muted">
                    {a.verified ? <><ShieldCheck className="size-3 text-emerald-500" /> {t("agentVerified")}</> : `${t("agentScore")} ${a.score}/100`}
                  </p>
                </div>
                <span className={`rounded-md px-1.5 py-0.5 text-xs font-extrabold sm:px-2 sm:py-1 sm:text-sm ring-1 ${tone[a.grade]}`} title={t("agentGrade")}>{a.grade}</span>
              </div>

              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line" role="meter" aria-valuenow={a.score} aria-valuemin={0} aria-valuemax={100} aria-label={t("agentScore")}>
                <div className="h-full rounded-full bg-gradient-to-r from-indigo-400 to-indigo-600" style={{ width: `${a.score}%` }} />
              </div>

              <dl className="mt-2 grid grid-cols-3 gap-1 text-center sm:mt-3 sm:gap-2">
                {[
                  [t("agentListings"), a.listings],
                  [t("agentSales"), a.sales],
                  [t("agentEngagement"), a.engagement],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg bg-bg px-1 py-2">
                    <dd className="text-base font-semibold tabular-nums">{value}</dd>
                    <dt className="truncate text-[8px] font-medium uppercase tracking-wide text-muted sm:text-[10px]">{label}</dt>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
