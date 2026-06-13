import { HeroSkeleton, RowsSkeleton } from "@/app/components/Skeletons";

export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <HeroSkeleton />
      <RowsSkeleton rows={8} />
    </div>
  );
}
