"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Gavel, Loader2, ShieldCheck, Timer, Trophy } from "lucide-react";
import { placeBid } from "@/app/actions/auctions";
import { formatPrice, timeAgo, timeLeft } from "@/lib/format";
import type { AuctionInfo, BidView } from "@/lib/auctions";

const minimumBid = (a: AuctionInfo) => (a.bidCount === 0 ? a.startingBid : a.currentBid + a.minIncrement);

export function AuctionPanel({ initial, initialBids, userId, path }: { initial: AuctionInfo; initialBids: BidView[]; userId: string | null; path: string }) {
  const [auction, setAuction] = useState(initial);
  const [bids, setBids] = useState(initialBids);
  const [now, setNow] = useState(() => Date.now());
  const [amount, setAmount] = useState(String(minimumBid(initial)));
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  const live = auction.status === "live" && new Date(auction.endsAt).getTime() > now;
  const isSeller = userId === auction.sellerId;
  const leading = userId !== null && userId === auction.highBidderId;
  const won = userId !== null && userId === auction.winnerId;

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/auctions/${initial.id}`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { auction: AuctionInfo; bids: BidView[] };
      setAuction((prev) => {
        // Move the suggested bid forward only if the user hasn't already typed something higher
        if (data.auction.currentBid !== prev.currentBid) setAmount((cur) => (Number(cur) < minimumBid(data.auction) ? String(minimumBid(data.auction)) : cur));
        return data.auction;
      });
      setBids(data.bids);
    } catch {
      /* transient network failure; next tick retries */
    }
  }, [initial.id]);

  // One ticker drives the countdown, polls every 5s, and polls every second once the end time passes so settlement shows promptly
  useEffect(() => {
    let tick = 0;
    const t = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (auction.status !== "live") return;
      tick += 1;
      if (tick % 5 === 0 || new Date(auction.endsAt).getTime() <= n) void refresh();
    }, 1000);
    return () => clearInterval(t);
  }, [auction.status, auction.endsAt, refresh]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await placeBid(auction.id, Number(amount));
      if (res.ok) {
        setAuction(res.auction);
        setAmount(String(minimumBid(res.auction)));
        void refresh();
      } else if (res.error === "auth") {
        router.push(`/login?next=${encodeURIComponent(path)}`);
      } else {
        setError(res.error);
        void refresh();
      }
    });
  };

  const money = (n: number) => formatPrice(n, auction.currency);
  const left = timeLeft(auction.endsAt, now);
  const urgent = live && new Date(auction.endsAt).getTime() - now < 3_600_000;

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-3 text-white">
        <span className="inline-flex items-center gap-2 text-sm font-semibold"><Gavel className="size-4" /> {live ? "Live auction" : "Auction ended"}</span>
        <span className={`inline-flex items-center gap-1.5 text-sm font-bold tabular-nums ${urgent ? "animate-pulse" : ""}`}><Timer className="size-4" /> {left}</span>
      </div>
      <div className="space-y-4 p-5">
        <div>
          <p className="text-xs font-medium text-muted">{auction.bidCount > 0 ? "Current bid" : "Starting bid"}</p>
          <p className="font-display text-3xl font-semibold tracking-tight">{money(auction.bidCount > 0 ? auction.currentBid : auction.startingBid)}</p>
          <p className="mt-1 text-xs text-muted">
            {auction.bidCount} bid{auction.bidCount === 1 ? "" : "s"}
            {auction.hasReserve && <> · <span className={auction.reserveMet ? "font-semibold text-emerald-600 dark:text-emerald-400" : ""}>{auction.reserveMet ? "Reserve met" : "Reserve not met"}</span></>}
          </p>
        </div>

        {live && !isSeller && (
          <form onSubmit={submit} className="space-y-3">
            {leading && <p className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-300"><ShieldCheck className="size-4" /> You&apos;re the highest bidder</p>}
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted">Your bid (min {money(minimumBid(auction))})</span>
              <input type="number" inputMode="decimal" min={minimumBid(auction)} step="any" value={amount} onChange={(e) => setAmount(e.target.value)} className="field !text-base font-semibold" required />
            </label>
            {error && <p role="alert" className="error-box">{error}</p>}
            <button disabled={pending || leading} className="btn-primary w-full">
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Gavel className="size-4" />} Place bid
            </button>
            <p className="text-center text-xs text-muted">Bids in the final 2 minutes extend the auction.</p>
          </form>
        )}
        {live && isSeller && <p className="rounded-xl bg-line/50 px-3 py-2 text-sm text-muted">This is your auction. Bids appear here in real time.</p>}
        {!live && (
          <p className="flex items-center gap-2 rounded-xl bg-line/50 px-3 py-2 text-sm font-medium">
            {auction.status === "sold" ? <><Trophy className="size-4 text-amber-500" /> {won ? "You won this auction!" : `Sold for ${money(auction.currentBid)}`}</> : "Ended without a sale."}
          </p>
        )}

        {bids.length > 0 && (
          <div className="border-t border-line pt-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Bid history</h3>
            <ul className="space-y-1.5 text-sm">
              {bids.slice(0, 6).map((b, i) => (
                <li key={b.id} className="flex items-center justify-between">
                  <span className={i === 0 ? "font-semibold" : "text-muted"}>{b.bidderId === userId ? "You" : b.bidder}</span>
                  <span className="flex items-baseline gap-2"><span className="text-xs text-muted">{timeAgo(b.at, now)}</span><span className={`tabular-nums ${i === 0 ? "font-semibold" : ""}`}>{money(b.amount)}</span></span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
