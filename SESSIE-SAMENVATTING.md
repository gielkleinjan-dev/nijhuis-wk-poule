# Sessie-samenvatting — voor nieuwe contextwindow

Plak dit in een nieuwe Claude-sessie zodat ie direct mee kan denken zonder de hele historie te hoeven lezen.

---

## Wie ben ik
Giel Klein Jan, niet-developer, werk aan de WK-poule app voor Nijhuis Bouw (~150 collega's). Project in `/Users/claude/Desktop/Claude App/wk-poule/`. NL-talig, kort en concreet.

Lees `STATUS.md` voor het volledige technische beeld.

## Waar staan we nu

**App is LIVE** op https://nijhuis-wk-poule.vercel.app — auto-deploy bij elke push naar `main`. GitHub repo: `gielkleinjan-dev/nijhuis-wk-poule`. Pre-broadcast state in DB (geen scores, geen demo-data, alleen 2 echte profielen: Giel + Niels).

## Sessie 17 mei 2026 — afgerond

### Productie-changes (al live)

1. **Security-audit + 3 fixes** (commit historisch): paid-fraude dichtgezet, RLS aan op `team_rank_snapshots`, leaderboard view `security_invoker=on`.
2. **Service-role helper** + `/api/admin/toggle-paid` omgezet — voorkomt dat gebruikers `paid`/`is_admin` zelf kunnen wijzigen via PostgREST.
3. **Scoring-fix**: handmatige toto-pick wordt nu gehonoreerd (was: stand was leidend, toto-keuze werd genegeerd). 34→36 unit tests.
4. **Twemoji** voor vlaggen op Windows (Twitter open-source emoji-set, CDN-loaded).
5. **Spelfouten/zinsbouw** door alle user-facing schermen + `uitkomst`→`toto` overal.
6. **Bonusvragen gele kaarten 15/8 pt** (was 10/5) — gelijkgetrokken met doelpunten.
7. **Cron leert KO-seeding**: football-data `homeTeam.tla`/`awayTeam.tla` propageren via `cron_update_match_scores` met `coalesce`, zodat doorgaande landen automatisch in KO-wedstrijden verschijnen zodra de bracket geseed is.
8. **NL team-namen** voor alle 48 deelnemers in `public.teams.name` (TLA-code blijft NED/BRA/etc).
9. **Topscorer-dropdown** in admin (zelfde combobox als deelnemers gebruiken). PlayerCombobox gegeneraliseerd naar `app/components/PlayerCombobox.tsx`.
10. **Topscorer-lijst opgeschoond**: 6 niet-deelnemende landen verwijderd (IDN, NGA, SVN, UKR, CMR + PRY-TLA-fix), 2 ontbrekende landen toegevoegd (IRN 4 spelers, AUT 4 spelers). Nu 173 spelers, 48 landen — exacte match met deelnemerslijst.
11. **Ranglijst-pijltjes** werken: nieuwe DB-functie `cron_snapshot_ranks` slaat dagelijks vóór recompute de oude rank op (`profiles.rank_prev` + `team_rank_snapshots`).
12. **Auth-bug Mark Broekhuijsen gefixt**: profielaanmaak bij register + auth-callback gebruikt nu service-role i.p.v. user-session (PostgREST's upsert genereert een `DO UPDATE id = EXCLUDED.id` clause die UPDATE-rechten op `id` vereist; die hadden we bewust ingetrokken).
13. **20 test-profielen + oude Giel + Debby verwijderd** uit DB.

### Bracket V2 — in voorbereiding (NIET live, achter feature-flag)

**Plan**: 3-fasen knock-out flow ter vervanging van de huidige "klik 32 teams uit lijst" UI. Plan-bestand: `/Users/claude/.claude/plans/users-claude-desktop-claude-app-wk-poul-elegant-lollipop.md`.

- Fase A: per groep nr 1 en nr 2 aanwijzen (24 picks)
- Fase B: 8 beste nrs 3 kiezen (8 picks)
- Fase C: bracket-invulling, 31 matches, met smart-clear cascade

**Stap 1 KLAAR (gepusht commit `bc03f19`):** `lib/bracket/` — types, bracket-graaf met FIFA pairings (Article 12.5-12.11), volledige FIFA-thirds-tabel (495 entries uit Annex C van de officiële FIFA WK 2026 regulations PDF), cascade smart-clear logica. **56 unit tests groen.**

**Stap 2 KLAAR (gepusht commit `01aa7f7`):**
- `db/migrations/2026-05-18-bracket-v2-rpcs.sql` — 3 RPC's geschreven maar **NIET toegepast** op productie-DB
- `lib/scoring.ts` uitgebreid met `expandBracketPicksForScoring()` helper — V2-rijen worden samen als LAST_32 picks gescored. Backward-compatible.
- 7 extra scoring tests. **97 tests totaal groen.**

**Stap 3 (UI) — nog te doen:**
- `app/invullen/knockout/page.tsx` — env-var switch op `NEXT_PUBLIC_BRACKET_V2`
- `app/invullen/knockout/v2/KnockoutFormV2.tsx` (container) + 5 subcomponenten + 2 hooks
- E2E walkthrough op preview, FIFA live-verificatie kort vóór WK

**Stap 4-5**: preview-test, dan DB-migratie + env-var aan in productie.

## Wat moet er nog gebeuren (volgorde van prioriteit)

### 1. UI v2 bouwen (stap 3 van bracket V2-plan)
Container + PhaseAPicker + PhaseBPicker + BracketBuilder + BracketMatch + useDebouncedSave + useBracketState. Hergebruik `lib/bracket/cascade.ts` voor smart-clear. Style aansluitend op huidige groepsfase/bonus UI.

### 2. Demo-data vóór broadcast (optioneel)
DB staat nu schoon (pre-broadcast state). Als commissie nog een review wil met fictieve data, kunnen we 'm makkelijk opnieuw genereren — script geeft realistische uitslagen voor alle 104 wedstrijden.

### 3. Productie-flip van Bracket V2
Wanneer V2-UI getest is:
- `npx supabase migration up` of via Supabase MCP `apply_migration` de SQL uitvoeren
- Vercel env var `NEXT_PUBLIC_BRACKET_V2=true`
- Eerste 24u Supabase logs monitoren

## Belangrijke huisregels die Giel hanteert

- **Bij token-intensieve taken**: proactief advies geven welk Claude-model (Opus/Sonnet/Haiku) en welke effort-setting passend is.
- **Live deploy heeft voorrang** op mailing/AI features.
- Hij wil korte directe antwoorden, geen lange uitleg over Tailwind klassen of code-details tenzij gevraagd.

## Admin emails (hardcoded op 2 plekken — bij wijziging beide)

- `lib/admin.ts` → `ADMIN_EMAILS` array
- PostgreSQL functie `public.is_admin()` in Supabase

Huidige admins:
- `g.kleinjan@nijhuis.nl` (Giel bedrijf)
- `gielkleinjan@gmail.com` (Giel privé)
- `n.verveda@nijhuis.nl` (Niels)
- `m.broekhuijsen@nijhuis.nl` (Mark)

## Env keys ontbreken

- `RESEND_API_KEY` (voor mail) — feature geschrapt, niet meer nodig
- `ANTHROPIC_API_KEY` (voor AI gimmicks) — feature geschrapt, niet meer nodig

Alle andere keys zijn ingesteld (Supabase, football-data, cron secret).

## Niet vergeten

- **CLAUDE.md / AGENTS.md** in projectroot zegt: "This is NOT the Next.js you know — read `node_modules/next/dist/docs/` before writing code." Next.js 16 heeft breaking changes t.o.v. training data.
- **football-data.org tla-codes** wijken af van FIFA officieel voor CUR en URY — niet aanraken.
- **Bracket V2 stappen 1+2 zijn al gepusht** maar inactief — V1 KO-flow blijft live tot env-var aan gaat.
- **DB-migratie 2026-05-18-bracket-v2-rpcs.sql niet vergeten** vóór V2-launch — staat in `db/migrations/`.
