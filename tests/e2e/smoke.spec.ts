import { test, expect } from "@playwright/test";

/**
 * Smoke-tests voor de happy path. Geen auth, geen DB-state — checkt
 * alleen of de publieke pagina's renderen en de essentiele assets
 * beschikbaar zijn. Vangt grote regressies: build kapot, route 500,
 * OG-image generator stuk, manifest weg.
 *
 * Voor diepere flows (registreren → invullen → punten checken) is een
 * test-DB nodig; staat op de roadmap.
 */

test.describe("Publieke pagina's", () => {
  test("homepage laadt en toont hero-titel", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/WK Poule/);
    // Hero-titel (Nijhuis-mode default), beide regels via heading-role
    const h1 = page.getByRole("heading", { level: 1 }).first();
    await expect(h1).toBeVisible();
    await expect(h1).toContainText(/WK Poule|Nijhuis Bouw/i);
  });

  test("login-pagina toont mode-tabs en formulier", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("button", { name: /Eerste keer/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Al ingeschreven/i })).toBeVisible();
    await expect(page.getByLabel(/E-mailadres/i).first()).toBeVisible();
  });

  test("theme-toggle is zichtbaar en wisselbaar", async ({ page }) => {
    await page.goto("/");
    const toggle = page.getByRole("button", { name: /Wissel thema/i });
    await expect(toggle).toBeVisible();

    // Klik op de toggle en check dat data-theme wisselt
    const initialTheme = await page.locator("html").getAttribute("data-theme");
    await toggle.click();
    // Wacht kort op DOM update
    await page.waitForTimeout(100);
    const newTheme = await page.locator("html").getAttribute("data-theme");
    expect(newTheme).not.toBe(initialTheme);
    expect(["nijhuis", "scorito"]).toContain(newTheme);
  });
});

test.describe("Auth-protected routes redirect naar login", () => {
  for (const path of ["/invullen", "/ranglijst"]) {
    test(`${path} → /login zonder sessie`, async ({ page }) => {
      const resp = await page.goto(path);
      // Next kan ofwel server-side redirecten (302) of client-side via middleware.
      // We checken alleen het eindresultaat: URL bevat /login.
      await expect(page).toHaveURL(/\/login/);
      // Status 2xx of 3xx is goed (geen 500)
      if (resp) expect(resp.status()).toBeLessThan(500);
    });
  }
});

test.describe("Essentiele assets en metadata", () => {
  test("manifest.json is valide JSON met juiste velden", async ({ request }) => {
    const resp = await request.get("/manifest.json");
    expect(resp.status()).toBe(200);
    const data = await resp.json();
    expect(data.name).toBe("WK Poule Nijhuis");
    expect(data.short_name).toBe("WK Poule");
    expect(data.icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ sizes: "192x192" }),
      expect.objectContaining({ sizes: "512x512" }),
    ]));
  });

  test("robots.txt is bereikbaar en blokkeert /admin", async ({ request }) => {
    const resp = await request.get("/robots.txt");
    expect(resp.status()).toBe(200);
    const text = await resp.text();
    expect(text).toMatch(/Disallow:\s*\/admin/);
    expect(text).toMatch(/Sitemap:/);
  });

  test("sitemap.xml is valide XML met homepage", async ({ request }) => {
    const resp = await request.get("/sitemap.xml");
    expect(resp.status()).toBe(200);
    const xml = await resp.text();
    expect(xml).toContain("<?xml");
    expect(xml).toContain("<urlset");
    // Homepage moet in de sitemap staan
    expect(xml).toMatch(/<loc>[^<]*\/<\/loc>/);
  });

  test("opengraph-image genereert een PNG", async ({ request }) => {
    const resp = await request.get("/opengraph-image");
    expect(resp.status()).toBe(200);
    expect(resp.headers()["content-type"]).toMatch(/image\/png/);
    const buf = await resp.body();
    // PNG-signature: 89 50 4E 47 0D 0A 1A 0A
    expect(buf[0]).toBe(0x89);
    expect(buf[1]).toBe(0x50);
    expect(buf[2]).toBe(0x4e);
    expect(buf[3]).toBe(0x47);
    // Image moet niet leeg zijn
    expect(buf.length).toBeGreaterThan(10_000);
  });

  test("apptegel iconen aanwezig", async ({ request }) => {
    for (const path of ["/apptegel-192.png", "/apptegel-512.png", "/apptegel-1024.png"]) {
      const resp = await request.get(path);
      expect(resp.status(), `${path} should exist`).toBe(200);
      expect(resp.headers()["content-type"]).toMatch(/image\/png/);
    }
  });
});
