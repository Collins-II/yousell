"use client";

import { usePrefs } from "./prefs-provider";

/** Shows a listing price in the visitor's chosen currency; hovering reveals the original amount. */
export function Price({ amount, currency, className }: { amount: number; currency: string; className?: string }) {
  const { money, currency: chosen } = usePrefs();
  const converted = chosen && chosen !== currency;
  return (
    <span className={className} title={converted ? `Listed at ${currency} ${Math.round(amount).toLocaleString()}` : undefined}>
      {converted ? "≈ " : ""}
      {money(amount, currency)}
    </span>
  );
}
