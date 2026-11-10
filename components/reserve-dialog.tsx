"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, ShieldCheck, Smartphone, X } from "lucide-react";
import { abandonPayment, startReservationPayment } from "@/app/actions/reservations";
import { NETWORKS, NETWORK_KEYS, detectNetwork, formatKwacha, normalizeMsisdn, type Network } from "@/lib/momo";

type Step = "summary" | "details" | "waiting" | "success" | "failed";
type PollResult = { status: string; reason: string | null; reference: string; reservationStatus: string };

type Props = {
  kind: "property" | "car";
  listingId: string;
  title: string;
  type: "sale" | "rent";
  fee: number;
  basis: string;
  sandbox: boolean;
};

const newKey = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}${Math.random().toString(36).slice(2)}`).replace(/-/g, "").padEnd(16, "0");

export function ReserveDialog({ kind, listingId, title, type, fee, basis, sandbox }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [step, setStep] = useState<Step>("summary");
  const [network, setNetwork] = useState<Network>("mtn");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [paymentId, setPaymentId] = useState<string | null>(null);
  const [masked, setMasked] = useState("");
  const [result, setResult] = useState<PollResult | null>(null);
  const [seconds, setSeconds] = useState(0);
  const key = useRef(newKey());

  const msisdn = normalizeMsisdn(phone);
  const detected = msisdn ? detectNetwork(msisdn) : null;
  // The number decides the network once it's recognised, so the two can never disagree.
  const chosen: Network = detected ?? network;

  const open = () => {
    setStep("summary");
    setError("");
    setResult(null);
    key.current = newKey();
    ref.current?.showModal();
  };

  const close = useCallback(() => {
    if (step === "waiting" && paymentId) void abandonPayment(paymentId);
    ref.current?.close();
  }, [step, paymentId]);

  useEffect(() => {
    if (step !== "waiting" || !paymentId) return;
    const started = Date.now();
    const tick = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    const poll = setInterval(async () => {
      try {
        const res = await fetch(`/api/payments/${paymentId}`, { cache: "no-store" });
        if (!res.ok) return;
        const data: PollResult = await res.json();
        if (data.status === "pending") return;
        setResult(data);
        setStep(data.status === "succeeded" ? "success" : "failed");
      } catch {
        /* network blip: keep polling */
      }
    }, 2000);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [step, paymentId]);

  async function pay() {
    setError("");
    if (!msisdn) return setError("Enter a valid Zambian mobile number, for example 097 123 4567.");
    setBusy(true);
    const res = await startReservationPayment({ kind, listingId, network: chosen, phone, key: key.current });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    setPaymentId(res.paymentId);
    setMasked(res.phone);
    setSeconds(0);
    setStep("waiting");
  }

  function retry() {
    key.current = newKey();
    setError("");
    setStep("details");
  }

  return (
    <>
      <button type="button" onClick={open} className="btn-primary w-full">
        <Smartphone className="size-4" /> Reserve for {formatKwacha(fee)}
      </button>

      <dialog
        ref={ref}
        onClose={() => {
          if (step === "success") window.location.reload();
        }}
        onClick={(e) => e.target === ref.current && step !== "waiting" && close()}
        className="m-0 mt-auto w-full max-w-none rounded-t-2xl bg-transparent p-0 backdrop:bg-black/50 backdrop:backdrop-blur-sm sm:m-auto sm:max-w-md sm:rounded-2xl"
      >
        <div className="max-h-[92dvh] overflow-y-auto rounded-t-2xl border border-line bg-surface p-6 text-fg sm:rounded-2xl">
          <div className="mb-4 flex items-center justify-between">
            <p className="eyebrow">Agent reservation</p>
            <button type="button" onClick={close} aria-label="Close" className="rounded-md p-1 text-muted hover:bg-line/60"><X className="size-4" /></button>
          </div>

          {step === "summary" && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">Reserve this {kind === "car" ? "car" : "property"}</h2>
                <p className="mt-1 text-sm text-muted">{title}</p>
              </div>
              <div className="rounded-xl border border-line bg-bg p-4">
                <div className="flex items-end justify-between">
                  <span className="text-sm text-muted">Reservation fee</span>
                  <span className="text-3xl font-semibold tracking-tight">{formatKwacha(fee)}</span>
                </div>
                <p className="mt-1 text-xs text-muted">{basis} · {type === "rent" ? "for rent" : "for sale"}</p>
              </div>
              <ul className="space-y-2 text-sm text-muted">
                <li className="flex gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-indigo-500" /> The item is held for you while the seller or our agent confirms.</li>
                <li className="flex gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-indigo-500" /> Fully refunded if the seller declines or you cancel before confirmation.</li>
                <li className="flex gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-indigo-500" /> Your number is never stored; only a masked receipt is kept.</li>
              </ul>
              <button type="button" onClick={() => setStep("details")} className="btn-primary w-full">Continue</button>
            </div>
          )}

          {step === "details" && (
            <div className="space-y-5">
              <h2 className="text-xl font-semibold tracking-tight">Pay with mobile money</h2>
              <div role="radiogroup" aria-label="Network" className="grid grid-cols-3 gap-2">
                {NETWORK_KEYS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={chosen === n}
                    onClick={() => setNetwork(n)}
                    className={`rounded-xl border p-3 text-center text-xs font-semibold transition ${chosen === n ? "border-indigo-500 ring-2 ring-indigo-500/30" : "border-line hover:border-indigo-400"}`}
                  >
                    <span className="mx-auto mb-1.5 block size-6 rounded-full" style={{ background: NETWORKS[n].color }} />
                    {NETWORKS[n].short}
                  </button>
                ))}
              </div>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Mobile number</span>
                <input
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="097 123 4567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="field"
                />
                {phone && !msisdn && <span className="mt-1 block text-xs text-muted">Use a Zambian number like 097 123 4567.</span>}
                {detected && detected !== network && <span className="mt-1 block text-xs text-muted">Detected {NETWORKS[detected].label} from the number.</span>}
              </label>
              {sandbox && (
                <p className="rounded-lg border border-dashed border-line p-3 text-xs text-muted">
                  <b>Test mode.</b> No real money moves. Numbers ending <b>00</b> fail (insufficient funds), <b>99</b> never approve, anything else succeeds after ~5s.
                </p>
              )}
              {error && <p role="alert" className="flex gap-2 text-sm text-red-600"><AlertCircle className="mt-0.5 size-4 shrink-0" /> {error}</p>}
              <div className="flex gap-2">
                <button type="button" onClick={() => setStep("summary")} className="btn-ghost">Back</button>
                <button type="button" disabled={busy} onClick={pay} className="btn-primary flex-1">
                  {busy ? <Loader2 className="size-4 animate-spin" /> : null} Pay {formatKwacha(fee)}
                </button>
              </div>
            </div>
          )}

          {step === "waiting" && (
            <div className="space-y-5 py-4 text-center" aria-live="polite">
              <div className="mx-auto grid size-16 place-items-center rounded-full bg-indigo-500/10">
                <Smartphone className="size-7 animate-pulse text-indigo-500" />
              </div>
              <div>
                <h2 className="text-xl font-semibold tracking-tight">Approve on your phone</h2>
                <p className="mt-1 text-sm text-muted">We sent a {formatKwacha(fee)} request to {masked}. Enter your PIN to approve.</p>
              </div>
              <p className="text-xs text-muted">Waiting… {seconds}s</p>
              <button type="button" onClick={() => { void abandonPayment(paymentId!); setStep("failed"); setResult({ status: "failed", reason: "You cancelled the payment.", reference: "", reservationStatus: "" }); }} className="btn-ghost">Cancel</button>
            </div>
          )}

          {step === "success" && (
            <div className="space-y-5 py-2 text-center">
              <CheckCircle2 className="mx-auto size-14 text-emerald-500" />
              <div>
                <h2 className="text-xl font-semibold tracking-tight">Reserved</h2>
                <p className="mt-1 text-sm text-muted">{formatKwacha(fee)} paid. The seller has been notified to confirm.</p>
              </div>
              <div className="rounded-xl border border-line bg-bg p-3 text-sm">
                <span className="text-muted">Reference </span><b className="font-mono">{result?.reference}</b>
              </div>
              <Link href="/reservations" className="btn-primary w-full">View my reservations</Link>
            </div>
          )}

          {step === "failed" && (
            <div className="space-y-5 py-2 text-center">
              <AlertCircle className="mx-auto size-14 text-red-500" />
              <div>
                <h2 className="text-xl font-semibold tracking-tight">Payment not completed</h2>
                <p className="mt-1 text-sm text-muted">{result?.reason ?? "Something went wrong."} You haven&apos;t been charged.</p>
              </div>
              <button type="button" onClick={retry} className="btn-primary w-full">Try again</button>
            </div>
          )}
        </div>
      </dialog>
    </>
  );
}
