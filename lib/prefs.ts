import "server-only";
import { cookies, headers } from "next/headers";
import { DEFAULT_LOCALE, isLocale, translate, type Locale, type T } from "./i18n";
import { isCurrency, type CurrencyPref } from "./currency";

export const LANG_COOKIE = "ys_lang";
export const CUR_COOKIE = "ys_cur";

export async function getPrefs(): Promise<{ locale: Locale; currency: CurrencyPref }> {
  const jar = await cookies();
  const lang = jar.get(LANG_COOKIE)?.value;
  const cur = jar.get(CUR_COOKIE)?.value;

  let locale: Locale = DEFAULT_LOCALE;
  if (isLocale(lang)) locale = lang;
  else {
    const accept = (await headers()).get("accept-language") ?? "";
    const first = accept.split(",").map((p) => p.split(";")[0].trim().slice(0, 2).toLowerCase()).find(isLocale);
    if (first) locale = first;
  }
  return { locale, currency: isCurrency(cur) ? cur : "" };
}

export async function getT(): Promise<{ t: T; locale: Locale }> {
  const { locale } = await getPrefs();
  return { locale, t: (key, vars) => translate(locale, key, vars) };
}
