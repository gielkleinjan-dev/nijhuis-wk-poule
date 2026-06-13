import { HeroSkeleton, RowsSkeleton } from "@/app/components/Skeletons";

export default function Loading() {
  return (
    <div className="space-y-6">
      <HeroSkeleton />
      <RowsSkeleton rows={10} />
    </div>
  );
}
