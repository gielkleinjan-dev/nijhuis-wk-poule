# Launch-protocol voor 150 collega's

Praktisch draaiboek om de WK-poule te lanceren zonder dat je in paniek raakt.
Dit document is bewust kort — als 'm langer wordt dan een A4, is iets mis.

## ⚙️ Capacity-schatting (per mei 2026)

| Resource | Limiet (Supabase free) | Onze verwachte piek | Marge |
|---|---|---|---|
| Database opslag | 500 MB | ~10 MB | 50× |
| Maandelijkse actieve users | 50.000 | 150 | 333× |
| Egress (data eruit) | 2 GB / maand | ~50 MB | 40× |
| Postgres connecties | 50 (via pooler shared) | piek ~150 in 5 min | OK door pooling |
| Realtime kanalen | 200 | gebruiken we niet | — |

**Conclusie**: Supabase free tier is voldoende voor 150 deelnemers. Pro ($25/mnd)
is een verzekering, geen noodzaak.

| Vercel resource | Limiet (Hobby) | Onze verwachte piek | Marge |
|---|---|---|---|
| Bandwidth (CDN) | 100 GB / maand | ~5 GB (homepage-foto's) | 20× |
| Serverless executions | 1M / maand | ~30k | 33× |
| Build minutes | 6000 / maand | ~50 | 120× |
| Cron jobs | 2 (Hobby) | 1 (fetch-results) | OK |

**Conclusie**: Vercel Hobby is voldoende. Pro ($20/mnd) alleen nodig als je extra
cron-jobs wilt.

## 🎯 Soft-launch in vier fasen

Elke fase: **geef minstens 24u** zodat bugs aan het licht komen vóór je opschaalt.

### Fase 0 — Eigen kring (vandaag)
- **Wie**: jij, Mark, Niels (3 personen)
- **Doel**: laatste sanity-check op de gehele flow
- **Checken**:
  - [ ] Registratie werkt (3× verschillende emails / departments)
  - [ ] Groepsfase volledig invullen + na refresh staan keuzes er nog
  - [ ] Knock-out 3 stappen doorlopen, schema is auto-opgebouwd, winnaars-keuze werkt
  - [ ] Bonus 6 vragen ingevuld
  - [ ] ProgressBar staat op 72/72 · 63/63 · 6/6
  - [ ] `/admin` accessible voor jou, niet voor niet-admins
  - [ ] Mobile gecheckt op je iPhone (vlaggen, dropdowns, overflow)
  - [ ] PWA-installatie werkt (Voeg toe aan beginscherm)

### Fase 1 — Eerste cirkel (3-5 dagen)
- **Wie**: 5-10 collega's uit verschillende afdelingen
- **Doel**: real-world gebruikersgedrag observeren
- **Checken**:
  - [ ] `/api/admin/health` toont gem. picks per user > 50% van max
  - [ ] Niemand meldt errors of vragen "hoe werkt X"
  - [ ] LockBadge + lock-countdown visible bij iedereen
  - [ ] Voorspellingen-pagina (na lock) toont iedereens picks
- **Stop-criterium**: als 1+ collega's iets melden dat niet meteen reproduceerbaar is → wachten met fase 2 tot opgelost

### Fase 2 — Halve groep (1-2 weken)
- **Wie**: 50-75 collega's
- **Doel**: schaal-test, foutmarges identificeren
- **Checken**:
  - [ ] `/api/admin/health` checkpoint dagelijks
  - [ ] Cron `fetch-results` succesvol gedraaid (zodra eerste oefenmatches binnen zijn)
  - [ ] Geen Supabase quota-alerts in dashboard
  - [ ] Vercel function executions onder limiet

### Fase 3 — Volledige uitrol (laatste 1-2 weken vóór lock)
- **Wie**: alle 150 collega's
- **Doel**: maximale deelname vóór 11 juni 17:00
- **Communicatie**:
  - Lock-reminder mail 72u vooraf
  - Lock-reminder mail 24u vooraf
  - Lock-moment: countdown is in app + WhatsApp-pingen
- **Checken na lock**:
  - [ ] Voorspellingen-pagina werkt voor alle deelnemers
  - [ ] Iedereen zit op alle 3 fasen ≥80% ingevuld (anders contact opnemen)

## 🚨 Wat te doen bij problemen

| Symptoom | Waarschijnlijke oorzaak | Actie |
|---|---|---|
| Site traag of 503 | Vercel cold-start of Supabase pool vol | Wacht 30s, daarna refresh. Check Vercel dashboard |
| Save mislukt voor 1 user | RLS-policy of validatie-fout | Check Supabase logs voor die user_id |
| ProgressBar niet update | router.refresh() niet getriggerd (rare race) | Hard refresh helpt; bug rapporteren |
| Cron heeft uitslag gemist | football-data.org rate-limit of API down | Handmatig via `/admin` invullen; cron retry volgt automatisch |
| Punten kloppen niet | Scoring-bug | `/api/admin/health` checken, eventueel cron handmatig opnieuw runnen |

## 🧪 Load-test

Voor fase 2 (~50 users) loont een echte stress-test. Het script schrijft
direct via service-role naar de DB, gebruikt deterministische UUIDs, en
markeert alle test-data met `department='__LOADTEST__'` zodat cleanup
triviaal is.

```bash
# 1. Dry-run om te zien wat 'm zou doen
npm run loadtest -- --users=50

# 2. Echt schrijven (5-sec countdown, Ctrl-C om te annuleren)
npm run loadtest -- --users=50 --confirm

# 3. Resultaat lezen: p50/p95/p99 latencies + errors per fase

# 4. Opruimen (dry-run eerst, dan --confirm)
npm run loadtest:cleanup
npm run loadtest:cleanup -- --confirm
```

Vereist `.env.local` met `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.

**Per user worden ~52 upserts gegenereerd** (1 profile + 30 predictions
+ 20 bracket_picks + 1 bonus). Bij 50 users: 2600 writes in een ~10s
fenster. Effectief equivalent van een avond met ~30 echte parallel-actieve
collega's.

## 🧪 Integratie-test (scoring-keten)

Verifieert dat de hele scoring-pipeline correct werkt: DB-writes, reads,
en scoring-functies bij realistische scenario's. Schrijft een test-user
in de DB (marker `department='__SCORING_TEST__'`), runt ~15 assertions,
ruimt zichzelf op vóór + na elke run.

```bash
npm run test:integration
```

Vereist `.env.local` met service-role-key. Run lokaal vóór fase 1/2 om
zeker te weten dat scoring-bugs niet voor de neus van je collega's
opduiken.

## 🔍 Health-check

`GET /api/admin/health` (login als admin) geeft JSON met:
- Aantal deelnemers
- Gemiddelde picks per user per fase
- Aantal FINISHED matches
- Lock-status
- Tijd tot lock

**Bookmark deze**. Bij twijfel ("draait het nog?") → 5 seconden zekerheid.

## 📞 Escalatie

Als iets écht stuk is en je het niet kan reproduceren:
1. Maak screenshot van de fout + URL + browser
2. Check `/api/admin/health` — geeft state-snapshot
3. Vraag in Claude-sessie met die screenshots erbij
