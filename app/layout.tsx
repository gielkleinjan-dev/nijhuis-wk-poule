import type { Metadata, Viewport } from "next";
import { PT_Sans, Inter } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import TwemojiLoader from "./TwemojiLoader";

// PT Sans — gratis humanist alternatief voor Officina Sans (Nijhuis huisstijl)
const ptSans = PT_Sans({
  variable: "--font-pt-sans",
  subsets: ["latin"],
  weight: ["400", "700"],
});

// Inter — voor de Scorito-look (scherp, neutraal, modern)
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  // metadataBase is nodig zodat Next.js absolute URLs genereert voor OG-image,
  // manifest etc. Zonder deze maken WhatsApp/Teams/email-clients geen preview
  // (ze weigeren relatieve image-paths).
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://nijhuis-wk-poule.vercel.app"),
  ),
  title: "WK Poule 2026 — Nijhuis",
  description:
    "De WK 2026 poule van Nijhuis Bouw — voorspel alle 104 wedstrijden, volg je stand live tijdens het toernooi.",
  // Open Graph (WhatsApp, Teams, mail-previews) en Twitter card. De og-image
  // wordt automatisch gegenereerd door app/opengraph-image.tsx.
  openGraph: {
    title: "WK Poule Nijhuis Bouw — WK 2026",
    description:
      "Voorspel alle 104 wedstrijden, volg je stand live tijdens het toernooi.",
    type: "website",
    locale: "nl_NL",
    siteName: "WK Poule Nijhuis",
  },
  twitter: {
    card: "summary_large_image",
    title: "WK Poule Nijhuis Bouw — WK 2026",
    description:
      "Voorspel alle 104 wedstrijden, volg je stand live tijdens het toernooi.",
  },
  manifest: "/manifest.json",
  // Apple-specific (iOS toevoegen-aan-beginscherm):
  // - title is wat onder het icoon op het home-screen verschijnt
  // - apple-touch-icon = het icoon zelf (Apple wil minstens 180×180, 1024 is veiliger)
  appleWebApp: {
    title: "WK Poule Nijhuis",
    capable: true,
    statusBarStyle: "default",
  },
  // Browser favicon + PWA-icons. Apple gebruikt 'apple' veld, Android het manifest.
  icons: {
    icon: [
      { url: "/apptegel-192.png", sizes: "192x192", type: "image/png" },
      { url: "/apptegel-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [
      { url: "/apptegel-1024.png", sizes: "1024x1024", type: "image/png" },
    ],
  },
};

// Browser-chrome (Android pull-down statusbalk + iOS Safari URL-balk) krijgt
// Nijhuis-rood als kleur. Sinds Next 14 hoort dit in de viewport-export, niet
// meer in metadata.
export const viewport: Viewport = {
  themeColor: "#d0343e",
};

export type ThemeName = "nijhuis" | "scorito";

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();
  const themeCookie = cookieStore.get("theme")?.value;
  const theme: ThemeName = themeCookie === "scorito" ? "scorito" : "nijhuis";

  return (
    <html
      lang="nl"
      data-theme={theme}
      className={`${ptSans.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <TwemojiLoader />
        {children}
      </body>
    </html>
  );
}
