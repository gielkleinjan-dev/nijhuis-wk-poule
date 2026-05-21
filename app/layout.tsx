import type { Metadata } from "next";
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
  title: "WK Poule 2026 — Nijhuis",
  description: "De WK 2026 poule van Nijhuis Bouw",
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
