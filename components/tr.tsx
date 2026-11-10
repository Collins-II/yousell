"use client";

import type { Key } from "@/lib/i18n";
import { usePrefs } from "./prefs-provider";

/** Translates a key inside server-rendered markup. */
export function Tr({ k, vars }: { k: Key; vars?: Record<string, string | number> }) {
  return <>{usePrefs().t(k, vars)}</>;
}