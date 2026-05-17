import type { Metadata } from "next";
import { PT_Sans } from "next/font/google";
import "./globals.css";
import TwemojiLoader from "./TwemojiLoader";

// PT Sans — gratis humanist alternatief voor Officina Sans (Nijhuis huisstijl)
const ptSans = PT_Sans({
  variable: "--font-pt-sans",
  subsets: ["latin"],
  weight: ["400", "700"],
});

export const metadata: Metadata = {
  title: "WK Poule 2026 — Nijhuis",
  description: "De WK 2026 poule van Nijhuis Bouw",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="nl"
      className={`${ptSans.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <TwemojiLoader />
        {children}
      </body>
    </html>
  );
}
