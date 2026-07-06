import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-8">
      <div className="space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Card className="sm:col-span-2 xl:col-span-2 overflow-hidden rounded-[var(--radius)] border-0">
          <CardHeader className="pb-3">
            <Skeleton className="h-3 w-28 bg-background/15" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-9 w-40 bg-background/15" />
            <Skeleton className="mt-4 h-1 w-full bg-background/15" />
            <Skeleton className="mt-2.5 h-3 w-36 bg-background/15" />
          </CardContent>
        </Card>
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="premium-card overflow-hidden">
            <CardHeader className="pb-3">
              <Skeleton className="h-3 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-7 w-28" />
              <Skeleton className="mt-2.5 h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_350px]">
        <Card className="premium-card">
          <CardHeader className="border-b border-border/40 pb-4 mb-4">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="mt-1 h-3 w-52" />
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-36" />
                </div>
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-0 shadow-none bg-secondary/60">
          <CardHeader className="pb-4">
            <Skeleton className="h-3 w-28" />
          </CardHeader>
          <CardContent className="grid gap-3">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
