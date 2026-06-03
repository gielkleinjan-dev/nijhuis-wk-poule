-- Dagelijkse backup van de onvervangbare poule-data.
--
-- Achtergrond: dit project draait op het Supabase free-plan → géén ingebouwde
-- automatische backups. Punten en scores zijn herberekenbaar
-- (computeUserPointRows draait dagelijks) en wedstrijduitslagen worden elke
-- ochtend opnieuw uit de football-data API gehaald — die hoeven dus NIET in de
-- backup. Onvervangbaar (handingevoerd, in geen enkele API) zijn:
--   • predictions, bracket_picks, bonus_picks  → de ingevulde formulieren
--   • profiles                                  → wie is wie (naam/team)
--   • settings                                  → admin-ingevoerde echte uitslagen
--   • bracket_match_overrides                   → admin-ingevoerde echte KO-uitslagen
--
-- Strategie: "allebei" + "hele toernooi bewaren" (door gebruiker gekozen):
--   1. Snapshot-tabel pick_backups (in-DB, super makkelijk te herstellen via SQL)
--   2. JSON-dump naar private Storage-bucket pick-backups (off-table, downloadbaar,
--      overleeft een per-ongeluk-gewiste tabel)
-- De cron /api/cron/backup vult beide dagelijks. Geen retentie/opruiming: alles
-- blijft staan tot na de finale (paar MB totaal).
--
-- Beveiliging: pick_backups + de bucket bevatten ALLE gebruikersdata. RLS staat
-- aan zonder policies, en de bucket is private → alleen de service-role
-- (cron) kan lezen/schrijven. User-sessions komen er niet bij.

-- ============================================================================
-- 1. Snapshot-tabel
-- ============================================================================
create table if not exists public.pick_backups (
  snapshot_date date        not null,
  table_name    text        not null,
  payload       jsonb       not null,
  row_count     integer     not null,
  created_at    timestamptz not null default now(),
  primary key (snapshot_date, table_name)
);

comment on table public.pick_backups is
  'Dagelijkse in-DB snapshot van onvervangbare poule-tabellen. 1 rij per (datum, tabel). Gevuld door /api/cron/backup. Alleen service-role toegang (RLS aan, geen policies).';

alter table public.pick_backups enable row level security;
-- Bewust GEEN policies: alleen service-role (omzeilt RLS) mag erbij.

-- ============================================================================
-- 2. Private Storage-bucket voor de JSON-dumps
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('pick-backups', 'pick-backups', false)
on conflict (id) do nothing;
-- Geen storage.objects policies → bucket is uitsluitend benaderbaar met de
-- service-role key (de cron). Niet publiek, niet via user-sessions.
