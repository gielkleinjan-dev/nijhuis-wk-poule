# WK Poule 2026 — Handoff / Status

Dit document is voor een **nieuwe Claude-sessie** die het project moet voortzetten. Lees dit vóór je begint.

## Project samenvatting

Webbased WK-poule voor ~150 collega's bij **Nijhuis Bouw**. Volledig vóór 11 juni 2026 invullen (groepsfase + knock-out bracket + bonusvragen). Punten automatisch via football-data.org API. Mail-samenvattingen + ranglijst + AI-gimmicks.

**Live demo URL** (lokaal): `http://localhost:3010`
**Project root**: `/Users/claude/Desktop/Claude App/wk-poule/`

## Tech stack (allemaal opgezet)

| Onderdeel | Status |
|---|---|
| Next.js 16 + App Router + TypeScript + Tailwind v4 | ✅ scaffolded |
| Supabase (Postgres + auth via magic link) | ✅ project `WK_POULE_NIJHUIS` (ref `vrkgxkxavcynlnywzajk`, eu-west-1, org `WK_Nijhuis`) |
| football-data.org API | ✅ key in `.env.local` |
| Vercel hosting | ⏳ nog niet gedeployed, lokaal-only |
| Resend (mail) | ⏳ key veld leeg in env, account user heeft wel |
| Anthropic Claude (AI gimmicks) | ⏳ key veld leeg in env, account user heeft wel |

## Database schema (Supabase project `vrkgxkxavcynlnywzajk`)

Migraties al toegepast:
- `init_wk_poule_schema` — alle tabellen + RLS + `is_locked()` function
- `invite_code_rpc` — `validate_invite_code(text)` SECURITY DEFINER
- `seed_wc2026_fixtures` — 48 teams + 104 matches (72 groepsfase + 32 knock-out)
- `cron_rpcs` — `cron_update_match_scores` + `cron_replace_user_points` (SECURITY DEFINER)

Tabellen: `settings` (lock_at, actual_top_scorer, actual_yellow_cards), `invite_codes`, `profiles`, `teams`, `matches`, `predictions`, `bracket_picks`, `bonus_picks`, `points`, `ai_content`. View: `leaderboard`.

**Lock-datum**: `2026-06-11 17:00:00+02` (NL). Voor lock geldt RLS: alleen eigen voorspellingen zichtbaar/wijzigbaar. Na lock: read-only voor iedereen.

**Invite codes**: `WKNIJHUIS2026` (actief). Beheerder kan extra codes seeden via Supabase SQL editor.

## Wat AF is

### ✅ Login flow
- `/login` — invite-code + naam + email form
- `/api/register` — valideert code via RPC, stuurt magic link
- `/auth/callback` — wisselt PKCE code in, upsert profile
- `middleware.ts` — beschermt routes, exempteert `/api/cron/*`

### ✅ Huisstijl
- PT Sans font (Nijhuis huisstijl-alternatief)
- Kleuren: `#d0343e` brand-red, `#1d1d1b` ink, `#1f7a3d` pitch, `#e8b730` trophy
- Brand-stripe element = knipoog naar 4-balken Nijhuis logo
- Design tokens in `app/globals.css` via `@theme {}`
- `/styleguide` — referentie-pagina (publiek toegankelijk)

### ✅ Invulformulieren
- `/invullen` — groepsfase, 72 wedstrijden in 12 groepen, autosave 500ms debounce
- `/invullen/knockout` — 5 rondes (1/8e finale, kwart, halve, finale, kampioen)
- `/invullen/bonus` — topscorer (zoekbox), totaal doelpunten (tiebreaker), gele kaarten
- Tab-nav bovenaan + gedeelde layout in `app/invullen/layout.tsx`
- Punten-subtotalen per tab zichtbaar in de header-card van elke sectie (uit `points` tabel, `source = 'group'|'knockout'|'bonus'`)
- Lock-check (RLS + UI)

### ✅ Scoring engine
- `lib/scoring.ts` — pure functies: `scoreGroupPrediction`, `scoreKnockoutRound`, `scoreBonus`, `deriveSurvivors` + `computeUserPointRows()` data-fetcher
- `lib/scoring.test.ts` — 32 vitest-cases, alles groen (`npm run test`)
- Scoring detail:
  - **Groep**: 3 exact / 2 toto+goal-saldo / 1 toto / 0 mis
  - **Knock-out** (per ronde): LAST_16=4, QF=8, SF=12, FINAL=20, CHAMPION=25 per correct team
  - **Bonus**: topscorer exact = 15 pt (case-insensitive), totaal goals exact=15/±3=8, gele kaarten exact=10/±3=5
  - **Tiebreaker**: bij gelijke eindstand wint diegene dichtst bij werkelijk doelpuntenaantal (berekend in leaderboard-view)

### ✅ Cron: fetch-results
- `app/api/cron/fetch-results/route.ts` — `Authorization: Bearer <CRON_SECRET>` check
- Poll football-data.org → update `matches` tabel → recompute punten alle users
- Gebruikt **SUPABASE_SERVICE_ROLE_KEY** (bypast RLS) — vereist voor DB-schrijf vanuit cron
- Leest `settings.actual_top_scorer` en `settings.actual_yellow_cards` voor bonusscore
- Telt `home_score + away_score` over alle FINISHED matches voor tiebreaker
- `vercel.json` — elke 10 minuten geconfigureerd

### ✅ Ranglijst
- `/ranglijst` — individueel + team klassement naast elkaar (2×2 CSS grid met mobile-order)
- Top-3 stijgers: 🚀🚀🚀 / 🚀🚀 / 🚀 — top-3 dalers: 🪂🪂🪂 / 🪂🪂 / 🪂
- Legende uitgelegd in de header-card
- Team klassement op gemiddeld aantal punten per lid
- Team-beweging via `team_rank_snapshots` tabel (snapshot van gisteren)
- Filter op afdeling via URL param

### ✅ Admin pagina
- `/admin` — 3 hardcoded admins (`lib/admin.ts`)
- Deelnemers-zoeker + formulierweergave per deelnemer + lock-datum instelling + API-key status
- API-key status checkt ook `SUPABASE_SERVICE_ROLE_KEY` (als leeg: waarschuwing "cron kan geen punten berekenen")

### ✅ Landing page
- Nijhuis logo (BrandLogo component) zichtbaar in header
- Knop naar invulformulier of ranglijst afhankelijk van login-status

### ✅ Fixtures geseed (geverifieerd)
- 48 landen, 104 wedstrijden
- Groepsamenstelling gecross-checked met officiële FIFA-loting van 5 dec 2025 — 100% match

## Wat NOG MOET (in volgorde van prioriteit)

### 1. Productie deploy
- GitHub repo aanmaken + push
- Vercel project verbinden
- Env vars overzetten (zie sectie Env hieronder)
- Supabase redirect URLs aanvullen met productie domein
- Resend SMTP koppelen aan Supabase Auth (voor 150 mails/uur ipv 3 free tier)

### 2. Dagelijkse mail cron
- `app/api/cron/daily-mail/route.ts` — om 23:30 NL elke dag tijdens toernooi
- Input: uitslagen van die dag + top-3 stijgers/dalers
- Versturen via Resend
- Wacht op `RESEND_API_KEY` — user heeft account, key nog niet ingevuld

### 3. AI commentaar in dag-mail
- `lib/ai/dailyCommentary.ts` — Claude Sonnet, ~150 woorden Studio-Sport-stijl
- Input = uitslagen + 3 opvallende deelnemers
- Wacht op `ANTHROPIC_API_KEY` — user heeft account, key nog niet ingevuld

### 4. Kleine polish
- Next.js 16 deprecation: `middleware.ts` → `proxy.ts` (warning in console, werkt nog)
- Mobile responsive check invul-formulieren

## Env (`/Users/claude/Desktop/Claude App/wk-poule/.env.local`)

| Variabele | Status |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ aanwezig |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ✅ aanwezig |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ aanwezig (zie `.env.local`) |
| `FOOTBALL_DATA_API_KEY` | ✅ aanwezig (zie `.env.local`) |
| `CRON_SECRET` | ✅ aanwezig (ook in `cron_config` tabel Supabase) |
| `RESEND_API_KEY` | ⏳ leeg — user moet vullen |
| `ANTHROPIC_API_KEY` | ⏳ leeg — user moet vullen |

**Productie**: alle bovenstaande vars ook in Vercel env vars zetten. Als `CRON_SECRET` wijzigt:
```sql
insert into cron_config (secret) values ('<nieuwe-secret>')
on conflict (id) do update set secret = excluded.secret;
```

## Dev server starten

```bash
cd "/Users/claude/Desktop/Claude App/wk-poule" && npm run dev -- --port 3010
```

Of via Claude Preview MCP: `preview_start name=wk-poule`

## Kritisch om te onthouden

1. **`SUPABASE_SERVICE_ROLE_KEY` wordt gebruikt in de cron endpoint** (`app/api/cron/fetch-results/route.ts`). Dit is nodig om RLS te bypassen bij het wegschrijven van punten. Ándere routes gebruiken de publishable key + user-session.
2. **PKCE flow vereist `createSupabaseServerClient()` (met cookies) overal** in server components/routes, niet `createClient` direct.
3. **football-data.org `tla` codes ≠ FIFA officieel** voor CUR (Curaçao) en URY (Uruguay). Niet aanraken — onze bron is football-data.org.
4. **Lock-datum is single point of truth in `settings.lock_at`**. RLS-functie `is_locked()` checkt deze.
5. **`bracket_picks.round = 'CHAMPION'`** is de wereldkampioen-pick (slot=0), apart van de FINAL-match.
6. **`settings` tabel** bevat ook `actual_top_scorer` (string) en `actual_yellow_cards` (int). Cron leest deze voor bonuspunten. Beheerder vult ze in via admin-pagina of SQL.
7. **`points` tabel**: `source` ∈ `'group'|'knockout'|'bonus'`, `ref_id` = match_id / `${round}:${team_code}` / `'top_scorer'|'tiebreak'`. Bij recompute: eerst DELETE WHERE user_id, dan bulk INSERT.

## Belangrijke files

```
wk-poule/
├── app/
│   ├── layout.tsx                    # PT Sans loader
│   ├── globals.css                   # Design tokens
│   ├── page.tsx                      # Landing pagina (met BrandLogo)
│   ├── styleguide/page.tsx           # Component referentie
│   ├── login/page.tsx
│   ├── ranglijst/page.tsx            # Individueel + team klassement
│   ├── admin/page.tsx                # Admin: deelnemers + instellingen
│   ├── api/register/route.ts
│   ├── api/cron/fetch-results/route.ts   # Punten cron (service role key!)
│   ├── api/cron/daily-mail/route.ts      # TODO
│   ├── auth/callback/route.ts
│   └── invullen/
│       ├── layout.tsx                # Tab-nav + voortgangsbalk
│       ├── nav.tsx                   # Client tab component
│       ├── page.tsx                  # Groepsfase (toont subtotaal punten)
│       ├── GroupStageForm.tsx
│       ├── knockout/
│       │   ├── page.tsx              # (toont subtotaal punten)
│       │   └── KnockoutForm.tsx
│       └── bonus/
│           ├── page.tsx              # (toont subtotaal punten)
│           └── BonusForm.tsx
├── lib/
│   ├── scoring.ts                    # Pure scoring functies + computeUserPointRows
│   ├── scoring.test.ts               # 32 vitest tests
│   ├── footballData.ts               # football-data.org wrapper
│   ├── players.ts                    # Spelerslijst voor topscorer combobox
│   ├── departments.ts                # DEPARTMENTS array
│   ├── admin.ts                      # isAdmin() helper
│   ├── flags.ts                      # TLA → emoji vlag
│   └── supabase/{server,browser}.ts
├── middleware.ts
├── vercel.json                       # Cron schedules
└── .env.local
```

## Bekende issues / kleine TODO's

- Next.js 16 deprecation warning over `middleware.ts` (werkt nog, rename naar `proxy.ts` optioneel)
- Geen rate-limit op `/api/register` — Resend rate-limit beschermt indirect
- `team_rank_snapshots` wordt gevuld door de cron. Als er nog geen snapshot is van gisteren, tonen de bewegingspijlen `—` (correct gedrag)
- E2E happy path getest, edge cases niet (bv. invullen na lock via DevTools)
