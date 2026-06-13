import { ChromeSkeleton, HeroSkeleton, RowsSkeleton } from "@/app/components/Skeletons";

export default function Loading() {
  return (
    <main className="min-h-screen">
      <ChromeSkeleton maxWidth="max-w-4xl" />
      <div className="mx-auto max-w-4xl px-6 py-8 space-y-4">
        <div className="flex flex-wrap gap-2">
          {["w-14", "w-20", "w-16", "w-24", "w-16"].map((w, i) => (
            <div key={i} className={`skeleton h-7 ${w} rounded-full`} />
          ))}
        </div>
        <div className="flex flex-col lg:grid lg:grid-cols-[1fr_17rem] gap-6">
          <HeroSkeleton />
          <HeroSkeleton />
          <div className="space-y-4">
            <div className="skeleton h-11 w-full" />
            <RowsSkeleton rows={10} />
          </div>
          <RowsSkeleton rows={6} />
        </div>
      </div>
    </main>
  );
}
