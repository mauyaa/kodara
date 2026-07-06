import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function TenantsLoading() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-10 w-40 rounded-xl" />
      </div>

      <Card className="premium-card overflow-hidden">
        <CardHeader className="border-b border-border/40 pb-4">
          <Skeleton className="h-5 w-24" />
        </CardHeader>
        <CardContent className="p-0">
          <div className="flex flex-col divide-y divide-border/40">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between px-6 py-4">
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
