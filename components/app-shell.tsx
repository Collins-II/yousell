"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { ArrowUpRight, BadgeCheck, Building2, CarFront, Gavel, Home, LogOut, Menu, X } from "lucide-react";
import { logout } from "@/app/actions/auth";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";
import { PrefsMenu } from "./prefs-menu";
import { usePrefs } from "./prefs-provider";

type User = { name: string; email: string } | null;

export function AppShell({ user, unread, pending, children }: { user: User; unread: number; pending: number; children: React.ReactNode }) {
  const pathname = usePathname();
  const { t } = usePrefs();
  const [open, setOpen] = useState(false);

  const links = [
    { href: "/properties", label: t("properties") },
    { href: "/cars", label: t("cars") },
    { href: "/auctions", label: t("auctions") },
    { href: "/map", label: t("map") },
    { href: "/reservations", label: t("reservations"), badge: pending },
    { href: "/messages", label: t("messages"), badge: unread },
    { href: "/favourites", label: t("favourites") },
  ];

  const tabs = [
    { href: "/", label: t("home"), icon: Home },
    { href: "/properties", label: t("properties"), icon: Building2 },
    { href: "/cars", label: t("cars"), icon: CarFront },
    { href: "/auctions", label: t("auctions"), icon: Gavel },
    { href: "/reservations", label: t("reserved"), icon: BadgeCheck },
  ];

  const active = (href: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`));
  const hideTabs = pathname === "/login" || pathname === "/register";

  return (
    <div className="flex min-h-dvh flex-col pb-16 lg:pb-0">
      <header className="relative z-40 border-b border-line bg-surface">
        <div className="border-b border-line bg-cream">
          <div className="campus-container flex items-center justify-between gap-3 py-2 text-[10px] font-semibold text-muted">
            <span>
              YOUSELL <span className="mx-2 opacity-50">/</span> {t("strip")}
            </span>
            <span className="hidden sm:block">Lusaka, Zambia</span>
          </div>
        </div>

        <div className="campus-container flex h-20 items-center justify-between gap-4">
          <Logo />

          <nav aria-label="Main" className="hidden items-center gap-6 xl:flex">
            {links.map(({ href, label, badge }) => (
              <Link
                key={href}
                href={href}
                aria-current={active(href) ? "page" : undefined}
                className={`inline-flex items-center gap-1.5 text-xs font-semibold transition hover:text-indigo-600 ${active(href) ? "text-indigo-600" : "text-muted"}`}
              >
                {label}
                {badge ? <span className="grid min-w-4 place-items-center rounded-full bg-indigo-600 px-1 text-[10px] font-bold leading-4 text-white">{badge > 9 ? "9+" : badge}</span> : null}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <PrefsMenu />
            <ThemeToggle />
            {user ? (
              <>
                <Link href="/dashboard" className="btn-primary hidden sm:inline-flex">
                  {user.name} <ArrowUpRight className="size-4" />
                </Link>
                <form action={logout} className="hidden sm:block">
                  <button className="grid size-10 place-items-center rounded border border-line text-muted hover:text-fg" aria-label={t("signOut")} title={t("signOut")}>
                    <LogOut className="size-4" />
                  </button>
                </form>
              </>
            ) : (
              <div className="hidden gap-2 sm:flex">
                <Link href="/login" className="btn-ghost !py-2.5 !text-xs">{t("signIn")}</Link>
                <Link href="/register" className="btn-primary">
                  {t("register")} <ArrowUpRight className="size-4" />
                </Link>
              </div>
            )}
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              className="grid size-11 place-items-center rounded-lg border border-line xl:hidden"
            >
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>

        {open && (
          <nav aria-label="More" className="absolute inset-x-0 top-full border-b border-line bg-surface px-6 pb-5 shadow-lg xl:hidden">
            {[...links, { href: "/sell", label: t("listItem") }, { href: "/dashboard", label: t("dashboard") }, { href: "/pricing", label: t("pricing") }].map(({ href, label }) => (
              <Link key={href} href={href} onClick={() => setOpen(false)} className="flex items-center justify-between border-b border-line py-3.5 text-sm font-semibold">
                {label}
                <ArrowUpRight className="size-4 text-muted" />
              </Link>
            ))}
            <div className="mt-4 flex gap-2">
              {user ? (
                <form action={logout} className="w-full">
                  <button className="btn-ghost w-full">{t("signOut")} ({user.name})</button>
                </form>
              ) : (
                <>
                  <Link href="/login" onClick={() => setOpen(false)} className="btn-ghost flex-1">{t("signIn")}</Link>
                  <Link href="/register" onClick={() => setOpen(false)} className="btn-primary flex-1">{t("register")}</Link>
                </>
              )}
            </div>
          </nav>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-line bg-cream text-fg">
        <div className="campus-container grid gap-10 py-12 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Logo className="" />
            <p className="mt-5 max-w-sm text-sm leading-7 text-muted">
              {t("footerLine1")}
              <br />
              {t("footerLine2")}
            </p>
          </div>
          <div>
            <h2 className="text-[10px] font-semibold uppercase tracking-widest text-muted">{t("footerMarketplace")}</h2>
            <ul className="mt-5 space-y-3 text-sm text-fg/80">
              {[[t("properties"), "/properties"], [t("cars"), "/cars"], [t("auctions"), "/auctions"], [t("map"), "/map"]].map(([l, h]) => (
                <li key={h}><Link href={h} className="hover:text-indigo-600">{l}</Link></li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="text-[10px] font-semibold uppercase tracking-widest text-muted">{t("footerAgent")}</h2>
            <ul className="mt-5 space-y-3 text-sm text-fg/80">
              {[[t("reservations"), "/reservations"], [t("messages"), "/messages"], [t("listItem"), "/sell"], [t("pricing"), "/pricing"]].map(([l, h]) => (
                <li key={h}><Link href={h} className="hover:text-indigo-600">{l}</Link></li>
              ))}
            </ul>
          </div>
        </div>
        <div className="border-t border-line">
          <div className="campus-container flex flex-wrap justify-between gap-3 py-5 text-[10px] text-muted">
            <span>&copy; {new Date().getFullYear()} YouSell. Lusaka, Zambia.</span>
            <span>{t("footerTagline")}</span>
          </div>
        </div>
      </footer>

      {!hideTabs && (
        <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
          <div className="grid grid-cols-5">
            {tabs.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                aria-current={active(href) ? "page" : undefined}
                className={`relative flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-extrabold uppercase tracking-wider transition ${active(href) ? "text-indigo-600 shadow-[inset_0_3px_0_0_#1769c2]" : "text-muted"}`}
              >
                <Icon className="size-5" />
                {label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
