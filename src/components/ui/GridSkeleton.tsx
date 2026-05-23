function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={`bg-bg-secondary rounded-2xl border border-border-main ${className ?? ''}`}>
      <div className="p-4 flex flex-col gap-3 h-full">
        <div className="flex items-center justify-between">
          <div className="h-4 w-24 rounded-lg bg-bg-tertiary" />
          <div className="h-4 w-8 rounded-lg bg-bg-tertiary" />
        </div>
        <div className="h-3 w-16 rounded-lg bg-bg-tertiary" />
        <div className="flex-1 flex flex-col gap-2 pt-1">
          <div className="h-10 rounded-xl bg-bg-tertiary" />
          <div className="h-10 rounded-xl bg-bg-tertiary" />
          <div className="h-10 rounded-xl bg-bg-tertiary opacity-60" />
        </div>
      </div>
    </div>
  )
}

export function GridSkeleton() {
  return (
    <div className="animate-pulse">
      {/* Row 1 — 4 columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <SkeletonCard className="h-[500px]" />
        <SkeletonCard className="h-[500px]" />
        <SkeletonCard className="h-[400px]" />
        <SkeletonCard className="h-[600px]" />
      </div>
      {/* Row 2 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <SkeletonCard className="h-[300px]" />
        <SkeletonCard className="h-[500px]" />
        <div className="lg:col-span-2 grid grid-rows-2 gap-4">
          <SkeletonCard className="h-[200px]" />
          <SkeletonCard className="h-[200px]" />
        </div>
      </div>
      {/* Row 3 — full width */}
      <SkeletonCard className="h-[300px] mb-4" />
    </div>
  )
}
