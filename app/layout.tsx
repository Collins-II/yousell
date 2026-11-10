import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import { PrefsProvider } from "@/components/prefs-provider";
import { getSession } from "@/lib/auth";
import { getRates } from "@/lib/fx";
import { getPrefs } from "@/lib/prefs";
import { getUnreadCount } from "@/lib/messages";
import { getPendingReservationCount, isAgent } from "@/lib/reservations";
import "./globals.css";

const sans = Manrope({ variable: "--font-manrope", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "YouSell — Agent-backed property & cars", template: "%s · YouSell" },
  description: "YouSell is an agent-backed marketplace for property and vehicles. Browse, bid, and reserve with mobile money.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f6f9" },
    { media: "(prefers-color-scheme: dark)", color: "#10151d" },
  ],
};

const themeScript = `try{var t=localStorage.getItem("theme");if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const [{ locale, currency }, rates] = await Promise.all([getPrefs(), getRates()]);
  const [unread, pending] = session
    ? await Promise.all([
        getUnreadCount(session.id).catch(() => 0),
        isAgent(session.id).then((a) => getPendingReservationCount(session.id, a)).catch(() => 0),
      ])
    : [0, 0];

  return (
    <html lang={locale} data-scroll-behavior="smooth" suppressHydrationWarning className={`${sans.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <PrefsProvider locale={locale} currency={currency} rates={rates}>
          <AppShell user={session ? { name: session.name, email: session.email } : null} unread={unread} pending={pending}>
          {children}
        </AppShell>
        </PrefsProvider>
      </body>
    </html>
  );
}
