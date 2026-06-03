import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { fetchAllRows } from "@/lib/supabase/fetchAll";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Onvervangbare, handingevoerde data. Punten/scores (herberekenbaar) en
// matches (her-ophaalbaar uit de football-data API) staan hier bewust NIET bij.
const BACKUP_TABLES = [
  "predictions",
  "bracket_picks",
  "bonus_picks",
  "profiles",
  "settings",
  "bracket_match_overrides",
] as const;

const STORAGE_BUCKET = "pick-backups";

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: "CRON_SECRET not configured" }, { status: 500 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Service-role key omzeilt RLS — nodig om elke gebruiker zijn rijen te lezen
  // en in pick_backups / de private bucket te schrijven.
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY not configured" }, { status: 500 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { persistSession: false } },
  );

  // Datum in Europe/Amsterdam, zodat de bestandsnaam overeenkomt met "de dag"
  // zoals de poule-beheerder die ervaart (niet de UTC-dag).
  const snapshotDate = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date()); // → "YYYY-MM-DD"

  // 1. Lees alle tabellen + schrijf per tabel een snapshot-rij (idempotent:
  //    onConflict op (snapshot_date, table_name), dus opnieuw draaien op
  //    dezelfde dag overschrijft netjes i.p.v. te dupliceren).
  const tableCounts: Record<string, number> = {};
  const combined: Record<string, unknown[]> = {};
  const errors: { table: string; error: string }[] = [];

  for (const table of BACKUP_TABLES) {
    let rows: unknown[];
    try {
      // Paginatie via de gedeelde helper: PostgREST capt op 1000 rijen/request,
      // en predictions/bracket_picks zitten daar ruim boven.
      rows = await fetchAllRows<unknown>(() => supabase.from(table).select("*"));
    } catch (e) {
      errors.push({ table, error: e instanceof Error ? e.message : String(e) });
      continue;
    }
    tableCounts[table] = rows.length;
    combined[table] = rows;

    const { error: upErr } = await supabase.from("pick_backups").upsert(
      {
        snapshot_date: snapshotDate,
        table_name: table,
        payload: rows,
        row_count: rows.length,
      },
      { onConflict: "snapshot_date,table_name" },
    );
    if (upErr) {
      errors.push({ table: `pick_backups:${table}`, error: upErr.message });
    }
  }

  // 2. Eén gecombineerde JSON-dump naar de private Storage-bucket (off-table,
  //    downloadbaar, overleeft een per-ongeluk-gewiste tabel). upsert=true zodat
  //    een herhaalde run op dezelfde dag het bestand vervangt.
  const dump = {
    snapshot_date: snapshotDate,
    generated_at: new Date().toISOString(),
    row_counts: tableCounts,
    tables: combined,
  };
  const { error: storageErr } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(`${snapshotDate}.json`, JSON.stringify(dump), {
      contentType: "application/json",
      upsert: true,
    });
  if (storageErr) {
    errors.push({ table: "storage", error: storageErr.message });
  }

  return NextResponse.json({
    ok: errors.length === 0,
    snapshot_date: snapshotDate,
    row_counts: tableCounts,
    storage_file: `${STORAGE_BUCKET}/${snapshotDate}.json`,
    errors: errors.length > 0 ? errors : undefined,
  });
}
