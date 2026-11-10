"use server";

import { cookies } from "next/headers";
import { isLocale } from "@/lib/i18n";
import { isCurrency } from "@/lib/currency";
import { CUR_COOKIE, LANG_COOKIE } from "@/lib/prefs";

export async function setPrefs(locale: string, currency: string) {
  const jar = await cookies();
  const opts = { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" as const, httpOnly: false };
  if (isLocale(locale)) jar.set(LANG_COOKIE, locale, opts);
  if (currency === "" || isCurrency(currency)) jar.set(CUR_COOKIE, currency, opts);
}
