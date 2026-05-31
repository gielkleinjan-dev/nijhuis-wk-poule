// Supabase / PostgREST capt by default op 1000 rijen per request (zie max-rows
// in PostgREST config). Voor queries die ALLE rijen van een tabel willen lezen
// — bv. aggregaties over alle deelnemers — moeten we pagineren via .range().
//
// Achtergrond: in mei 2026 viel het op toen Mark in de admin-overview maar
// 51/72 zag staan terwijl hij 72 predictions in de DB had. Oorzaak: de admin-
// query haalt alle predictions binnen, maar liep tegen de 1000-row cap aan
// (1783 predictions in totaal → 783 rijen werden niet getoond).
//
// Use `fetchAllRows` waar je echt alle rijen nodig hebt. Voor counts/aggregates
// die je niet zelf hoeft te tellen: gebruik `{ count: "exact", head: true }`
// op de query zelf — dat retourneert geen data en heeft geen row-cap.

/**
 * Minimum interface waar de helper mee werkt: een query-builder waar je
 * `.range(from, to)` op kan callen en die een `{ data, error }` thenable
 * teruggeeft. Past op alle PostgrestFilterBuilder-instances.
 */
type RangeBuilder<T> = {
  range(from: number, to: number): PromiseLike<{ data: T[] | null; error: { message: string } | null }>;
};

/**
 * Haalt ALLE rijen op door te pagineren in chunks van `pageSize`. Vereist
 * een builder-factory zodat we elk page een verse query maken (PostgrestFilter-
 * Builder kan niet hergebruikt worden na een fetch).
 *
 * @example
 *   const predictions = await fetchAllRows<{ user_id: string }>(
 *     () => supabase.from("predictions").select("user_id"),
 *   );
 */
export async function fetchAllRows<T>(
  builder: () => RangeBuilder<T>,
  pageSize = 1000,
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  // Safety cap: 50 pages = 50.000 rijen. Met 150 deelnemers × max ~170 picks
  // zit het toernooi onder de 30k rijen — 50 is dik ruim.
  for (let page = 0; page < 50; page++) {
    const { data, error } = await builder().range(from, from + pageSize - 1);
    if (error) throw new Error(`fetchAllRows: ${error.message}`);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return all;
}
