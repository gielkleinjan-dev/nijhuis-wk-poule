# Sessie-samenvatting — voor nieuwe contextwindow

Plak dit in een nieuwe Claude-sessie zodat ie direct mee kan denken zonder de hele historie te hoeven lezen.

---

## Wie ben ik
Giel Klein Jan, niet-developer, werk aan de WK-poule app voor Nijhuis Bouw (~150 collega's). Project in `/Users/claude/Desktop/Claude App/wk-poule/`. NL-talig, kort en concreet.

Lees `STATUS.md` voor het volledige technische beeld.

## Waar staan we nu

**App is LIVE** op https://nijhuis-wk-poule.vercel.app — auto-deploy bij elke push naar `main`. GitHub repo: `gielkleinjan-dev/nijhuis-wk-poule`.

In de meest recente sessie hebben we:

1. **Auth omgebouwd** van OTP-codes naar email + zelfgekozen wachtwoord. Nul mails meer per inlogpoging. Wachtwoord-vergeten flow via reset-mail. Supabase "Confirm email" staat uit.
2. **Admin uitgebreid**: betaald-checkbox + voortgangsbalk per deelnemer + sortering. Aparte `paid` kolom op profiles met admin-only RLS.
3. **Header herzien**: nieuwe `UserHeader` op alle pagina's met naam + 🔓/🔒 lock-badge (read-only voor iedereen) + Uitloggen. Interactieve lock-toggle alleen nog op `/admin`.
4. **Navigatie verbeterd**: subtabs (Groepsfase / Knock-out / Bonus) in pill-stijl op zachte achtergrond, duidelijk een sub-niveau van Invullen.
5. **Veel UI-fixes**: logo-uitlijning, team-ranglijst vereenvoudigd (alleen grootste stijger/daler), waarschuwing op registratie ("gebruik niet je Nijhuis-wachtwoord"), afdeling verplicht, duidelijkere lock-labels ("Invullen & wijzigen kan nog/gesloten").
6. **Volledig responsive** gemaakt op iPhone 16 / Pixel breedte (393px+). Alle pagina's getest, formulieren tonen card-layouts op mobile waar nodig.
7. **Lock toggle bug gefixt** (SECURITY DEFINER had geen `search_path = public`).
8. **Bonus admin detail** uitgebreid met Uitslag + behaalde Punten kolommen (was alleen Vraag/Antwoord).
9. **Demo-data gezet**: volledig fictief gespeeld WK in productie voor commissie-review. 22 testprofielen, ranglijst van 422 → 0 pt. Topscorer Mbappé, 198 gele kaarten, 344 doelpunten.

## Wat moet er nog gebeuren (volgorde van prioriteit)

### 1. Demo-data resetten vóór broadcast
Wanneer de poule-commissie groen licht geeft, dit SQL-blok runnen om naar pre-WK state te gaan voordat alle 150 collega's mogen meedoen:

```sql
update matches set home_score=null, away_score=null, status='TIMED';
update matches set home_team=null, away_team=null where stage <> 'GROUP_STAGE';
update settings set actual_top_scorer=null, actual_yellow_cards=null where id=1;
delete from points;
delete from team_rank_snapshots;
-- optioneel ook: delete from predictions; delete from bracket_picks; delete from bonus_picks;
```

### 2. Daily mail cron
- `app/api/cron/daily-mail/route.ts` bouwen — uitslagen + top-3 stijgers/dalers
- Resend SMTP koppelen aan Supabase Auth (free tier 3 mails/uur is te weinig)
- Wacht op `RESEND_API_KEY` (Giel heeft account, key nog niet in env)

### 3. AI commentaar in dag-mail
- `lib/ai/dailyCommentary.ts` — Claude Sonnet, ~150 woorden Studio-Sport-stijl
- Wacht op `ANTHROPIC_API_KEY`

### 4. Optioneel: Microsoft SSO (Entra ID)
- Voor Nijhuis-collega's: één klik inloggen met bedrijfsaccount, MFA gratis
- IT moet eerst app-registratie in Entra ID maken + credentials geven
- ~1 uur werk aan codekant zodra credentials beschikbaar
- Email+wachtwoord blijft beschikbaar voor externe deelnemers

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

- `RESEND_API_KEY` (voor mail)
- `ANTHROPIC_API_KEY` (voor AI gimmicks)

Alle andere keys zijn ingesteld (Supabase, football-data, cron secret).

## Niet vergeten

- **CLAUDE.md / AGENTS.md** in projectroot zegt: "This is NOT the Next.js you know — read `node_modules/next/dist/docs/` before writing code." Next.js 16 heeft breaking changes t.o.v. training data.
- **football-data.org tla-codes** wijken af van FIFA officieel voor CUR en URY — niet aanraken.
- **Test profiles vs nieuwe accounts**: er staan 2× "Giel KleinJan" in de DB — oude test-account (72 voorspellingen) en het nieuwe live-account (1 voorspelling). Bij commissie-test van admin lijst altijd het test-account openen voor demo-effect.
