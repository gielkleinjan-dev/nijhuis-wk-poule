import { redirect } from "next/navigation";

// Voorspellingen-detail wordt sinds productie-flip in voorspellingen-route
// gerenderd met per-match scoring en alle V2-puntenuitleg. Admin-route stuurt
// daarheen door zodat we één view onderhouden.
export default async function AdminParticipantPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  redirect(`/voorspellingen/${userId}`);
}
