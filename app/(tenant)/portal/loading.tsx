import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function PortalLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-2">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-60" />
      </div>

      <Card className="overflow-hidden rounded-[var(--radius)] border-0">
        <CardHeader className="pb-3">
          <Skeleton className="h-3 w-24 bg-background/15" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-9 w-40 bg-background/15" />
          <Skeleton className="mt-2.5 h-3 w-48 bg-background/15" />
          <Skeleton className="mt-5 h-11 w-full rounded-xl bg-background/15" />
        </CardContent>
      </Card>

      <Card className="premium-card">
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row">
          <Skeleton className="h-11 flex-1 rounded-xl" />
          <Skeleton className="h-11 flex-1 rounded-xl" />
          <Skeleton className="h-11 w-32 rounded-xl" />
        </CardContent>
      </Card>

      <Card className="premium-card">
        <CardHeader className="border-b border-border/40 pb-4">
          <Skeleton className="h-5 w-36" />
        </CardHeader>
        <CardContent className="flex flex-col gap-4 pt-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
