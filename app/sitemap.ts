import type { MetadataRoute } from "next";

// Dynamische sitemap voor de publieke routes. Auth-vereiste pagina's
// (/invullen, /ranglijst etc.) hebben geen waarde voor zoekmachines en
// staan dus niet in de sitemap. /admin is sowieso uitgesloten via
// robots.txt.

const BASE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://nijhuis-wk-poule.vercel.app");

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    {
      url: BASE_URL,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${BASE_URL}/login`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];
}
