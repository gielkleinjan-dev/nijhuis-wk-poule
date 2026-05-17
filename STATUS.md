# WK Poule 2026 — Handoff / Status

Dit document is voor een **nieuwe Claude-sessie** die het project moet voortzetten. Lees dit vóór je begint.

## Project samenvatting

Webbased WK-poule voor ~150 collega's bij **Nijhuis Bouw**. Volledig vóór 11 juni 2026 invullen (groepsfase + knock-out bracket + bonusvragen). Punten automatisch via football-data.org API. Mail-samenvattingen + ranglijst + AI-gimmicks volgen.

- **Live productie**: https://nijhuis-wk-poule.vercel.app
- **GitHub repo**: https://github.com/gielkleinjan-dev/nijhuis-wk-poule
- **Lokaal**: `http://localhost:3010`
- **Supabase project**: `WK_POULE_NIJHUIS` (ref `vrkgxkxavcynlnywzajk`, eu-west-1)

## Tech stack

| Onderdeel | Status |
|---|---|
| Next.js 16 + App Router + TypeScript + Tailwind v4 | ✅ |
| Supabase (Postgres + email+wachtwoord auth + RLS) | ✅ |
| football-data.org API | ✅ key in `.env.local` |
| Vercel hosting + GitHub auto-deploy | ✅ live |
| Resend (mail) | ⏳ key veld leeg in env |
| Anthropic Claude (AI gimmicks) | ⏳ key veld leeg in env |

## Auth flow (huidig — email + wachtwoord)

OTP-flow en magic links zijn **verwijderd**. Login werkt nu zoals elke standaard website:

- **Registreren**: invite-code (`WKNIJHUIS2026`) + naam + afdeling (verplicht) + email + zelfgekozen wachtwoord (min 6 tekens) → direct ingelogd, **nul mails verstuurd**.
- **Inloggen** (terugkerend): email + wachtwoord → direct in de app.
- **Wachtwoord vergeten**: `/wachtwoord-vergeten` → reset-mail (enige flow die nog een mail stuurt) → `/wachtwoord-instellen` na klik.
- **Supabase-config**: "Confirm email" staat **uit** in dashboard → Authentication → Providers → Email. Zonder dat zou registratie alsnog een bevestigingsmail sturen.

**Admin-status** is hardcoded op email-match in `lib/admin.ts` + parallel in de SQL functie `public.is_admin()`. Beide aanpassen bij wijziging. Huidige admins:

```
g.kleinjan@nijhuis.nl    ← Giel (bedrijf)
gielkleinjan@gmail.com   ← Giel (privé)
n.verveda@nijhuis.nl     ← Niels
m.broekhuijsen@nijhuis.nl ← Mark
```

Admins registreren zich net als iedereen; zodra ze inloggen herkent het systeem hun mail → admin-tabblad zichtbaar.

## Database (Supabase project `vrkgxkxavcynlnywzajk`)

Migraties toegepast:
- `init_wk_poule_schema` — alle tabellen + RLS + `is_locked()`
- `invite_code_rpc` — `validate_invite_code(text)` SECURITY DEFINER
- `seed_wc2026_fixtures` — 48 teams + 104 matches
- `cron_rpcs` — `cron_update_match_scores` + `cron_replace_user_points`
- `add_paid_to_profiles` — `profiles.paid` boolean + RLS policy via `public.is_admin()`
- `fix_admin_set_lock_at_qualify_is_admin` — search_path-fix in admin_set_lock_at RPC

Tabellen: `settings` (lock_at, actual_top_scorer, actual_yellow_cards), `invite_codes`, `profiles` (incl. `paid`), `teams`, `matches`, `predictions`, `bracket_picks`, `bonus_picks`, `points`, `ai_content`, `team_rank_snapshots`. View: `leaderboard`.

**Lock-datum**: `2026-06-11 17:00:00+02` (NL).

**Invite code**: `WKNIJHUIS2026`.

## Wat AF is

### ✅ Auth (email + wachtwoord)
- Eenmalig registreren met wachtwoord, daarna direct inloggen vanaf elk apparaat
- Wachtwoord-vergeten flow met reset-mail
- Waarschuwing op registratiepagina: "Gebruik niet je normale Nijhuis-inloggen wachtwoord"
- Logout-knop in elke pagina-header

### ✅ Huisstijl
- PT Sans font, Nijhuis-rood `#d0343e`, ink, pitch, trophy kleuren
- Logo in header met cropped variant (BV-tekst weggesneden via CSS overflow)
- Login/landing logo toont "Nijhuis Bouw WK Poule 2026" (één geheel)
- `/styleguide` referentie-pagina

### ✅ Header op alle pagina's
- `UserHeader` component: naam + sluit-info + 🔓/🔒 lock-status badge + Uitloggen knop
- Lock-status (read-only badge) zichtbaar voor iedereen, kleur Nijhuis-rood bij gesloten
- Mobile: naam/datum verborgen, lock-icoon zichtbaar, uitlog-knop als pijl-icoon
- Op /admin pagina staat de **interactieve lock-toggle** onder Sluitingstijd (met confirm-dialog bij sluiten)

### ✅ Navigatie
- `MainNav`: hoofdtabs (Invullen / Ranglijst / Admin) op alle pagina's
- `InvullenNav`: subtabs (Groepsfase / Knock-out / Bonus) in **pill-stijl op zachte achtergrond** — duidelijk een sub-niveau van Invullen

### ✅ Invulformulieren
- `/invullen` groepsfase: 72 wedstrijden in 12 groepen, autosave 500ms debounce
- `/invullen/knockout` 5 rondes
- `/invullen/bonus` topscorer combobox + tiebreakers
- Subtotaal punten per tab zichtbaar
- Lock-check via RLS

### ✅ Scoring engine
- `lib/scoring.ts` pure functies + `computeUserPointRows()` data-fetcher
- 32 vitest-cases groen
- Groep: 2+2+1 punten (max 5 per wedstrijd)
- Knock-out per ronde: LAST_32=4, LAST_16=7, QF=12, SF=18, FINAL=28, CHAMPION=40
- Bonus: topscorer exact = 15, gele kaarten exact/±3 = 10/5, doelpunten exact/±3 = 15/8

### ✅ Cron: fetch-results
- `app/api/cron/fetch-results/route.ts` met `CRON_SECRET` auth
- Vercel cron: `0 6 * * *` (1×/dag, Hobby plan limiet)
- Service role key voor RLS-bypass

### ✅ Ranglijst
- `/ranglijst` individueel + team naast elkaar (responsive grid)
- Individueel: top-3 stijgers 🚀🚀🚀/🚀🚀/🚀 en dalers 🪂🪂🪂/🪂🪂/🪂
- Team: alleen grootste stijger en daler (3 raketten/parachutes) — minder visueel lawaai
- Team klassement op gemiddeld aantal punten per lid

### ✅ Admin pagina
- 4 hardcoded admins
- **Deelnemers-tabel met**: Betaald-checkbox (toggle direct opgeslagen), Voortgangsbalk + percentage, sortering op naam/voortgang/niet betaald eerst
- Mobile: voortgangsdetail verborgen, punten onder naam
- **Deelnemer-detail (`/admin/[userId]`)**: groepsfase + knock-out + bonus met uitslag, voorspelling én behaalde punten naast elkaar
- Lock-toggle met bevestiging + foutmelding-alert
- Sluitingstijd instelbaar
- Bonus-uitslagen (topscorer + gele kaarten) instelbaar

### ✅ Responsive
Volledig responsive op iPhone 16 / Pixel breedte (393px+):
- Headers compacter, lock-tekst icon-only op mobile
- Voortgangsbalk stack
- GroupStageForm: 2-regel mobile layout (teams+score boven, toto+datum+status onder) met 3-koloms grid voor uitlijning
- KnockoutForm: 1-koloms team-grid op smalste viewport
- BonusForm: input smaller op mobile
- Ranglijst: kleinere padding, team-kolom vanaf md
- AdminSearch: voortgangsdetail verborgen, punten onder naam
- Admin detail: groep-tabellen worden card-rijen via responsive grid

### ✅ Productie deploy
- GitHub repo + Vercel auto-deploy bij elke push naar `main`
- Alle env vars in Vercel ingesteld
- Supabase redirect-URLs geconfigureerd voor productiedomein
- Cron: daily fetch-results om 06:00 UTC

## DEMO-DATA STATUS (BELANGRIJK)

Op het moment van schrijven is er een **volledig gespeeld fictief WK** in de database voor commissie-review. Alle 104 matches zijn FINISHED met deterministische scores; bonus-uitslagen ingevuld (topscorer Mbappé, 198 gele kaarten, 344 doelpunten); 22 testprofielen met ranglijst van 422 → 0 pt.

**Vóór je de app naar alle 150 collega's deelt** moet dit gereset worden naar een schone pre-WK state:

```sql
update matches set
  home_score = null,
  away_score = null,
  status     = 'TIMED';

update matches set home_team = null, away_team = null
  where stage <> 'GROUP_STAGE';

update settings set
  actual_top_scorer   = null,
  actual_yellow_cards = null
  where id = 1;

delete from points;
delete from team_rank_snapshots;
-- optioneel: delete from predictions; delete from bracket_picks; delete from bonus_picks;
--           (alleen als je ook de testprofielen wilt opschonen)
```

## Wat NOG MOET (in volgorde van prioriteit)

### 1. Reset demo-data vóór broadcast
Eén SQL-blok hierboven runnen op het moment dat de commissie groen licht geeft. 30 seconden werk. Daarna zijn alle 150 collega's welkom.

### 2. Dagelijkse mail cron
- `app/api/cron/daily-mail/route.ts` (nog niet geïmplementeerd)
- Uitslagen van die dag + top-3 stijgers/dalers
- Resend SMTP koppelen aan Supabase Auth (voor 150 mails/uur ipv 3 free tier)
- Wacht op `RESEND_API_KEY`

### 3. AI commentaar in dag-mail
- `lib/ai/dailyCommentary.ts` — Claude Sonnet, ~150 woorden Studio-Sport-stijl
- Wacht op `ANTHROPIC_API_KEY`

### 4. Optioneel: Microsoft SSO (Entra ID)
- Voor Nijhuis-collega's: één klik inloggen met bedrijfsaccount + MFA gratis
- IT moet app-registratie aanmaken in Entra ID
- ~1 uur werk aan codekant zodra credentials beschikbaar
- E-mail+wachtwoord blijft beschikbaar voor externe deelnemers

### 5. Polish
- Next.js 16 deprecation: `middleware.ts` → `proxy.ts` (warning, werkt nog)
- Geen rate-limit op `/api/register` (Resend rate-limit indirect)

## Env (`/Users/claude/Desktop/Claude App/wk-poule/.env.local`)

| Variabele | Status |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ |
| `FOOTBALL_DATA_API_KEY` | ✅ |
| `CRON_SECRET` | ✅ (ook in `cron_config` tabel Supabase) |
| `RESEND_API_KEY` | ⏳ leeg |
| `ANTHROPIC_API_KEY` | ⏳ leeg |

Alle vars ook in Vercel env vars ingesteld voor productie.

## Dev server

```bash
cd "/Users/claude/Desktop/Claude App/wk-poule" && npm run dev -- --port 3010
```

Of via Claude Preview MCP: `preview_start name=wk-poule`.

## Kritisch om te onthouden

1. **Auth = email + wachtwoord**, géén OTP of magic link meer.
2. **"Confirm email" staat uit in Supabase** — anders krijgt elke registrant alsnog een mail.
3. **Admin-mails** staan op TWEE plekken: `lib/admin.ts` én PostgreSQL functie `public.is_admin()`. Synchroon houden.
4. **`SUPABASE_SERVICE_ROLE_KEY`** wordt door de cron gebruikt voor RLS-bypass. Niet roteren zonder ook Vercel env bij te werken.
5. **PKCE flow** vereist `createSupabaseServerClient()` (met cookies) in server components/routes.
6. **football-data.org `tla` codes ≠ FIFA officieel** voor CUR (Curaçao) en URY (Uruguay). Niet aanraken — onze bron is football-data.
7. **Lock-datum** is single point of truth in `settings.lock_at`. SQL functie `is_locked()` checkt deze.
8. **`bracket_picks.round = 'CHAMPION'`** is de wereldkampioen-pick (slot=0), apart van FINAL.
9. **`points` tabel**: `source` ∈ `'group'|'knockout'|'bonus'`, `ref_id` = match_id / `${round}:${team_code}` / `'top_scorer'|'total_goals'|'total_yellow_cards'`. Recompute: eerst DELETE per user_id, dan bulk INSERT.
10. **SECURITY DEFINER functies** moeten `set search_path = public` hebben anders kunnen ze andere RPC's niet aanroepen (zie `admin_set_lock_at` historie).
11. **DEMO-DATA staat in productie** — eerst resetten voor de broadcast naar alle collega's (zie sectie boven).

## Belangrijke files

```
wk-poule/
├── app/
│   ├── layout.tsx                    # PT Sans loader
│   ├── globals.css                   # Design tokens
│   ├── page.tsx                      # Landing pagina
│   ├── styleguide/page.tsx
│   ├── login/page.tsx                # Email+wachtwoord registratie/login
│   ├── wachtwoord-vergeten/page.tsx
│   ├── wachtwoord-instellen/page.tsx
│   ├── ranglijst/page.tsx
│   ├── admin/
│   │   ├── layout.tsx
│   │   ├── page.tsx                  # Deelnemers + instellingen + lock toggle
│   │   ├── AdminSearch.tsx           # Tabel + paid + voortgang + sort
│   │   └── [userId]/page.tsx         # Volledig formulier deelnemer + scores
│   ├── api/
│   │   ├── register/route.ts         # signUp() met wachtwoord
│   │   ├── login/route.ts            # signInWithPassword()
│   │   ├── logout/route.ts
│   │   ├── forgot-password/route.ts
│   │   ├── admin/
│   │   │   ├── lock/route.ts
│   │   │   └── toggle-paid/route.ts
│   │   └── cron/
│   │       └── fetch-results/route.ts  # Punten cron (service role!)
│   ├── auth/callback/route.ts        # PKCE callback (alleen voor wachtwoord-reset)
│   ├── components/
│   │   ├── BrandLogo.tsx             # Compact + large variant
│   │   ├── MainNav.tsx               # Hoofdtabs
│   │   ├── UserHeader.tsx            # Naam + LockBadge + Uitloggen
│   │   ├── LockBadge.tsx             # Read-only 🔓/🔒
│   │   └── LockToggle.tsx            # Interactieve toggle (alleen op /admin)
│   └── invullen/
│       ├── layout.tsx                # Header + ProgressBar + InvullenNav
│       ├── nav.tsx                   # Hoofdtabs + pill-subtabs
│       ├── ProgressBar.tsx
│       ├── page.tsx                  # Groepsfase
│       ├── GroupStageForm.tsx        # Met responsive MatchRow
│       ├── knockout/{page,KnockoutForm}.tsx
│       └── bonus/{page,BonusForm}.tsx
├── lib/
│   ├── scoring.ts                    # Pure scoring + computeUserPointRows
│   ├── scoring.test.ts               # 32 vitest tests
│   ├── footballData.ts
│   ├── players.ts
│   ├── departments.ts                # Team Familie leden, Explorius weg
│   ├── admin.ts                      # ADMIN_EMAILS (4 stuks)
│   ├── flags.ts
│   └── supabase/{server,browser}.ts
├── middleware.ts                     # Auth-redirect, PUBLIC_PATHS
├── vercel.json                       # Cron schedule (daily)
└── .env.local
```

## Recente commits (laatste sessies)

```
b74a811 fix(mobile): toto-knoppen en uitslag uitlijnen in groepsfase rij
1c7a5fa fix(admin): bonus deelnemer-detail toont nu ook uitslag + behaalde punten
8556dba feat(responsive): mobiel-vriendelijke layouts voor iPhone 16 / Pixel
9d5afaf ui: betere navigatie + login texts + duidelijkere lock labels
662b09a chore(login+lock): afdeling verplicht, duidelijkere teksten
0f25478 fix(admin): lock toggle met foutmelding, bevestigingsprompt en rode stijl
3918840 feat(login): waarschuwing om Nijhuis-wachtwoord niet te hergebruiken
6d96907 chore(ui): kortere uitleg bij team klassement
90fa137 feat(lock): read-only badge in header, toggle alleen op admin
82baffc feat(ui): uitloggen + lock toggle in alle headers, login-tekst aangepast
2ff75e7 fix(admin): bekijk-link wrap + groep-tabellen uitlijnen
b65f7b8 feat: uitloggen + uitlijning + team-ranglijst polish
4e391ad feat(auth): vervang OTP door email+wachtwoord auth + admin betaald/voortgang
```
