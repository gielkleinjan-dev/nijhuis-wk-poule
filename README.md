# WK Poule 2026 — Nijhuis Bouw

Interne WK-poule voor ~150 collega's. Deelnemers voorspellen alle 104 wedstrijden (groepsfase + knock-out + bonusvragen) vóór 11 juni 2026 17:00. Punten worden automatisch bijgehouden via de football-data.org API.

**Live**: https://nijhuis-wk-poule.vercel.app · **Invite-code**: `WKNIJHUIS2026`

## Stack

- **Next.js 16** — App Router, server components, TypeScript
- **Tailwind v4** — design tokens via `@theme {}`
- **Supabase** — Postgres + email+wachtwoord auth + RLS
- **Vitest** — scoring engine unit tests
- **Vercel** — hosting + cron jobs (1×/dag op Hobby plan)

## Lokaal draaien

```bash
npm install
npm run dev -- --port 3010
```

Vereist een `.env.local` met (zie `STATUS.md` voor alle vars):

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
FOOTBALL_DATA_API_KEY=...
CRON_SECRET=...
```

## Tests

```bash
npm run test        # vitest run (eenmalig)
npm run test:watch  # vitest watch
```

32 tests voor de scoring engine in `lib/scoring.test.ts`.

## Cron

De `/api/cron/fetch-results` route wordt door Vercel elke dag om 06:00 UTC aangeroepen (Hobby plan limiet: 1×/dag). Lokaal testen:

```bash
curl -H "Authorization: Bearer <CRON_SECRET>" http://localhost:3010/api/cron/fetch-results
```

## Documentatie

Zie `STATUS.md` voor de volledige handoff-documentatie: wat af is, wat nog moet, database schema, env vars en kritische aandachtspunten.
