# Sessiebundel — WK Poule (plakken aan het begin van een nieuwe chat)

Ik werk aan een Next.js 16 WK-poule app voor Nijhuis Bouw. Lees eerst `STATUS.md` in de project root voor de volledige context. Hieronder staat wat we in de **laatste sessie** hebben gedaan.

**Project root**: `/Users/claude/Desktop/Claude App/wk-poule/`
**Dev server**: `npm run dev -- --port 3010` (of via Preview MCP: `preview_start name=wk-poule`)

---

## Wat we in deze sessie hebben gedaan

### 1. Admin pagina — sectievolgorde en service role key
- Instellingen-sectie staat nu boven Deelnemers-sectie
- `SUPABASE_SERVICE_ROLE_KEY` toegevoegd aan `.env.local`
- Admin-pagina toont een waarschuwing als de service role key ontbreekt

### 2. Ranglijst — top-3 badges stijgers/dalers
- Top-3 stijgers krijgen 🚀🚀🚀 / 🚀🚀 / 🚀 (hardste stijger = meeste raketjes)
- Top-3 dalers krijgen 🪂🪂🪂 / 🪂🪂 / 🪂
- Zowel individueel als team klassement hebben dit systeem
- Legende uitgelegd in de individueel-header (alleen zichtbaar als er bewegingsdata is)
- Implementatie: `Map<user_id, count>` via `new Map(risers.map((r, i) => [r.user_id, 3 - i]))`

### 3. Ranglijst — uitlijning headers
- Headers van individueel en team klassement stonden niet op gelijke hoogte
- Opgelost met 2×2 CSS grid: `lg:grid lg:grid-cols-[1fr_16rem]`
- Mobile volgorde bewaard via CSS `order-1/2/3/4` — geen DOM-duplicatie

### 4. GroupStageForm — redesign match-rijen
- Kleinere score-inputs: `w-10 h-9 text-sm` (was `w-12 h-11 text-lg`)
- Compactere rij-hoogte: `py-3` (was `py-4`)
- Datum links inline zichtbaar (verborgen op mobile)
- "uitslag" label: `text-xs` voor subtielere weergave

### 5. Scoring audit
- Alle 20 puntenbeschrijvingen geverifieerd tegen de spelregels
- Twee bugs gevonden en gefixt in `app/api/cron/fetch-results/route.ts`:
  - **Bug 1**: Cron gebruikte de anon/publishable key — RLS blokkeerde DB-writes voor andere users. Gefixt door `SUPABASE_SERVICE_ROLE_KEY` te gebruiken.
  - **Bug 2**: Cron gaf altijd `topScorer: null` mee en berekende nooit `totalGoals`/`totalYellowCards`. Gefixt door `settings` tabel + FINISHED matches te lezen.

### 6. Punten-subtotalen per sectie
- Elke invulsectie (groepsfase, knock-out, bonus) toont nu het subtotaal in de header-card
- Data komt uit de `points` tabel gefilterd op `source = 'group'|'knockout'|'bonus'`
- Alleen zichtbaar als er al punten zijn (> 0)

### 7. Landing page logo
- `app/page.tsx` — custom header-div vervangen door `<BrandLogo />` component
- Nijhuis logo zichtbaar in de header van de landing page

---

## Wat nu als volgende prioriteit

1. **Productie deploy** — GitHub repo + Vercel (alle env vars klaar, zie STATUS.md)
2. **Dagelijkse mail cron** — wacht op `RESEND_API_KEY` (user heeft Resend account)
3. **AI commentaar** — wacht op `ANTHROPIC_API_KEY` (user heeft Anthropic account)

---

## Kritische aandachtspunten (niet vergeten)

- `app/api/cron/fetch-results/route.ts` gebruikt `SUPABASE_SERVICE_ROLE_KEY` — dit is bewust (bypast RLS voor cron-writes). Andere routes gebruiken publishable key + user session.
- `bracket_picks.round = 'CHAMPION'` is de wereldkampioen-pick, los van de FINAL-ronde.
- `settings` tabel heeft `actual_top_scorer` en `actual_yellow_cards` — beheerder vult die in voor bonuspunten.
- football-data.org codes CUR/URY wijken af van FIFA. Niet aanpassen.
