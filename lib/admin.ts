// Hardcoded admin e-mails — zelfde lijst als is_admin() in Supabase.
// Beide aanpassen bij wijziging.
export const ADMIN_EMAILS = [
  "g.kleinjan@nijhuis.nl",
  "gielkleinjan@gmail.com",
  "n.verveda@nijhuis.nl",
  "m.broekhuijsen@nijhuis.nl",
] as const;

export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return (ADMIN_EMAILS as readonly string[]).includes(email);
}
