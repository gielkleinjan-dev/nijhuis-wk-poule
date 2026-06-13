import { ChromeSkeleton, HeroSkeleton, RowsSkeleton } from "@/app/components/Skeletons";

export default function Loading() {
  return (
    <main className="min-h-screen">
      <ChromeSkeleton maxWidth="max-w-4xl" />
      <div className="mx-auto max-w-5xl px-6 py-8 space-y-10">
        <HeroSkeleton />
        <RowsSkeleton rows={12} />
      </div>
    </main>
  );
}
