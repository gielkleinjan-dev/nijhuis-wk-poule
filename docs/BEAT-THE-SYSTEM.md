# Beat the System — digitale collega's

Twee bot-deelnemers die meespelen in de poule en collega's iets te verslaan geven.
Niet bedoeld om te winnen, wel om verhaal en context te geven aan de tussenstand.

## 🟢 Johan Derksen (de meerderheid)

**Strategie: Wisdom of the Crowd.** Voor elke vraag vult Johan de meest gekozen
optie van alle echte deelnemers in (modus). Voor numerieke tiebreakers (totaal
doelpunten, totaal gele kaarten) pakt hij de mediaan.

**Wanneer draaien:** *direct ná lock-time*. Vóór lock is de modus nog niet
gestabiliseerd — mensen wijzigen hun picks nog. Draai Johan zodra de invoer
echt gesloten is.

```bash
npm run beat:johan -- --confirm
```

## 🟠 Rene van der Gijp (de bookmaker)

**Strategie: pure bookmaker-favorieten.** Rene gebruikt outright odds (impliciete
kansen = 1/odds) als sterkte-score per land en vult daarop:

- **Groepsfase (72 wedstrijden):** odds-based score-model (ratio-driven)
- **Top 2 per groep + Beste 8 derde plaatsen:** uit `RENE_GROUP_FORECAST`
- **Alle KO-rondes (31 wedstrijden):** cascade-resolve (zelfde logica als de
  echte gebruiker-flow in `lib/bracket/cascade.ts`), per match wint de hoogst-
  gerangschikte favoriet
- **Bonus:** Mbappé / Memphis / kwartfinale / 270 doelpunten / 370 gele kaarten

**Wanneer draaien:** *vlak vóór lock-time*. Rene is niet afhankelijk van echte
deelnemers, dus mag op elk moment vóór sluiting. **Update altijd eerst de
odds** in `data/rene-knowledge.ts` als die de laatste dagen flink bewogen zijn.

```bash
npm run beat:rene -- --confirm
```

## Lock-day draaiboek

Lock = **woensdag 10 juni 2026 17:00 NL-tijd** (de eerste wedstrijd MEX-RSA is
do 11 juni 21:00 — lock zit dus ~1 dag vóór de aftrap).

**Ochtend/middag van lock-day (10 juni, vóór 17:00):**
1. Open Oddschecker / DraftKings / ESPN futures
2. Pas `data/rene-knowledge.ts` aan:
   - `RENE_CHAMPION_ODDS` — nieuwe decimal-odds per land
   - `RENE_GROUP_FORECAST` — als bookmaker een andere top-2 verwacht
3. Eventueel `RENE_BONUS.topScorer` updaten (Golden Boot favoriet)
4. Dry-run: `npm run beat:rene`
5. Commit de knowledge-file: `git commit -am "data: refresh Rene odds pre-lock"`
6. Live zetten: `npm run beat:rene -- --confirm`

**Direct ná lock (10 juni 17:01):**
```bash
npm run beat:johan -- --confirm
```
Johan vult dan de modus van alle ~150 collega's. Onmiddellijk daarna zijn beide
bots te zien in de stand.

## Updaten tijdens het toernooi

**Niet doen.** Na lock kunnen picks niet meer wijzigen (database-RLS blokkeert
het), dus ook de bots niet. Wel kun je de bots verwijderen + opnieuw seeden vóór
lock als je nog wilt tweaken:

```bash
npm run beat:cleanup -- --confirm   # wist bots volledig (auth + alle data)
npm run beat:both -- --confirm      # opnieuw seeden
```

## Subcommands

| Commando | Wat het doet |
|---|---|
| `npm run beat:johan` | Dry-run Johan (overzicht, geen schrijfacties) |
| `npm run beat:johan -- --confirm` | Echt seeden |
| `npm run beat:rene` | Dry-run Rene |
| `npm run beat:rene -- --confirm` | Echt seeden |
| `npm run beat:both` | Dry-run beide |
| `npm run beat:both -- --confirm` | Echt beide seeden |
| `npm run beat:cleanup` | Dry-run cleanup |
| `npm run beat:cleanup -- --confirm` | Bots volledig verwijderen (auth + picks + profile) |

## Markers in de database

Beide bots zijn écht auth-users met een profile-rij. Ze zijn herkenbaar via:

- **Email:** `johan-derksen@beat-the-system.local`, `rene-van-der-gijp@beat-the-system.local`
- **Profile.department:** `🤖 Beat the System`

De stats-aggregaties in `app/voorspellingen/stats/page.tsx` filteren deze
markers **niet** uit — dat is bewust: ze tellen mee als gewone deelnemers in de
"wie gokte hetzelfde"-statistieken. Loadtest- en integration-test-markers
worden wél uitgefilterd in Johan's modus-berekening (zie filter in `seedJohan`).

## Bestand-overzicht

```
scripts/beat-the-system.ts       — Het script zelf (johan/rene/both/cleanup)
data/rene-knowledge.ts            — Rene's odds + groepvoorspelling + bonus
docs/BEAT-THE-SYSTEM.md           — Deze documentatie
```

## Veiligheid

- Het script vereist `SUPABASE_SERVICE_ROLE_KEY` (= admin-rechten op de DB).
- Dry-run is default. `--confirm` is verplicht om écht te schrijven.
- `cleanup` verwijdert **auth-users + alle data** van beide bots permanent.
