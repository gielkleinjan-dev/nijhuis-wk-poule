-- Bracket V2 — 3 RPC's voor de 3-fasen knock-out flow.
--
-- Status: NIET TOEGEPAST in productie. Pas uitvoeren via Supabase MCP
-- (apply_migration) zodra de UI klaar is en feature-flag aan gaat.
-- Tot dan: V1 KO-flow blijft volledig functioneel, deze RPC's voegen alleen
-- nieuwe save-paden toe.
--
-- Backward-compatibility: deze migratie raakt bestaande tabellen en functies
-- niet aan. Alleen 3 nieuwe functies. RLS-policies op bracket_picks blijven
-- ongewijzigd (round-agnostisch via auth.uid() = user_id).
--
-- Beveiliging: alle 3 RPC's zijn SECURITY DEFINER met expliciete auth.uid()
-- check + is_locked() check. Service-role gebruikers omzeilen deze checks
-- (door PostgreSQL ontwerp). User-session aanroepers krijgen alleen toegang
-- tot hun eigen rijen.

-- ============================================================================
-- 1. bracket_v2_save_phase_a — vervangt alle GROUP_TOP_2 picks voor user
-- ============================================================================
-- Input: jsonb mapping group_code → {rank1, rank2}.
-- Bijvoorbeeld: {"A": {"rank1": "BRA", "rank2": "MEX"}, "B": {"rank1": "ARG"}, ...}
-- Lege groepen worden overgeslagen. rank1 of rank2 mogen ontbreken.
-- Resultaat: 0..24 rijen in bracket_picks met round='GROUP_TOP_2', slot=1 of 2.

create or replace function public.bracket_v2_save_phase_a(p_picks jsonb)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'unauthorized: geen ingelogde gebruiker';
  end if;
  if public.is_locked() then
    raise exception 'locked: poule is gesloten';
  end if;

  -- Verwijder alle bestaande GROUP_TOP_2 picks
  delete from public.bracket_picks
  where user_id = v_user_id and round = 'GROUP_TOP_2';

  -- Insert nieuwe rijen per group (slot 1 = rank1, slot 2 = rank2)
  insert into public.bracket_picks (user_id, round, slot, team_code)
  select v_user_id, 'GROUP_TOP_2', 1, value->>'rank1'
  from jsonb_each(p_picks) as t(key, value)
  where value->>'rank1' is not null
  union all
  select v_user_id, 'GROUP_TOP_2', 2, value->>'rank2'
  from jsonb_each(p_picks) as t(key, value)
  where value->>'rank2' is not null;
end;
$function$;


-- ============================================================================
-- 2. bracket_v2_save_phase_b — vervangt alle BEST_THIRDS picks voor user
-- ============================================================================
-- Input: array van max 8 team_codes (gekozen 3rd-placed teams).
-- Lege array = geen picks. Validatie op uniciteit + geen overlap met phase A
-- wordt aan de client overgelaten (UI dwingt dit af). Server-side: alleen
-- max-8 limiet.

create or replace function public.bracket_v2_save_phase_b(p_teams text[])
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid;
  v_team text;
  v_slot int := 0;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'unauthorized: geen ingelogde gebruiker';
  end if;
  if public.is_locked() then
    raise exception 'locked: poule is gesloten';
  end if;
  if array_length(p_teams, 1) > 8 then
    raise exception 'phase B accepteert maximaal 8 teams, kreeg %', array_length(p_teams, 1);
  end if;

  delete from public.bracket_picks
  where user_id = v_user_id and round = 'BEST_THIRDS';

  if p_teams is not null and array_length(p_teams, 1) > 0 then
    foreach v_team in array p_teams loop
      insert into public.bracket_picks (user_id, round, slot, team_code)
      values (v_user_id, 'BEST_THIRDS', v_slot, v_team);
      v_slot := v_slot + 1;
    end loop;
  end if;
end;
$function$;


-- ============================================================================
-- 3. bracket_v2_save_match — upsert één bracket-match keuze + cascade-clear
-- ============================================================================
-- Input:
--   p_match_id: 'R32-N', 'R16-N', 'QF-N', 'SF-1', 'SF-2', of 'F-1'
--   p_winner: team_code, of null om de keuze te wissen
--   p_clear_descendants: lijst MatchId's die ook gewist moeten worden
--     (door client berekend via lib/bracket/cascade.ts smartClearAfterMatchChange)
-- Round wordt afgeleid uit p_match_id, slot uit het match-nummer.

create or replace function public.bracket_v2_save_match(
  p_match_id text,
  p_winner text,
  p_clear_descendants text[] default array[]::text[]
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_user_id uuid;
  v_round text;
  v_slot int;
  v_desc text;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'unauthorized: geen ingelogde gebruiker';
  end if;
  if public.is_locked() then
    raise exception 'locked: poule is gesloten';
  end if;

  -- Afleiden round + slot uit match_id
  -- 'R32-N' → round='LAST_32', slot=N
  -- 'R16-N' → 'LAST_16'
  -- 'QF-N' → 'QUARTER_FINALS'
  -- 'SF-1'/'SF-2' → 'SEMI_FINALS', slot=1 of 2
  -- 'F-1' → 'FINAL', slot=1
  if p_match_id like 'R32-%' then
    v_round := 'LAST_32';
    v_slot := substring(p_match_id from 5)::int;
  elsif p_match_id like 'R16-%' then
    v_round := 'LAST_16';
    v_slot := substring(p_match_id from 5)::int;
  elsif p_match_id like 'QF-%' then
    v_round := 'QUARTER_FINALS';
    v_slot := substring(p_match_id from 4)::int;
  elsif p_match_id like 'SF-%' then
    v_round := 'SEMI_FINALS';
    v_slot := substring(p_match_id from 4)::int;
  elsif p_match_id = 'F-1' then
    v_round := 'FINAL';
    v_slot := 1;
  else
    raise exception 'onbekende match_id: %', p_match_id;
  end if;

  -- Upsert (of delete) de match-keuze
  if p_winner is null then
    delete from public.bracket_picks
    where user_id = v_user_id and round = v_round and slot = v_slot;
  else
    insert into public.bracket_picks (user_id, round, slot, team_code)
    values (v_user_id, v_round, v_slot, p_winner)
    on conflict (user_id, round, slot)
    do update set team_code = excluded.team_code;
  end if;

  -- Cascade-clear van downstream matches die ongeldig werden
  if p_clear_descendants is not null then
    foreach v_desc in array p_clear_descendants loop
      if v_desc like 'R32-%' then
        delete from public.bracket_picks
        where user_id = v_user_id and round = 'LAST_32' and slot = substring(v_desc from 5)::int;
      elsif v_desc like 'R16-%' then
        delete from public.bracket_picks
        where user_id = v_user_id and round = 'LAST_16' and slot = substring(v_desc from 5)::int;
      elsif v_desc like 'QF-%' then
        delete from public.bracket_picks
        where user_id = v_user_id and round = 'QUARTER_FINALS' and slot = substring(v_desc from 4)::int;
      elsif v_desc like 'SF-%' then
        delete from public.bracket_picks
        where user_id = v_user_id and round = 'SEMI_FINALS' and slot = substring(v_desc from 4)::int;
      elsif v_desc = 'F-1' then
        delete from public.bracket_picks
        where user_id = v_user_id and round = 'FINAL' and slot = 1;
      end if;
    end loop;
  end if;
end;
$function$;


-- ============================================================================
-- ROLLBACK (mocht het nodig zijn)
-- ============================================================================
-- drop function if exists public.bracket_v2_save_phase_a(jsonb);
-- drop function if exists public.bracket_v2_save_phase_b(text[]);
-- drop function if exists public.bracket_v2_save_match(text, text, text[]);
