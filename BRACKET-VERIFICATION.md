# Bracket-routing verificatie

Gegenereerd op: 2026-05-20T06:15:24.959Z

## Check 1 — cross-constraint over alle 495 scenarios

Voor elk van de 495 routings checken we: als een groep wordt gerouteerd naar bv. R32-7,
moet die groep ook in de bracket-graaf op die plek toegestaan zijn (5-groepen-lijst per slot).
Bij inconsistentie zou de FIFA-tabel intern fout zijn.

✅ Alle 3960 routings (495 scenarios × 8 routings) consistent met de bracket-graaf.


## Check 2 — 10 sample scenarios met volledig R32-schema

Iedere wedstrijd toont home (groepswinnaar of runner-up) en away (de andere kant).
`1E` = winnaar Poule E, `2A` = runner-up Poule A, `3F` = nummer 3 van Poule F.
De 8 R32-wedstrijden met een 3rd-placed komen automatisch uit de FIFA-tabel.

### Scenario 1 — FIFA's canonieke optie 1 (E,F,G,H,I,J,K,L)
8 beste nummers 3 uit poules: **E, F, G, H, I, J, K, L**
Niet-doorgaande nrs 3: A, B, C, D

| Wedstrijd | Home | Away |
|---|---|---|
| R32-1 (M73) | 2A | 2B |
| R32-2 (M74) | 1E | 3F |
| R32-3 (M75) | 1F | 2C |
| R32-4 (M76) | 1C | 2F |
| R32-5 (M77) | 1I | 3G |
| R32-6 (M78) | 2E | 2I |
| R32-7 (M79) | 1A | 3E |
| R32-8 (M80) | 1L | 3K |
| R32-9 (M81) | 1D | 3I |
| R32-10 (M82) | 1G | 3H |
| R32-11 (M83) | 1B | 2J |
| R32-12 (M84) | 1J | 2D |
| R32-13 (M85) | 1H | 3J |
| R32-14 (M86) | 2L | 2H |
| R32-15 (M87) | 1K | 3L |
| R32-16 (M88) | 2K | 2G |


### Scenario 2 — FIFA's canonieke optie 495 (A,B,C,D,E,F,G,H)
8 beste nummers 3 uit poules: **A, B, C, D, E, F, G, H**
Niet-doorgaande nrs 3: I, J, K, L

| Wedstrijd | Home | Away |
|---|---|---|
| R32-1 (M73) | 2A | 2B |
| R32-2 (M74) | 1E | 3C |
| R32-3 (M75) | 1F | 2C |
| R32-4 (M76) | 1C | 2F |
| R32-5 (M77) | 1I | 3F |
| R32-6 (M78) | 2E | 2I |
| R32-7 (M79) | 1A | 3H |
| R32-8 (M80) | 1L | 3E |
| R32-9 (M81) | 1D | 3B |
| R32-10 (M82) | 1G | 3A |
| R32-11 (M83) | 1B | 2J |
| R32-12 (M84) | 1J | 2D |
| R32-13 (M85) | 1H | 3G |
| R32-14 (M86) | 2L | 2H |
| R32-15 (M87) | 1K | 3D |
| R32-16 (M88) | 2K | 2G |


### Scenario 3 — willekeurig (seed 42)
8 beste nummers 3 uit poules: **A, D, E, F, G, I, J, L**
Niet-doorgaande nrs 3: B, C, H, K

| Wedstrijd | Home | Away |
|---|---|---|
| R32-1 (M73) | 2A | 2B |
| R32-2 (M74) | 1E | 3D |
| R32-3 (M75) | 1F | 2C |
| R32-4 (M76) | 1C | 2F |
| R32-5 (M77) | 1I | 3F |
| R32-6 (M78) | 2E | 2I |
| R32-7 (M79) | 1A | 3E |
| R32-8 (M80) | 1L | 3I |
| R32-9 (M81) | 1D | 3J |
| R32-10 (M82) | 1G | 3A |
| R32-11 (M83) | 1B | 2J |
| R32-12 (M84) | 1J | 2D |
| R32-13 (M85) | 1H | 3G |
| R32-14 (M86) | 2L | 2H |
| R32-15 (M87) | 1K | 3L |
| R32-16 (M88) | 2K | 2G |


### Scenario 4 — willekeurig (seed 137)
8 beste nummers 3 uit poules: **B, D, E, F, H, J, K, L**
Niet-doorgaande nrs 3: A, C, G, I

| Wedstrijd | Home | Away |
|---|---|---|
| R32-1 (M73) | 2A | 2B |
| R32-2 (M74) | 1E | 3D |
| R32-3 (M75) | 1F | 2C |
| R32-4 (M76) | 1C | 2F |
| R32-5 (M77) | 1I | 3F |
| R32-6 (M78) | 2E | 2I |
| R32-7 (M79) | 1A | 3E |
| R32-8 (M80) | 1L | 3K |
| R32-9 (M81) | 1D | 3B |
| R32-10 (M82) | 1G | 3H |
| R32-11 (M83) | 1B | 2J |
| R32-12 (M84) | 1J | 2D |
| R32-13 (M85) | 1H | 3J |
| R32-14 (M86) | 2L | 2H |
| R32-15 (M87) | 1K | 3L |
| R32-16 (M88) | 2K | 2G |


### Scenario 5 — willekeurig (seed 256)
8 beste nummers 3 uit poules: **D, E, F, G, H, J, K, L**
Niet-doorgaande nrs 3: A, B, C, I

| Wedstrijd | Home | Away |
|---|---|---|
| R32-1 (M73) | 2A | 2B |
| R32-2 (M74) | 1E | 3D |
| R32-3 (M75) | 1F | 2C |
| R32-4 (M76) | 1C | 2F |
| R32-5 (M77) | 1I | 3F |
| R32-6 (M78) | 2E | 2I |
| R32-7 (M79) | 1A | 3E |
| R32-8 (M80) | 1L | 3K |
| R32-9 (M81) | 1D | 3J |
| R32-10 (M82) | 1G | 3H |
| R32-11 (M83) | 1B | 2J |
| R32-12 (M84) | 1J | 2D |
| R32-13 (M85) | 1H | 3G |
| R32-14 (M86) | 2L | 2H |
| R32-15 (M87) | 1K | 3L |
| R32-16 (M88) | 2K | 2G |


### Scenario 6 — willekeurig (seed 512)
8 beste nummers 3 uit poules: **A, B, C, D, E, G, K, L**
Niet-doorgaande nrs 3: F, H, I, J

| Wedstrijd | Home | Away |
|---|---|---|
| R32-1 (M73) | 2A | 2B |
| R32-2 (M74) | 1E | 3C |
| R32-3 (M75) | 1F | 2C |
| R32-4 (M76) | 1C | 2F |
| R32-5 (M77) | 1I | 3D |
| R32-6 (M78) | 2E | 2I |
| R32-7 (M79) | 1A | 3E |
| R32-8 (M80) | 1L | 3K |
| R32-9 (M81) | 1D | 3B |
| R32-10 (M82) | 1G | 3A |
| R32-11 (M83) | 1B | 2J |
| R32-12 (M84) | 1J | 2D |
| R32-13 (M85) | 1H | 3G |
| R32-14 (M86) | 2L | 2H |
| R32-15 (M87) | 1K | 3L |
| R32-16 (M88) | 2K | 2G |


### Scenario 7 — willekeurig (seed 1024)
8 beste nummers 3 uit poules: **A, C, D, F, G, H, J, K**
Niet-doorgaande nrs 3: B, E, I, L

| Wedstrijd | Home | Away |
|---|---|---|
| R32-1 (M73) | 2A | 2B |
| R32-2 (M74) | 1E | 3C |
| R32-3 (M75) | 1F | 2C |
| R32-4 (M76) | 1C | 2F |
| R32-5 (M77) | 1I | 3F |
| R32-6 (M78) | 2E | 2I |
| R32-7 (M79) | 1A | 3H |
| R32-8 (M80) | 1L | 3K |
| R32-9 (M81) | 1D | 3J |
| R32-10 (M82) | 1G | 3A |
| R32-11 (M83) | 1B | 2J |
| R32-12 (M84) | 1J | 2D |
| R32-13 (M85) | 1H | 3G |
| R32-14 (M86) | 2L | 2H |
| R32-15 (M87) | 1K | 3D |
| R32-16 (M88) | 2K | 2G |


### Scenario 8 — willekeurig (seed 2048)
8 beste nummers 3 uit poules: **A, B, C, E, G, H, J, L**
Niet-doorgaande nrs 3: D, F, I, K

| Wedstrijd | Home | Away |
|---|---|---|
| R32-1 (M73) | 2A | 2B |
| R32-2 (M74) | 1E | 3C |
| R32-3 (M75) | 1F | 2C |
| R32-4 (M76) | 1C | 2F |
| R32-5 (M77) | 1I | 3G |
| R32-6 (M78) | 2E | 2I |
| R32-7 (M79) | 1A | 3H |
| R32-8 (M80) | 1L | 3E |
| R32-9 (M81) | 1D | 3B |
| R32-10 (M82) | 1G | 3A |
| R32-11 (M83) | 1B | 2J |
| R32-12 (M84) | 1J | 2D |
| R32-13 (M85) | 1H | 3J |
| R32-14 (M86) | 2L | 2H |
| R32-15 (M87) | 1K | 3L |
| R32-16 (M88) | 2K | 2G |


### Scenario 9 — willekeurig (seed 4096)
8 beste nummers 3 uit poules: **A, C, E, G, H, I, J, L**
Niet-doorgaande nrs 3: B, D, F, K

| Wedstrijd | Home | Away |
|---|---|---|
| R32-1 (M73) | 2A | 2B |
| R32-2 (M74) | 1E | 3C |
| R32-3 (M75) | 1F | 2C |
| R32-4 (M76) | 1C | 2F |
| R32-5 (M77) | 1I | 3H |
| R32-6 (M78) | 2E | 2I |
| R32-7 (M79) | 1A | 3E |
| R32-8 (M80) | 1L | 3I |
| R32-9 (M81) | 1D | 3J |
| R32-10 (M82) | 1G | 3A |
| R32-11 (M83) | 1B | 2J |
| R32-12 (M84) | 1J | 2D |
| R32-13 (M85) | 1H | 3G |
| R32-14 (M86) | 2L | 2H |
| R32-15 (M87) | 1K | 3L |
| R32-16 (M88) | 2K | 2G |


### Scenario 10 — willekeurig (seed 8192)
8 beste nummers 3 uit poules: **A, C, D, E, G, I, K, L**
Niet-doorgaande nrs 3: B, F, H, J

| Wedstrijd | Home | Away |
|---|---|---|
| R32-1 (M73) | 2A | 2B |
| R32-2 (M74) | 1E | 3C |
| R32-3 (M75) | 1F | 2C |
| R32-4 (M76) | 1C | 2F |
| R32-5 (M77) | 1I | 3D |
| R32-6 (M78) | 2E | 2I |
| R32-7 (M79) | 1A | 3E |
| R32-8 (M80) | 1L | 3K |
| R32-9 (M81) | 1D | 3I |
| R32-10 (M82) | 1G | 3A |
| R32-11 (M83) | 1B | 2J |
| R32-12 (M84) | 1J | 2D |
| R32-13 (M85) | 1H | 3G |
| R32-14 (M86) | 2L | 2H |
| R32-15 (M87) | 1K | 3L |
| R32-16 (M88) | 2K | 2G |

