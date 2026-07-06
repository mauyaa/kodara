import { Skeleton } from "@/components/ui/skeleton";

function ColumnSkeleton({ count }: { count: number }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 mb-2">
        <Skeleton className="h-4 w-4 rounded-full" />
        <Skeleton className="h-4 w-20" />
      </div>
      <div className="bg-secondary/40 rounded-2xl p-3 min-h-[160px] md:min-h-[500px] flex flex-col gap-3">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border/60 bg-card p-4 space-y-2">
            <Skeleton className="h-4 w-16 rounded-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function MaintenanceLoading() {
  return (
    <div className="flex flex-col gap-8 h-full">
      <div className="space-y-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start h-full">
        <ColumnSkeleton count={2} />
        <ColumnSkeleton count={1} />
        <ColumnSkeleton count={1} />
      </div>
    </div>
  );
}
