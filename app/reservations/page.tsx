import Link from "next/link";
import { Clock } from "lucide-react";
import { requireSession } from "@/lib/auth";
import { formatKwacha } from "@/lib/momo";
import { getReservationLists, isAgent, type ReservationView } from "@/lib/reservations";
import { ReservationActions } from "@/components/reservation-actions";

export const metadata = { title: "Reservations" };
export const dynamic = "force-dynamic";

const tone: Record<string, string> = {
  pending_payment: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  held: "bg-indigo-500/15 text-indigo-600 dark:text-indigo-300",
  confirmed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  completed: "bg-emerald-600 text-white",
  cancelled: "bg-slate-500/15 text-slate-600 dark:text-slate-300",
  declined: "bg-rose-500/15 text-rose-600 dark:text-rose-300",
  expired: "bg-slate-500/15 text-slate-600",
};
const statusLabel: Record<string, string> = { pending_payment: "Awaiting payment", held: "Paid · awaiting confirmation", confirmed: "Confirmed", completed: "Completed", cancelled: "Cancelled", declined: "Declined", expired: "Expired" };

function Row({ r, role }: { r: ReservationView; role: "buyer" | "seller" | "agent" }) {
  const actions: ("confirm" | "decline" | "cancel" | "complete" | "refund")[] = [];
  if (role !== "buyer") {
    if (r.status === "held") actions.push("confirm", "decline");
    if (r.status === "confirmed") actions.push("complete", "decline");
  }
  if (role !== "seller" && (r.status === "held" || (r.status === "confirmed" && role === "agent"))) actions.push("cancel");
  if (role === "agent" && ["cancelled", "declined"].includes(r.status) && r.paymentStatus === "succeeded") actions.push("refund");

  return (
    <li className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={r.href} className="font-semibold hover:underline">{r.listingTitle}</Link>
          <p className="mt-0.5 text-xs text-muted">
            <span className="font-mono">{r.reference}</span> · for {r.type} · {role === "buyer" ? `seller ${r.sellerName}` : `buyer ${r.buyerName}`}
          </p>
        </div>
        <div className="text-right">
          <span className={`badge ${tone[r.status]}`}>{statusLabel[r.status]}</span>
          <p className="mt-1 text-sm font-semibold">
            {formatKwacha(r.feeAmount)}
            {r.paymentStatus === "refunded" && <span className="ml-1.5 text-xs font-medium text-muted">refunded</span>}
          </p>
        </div>
      </div>
      {r.status === "pending_payment" && r.holdExpiresAt && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300"><Clock className="size-3.5" /> Hold expires {new Date(r.holdExpiresAt).toLocaleTimeString()}</p>
      )}
      <details className="mt-3 text-xs text-muted">
        <summary className="cursor-pointer font-medium">Timeline</summary>
        <ol className="mt-2 space-y-1 border-l border-line pl-3">
          {r.history.map((h, i) => (
            <li key={i}>
              <span className="font-medium text-fg">{h.event.replace(/_/g, " ")}</span> · {new Date(h.at).toLocaleString()} · {h.by}{h.note ? ` — ${h.note}` : ""}
            </li>
          ))}
        </ol>
      </details>
      {actions.length > 0 && (
        <div className="mt-4 border-t border-line pt-4">
          <ReservationActions id={r.id} actions={actions} />
        </div>
      )}
    </li>
  );
}

function Section({ title, hint, items, role }: { title: string; hint: string; items: ReservationView[]; role: "buyer" | "seller" | "agent" }) {
  return (
    <section>
      <h2 className="text-lg font-semibold">{title} <span className="text-sm font-normal text-muted">({items.length})</span></h2>
      <p className="mb-3 text-sm text-muted">{hint}</p>
      {items.length === 0 ? <p className="card p-6 text-center text-sm text-muted">Nothing here yet.</p> : <ul className="space-y-3">{items.map((r) => <Row key={r.id} r={r} role={role} />)}</ul>}
    </section>
  );
}

export default async function ReservationsPage() {
  const session = await requireSession("/reservations");
  const agent = await isAgent(session.id);
  const { mine, incoming, all } = await getReservationLists(session.id, agent);

  return (
    <div className="mx-auto max-w-4xl space-y-10 px-4 py-8 sm:px-6">
      <header>
        <p className="eyebrow">Agent service</p>
        <h1 className="dot-title mt-1.5 text-[29px] font-semibold">Reservations</h1>
        <p className="mt-1 text-sm text-muted">Track fees, confirmations and refunds for every reservation.</p>
      </header>
      <Section title="My reservations" hint="Items you've reserved." items={mine} role="buyer" />
      <Section title="Incoming" hint="Buyers who reserved your listings. Confirm or decline within a reasonable time." items={incoming} role="seller" />
      {agent && <Section title="All reservations (agent)" hint="Platform-wide view. You can confirm, cancel, close and retry refunds." items={all} role="agent" />}
    </div>
  );
}
