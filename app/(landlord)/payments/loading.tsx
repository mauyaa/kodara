import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function PaymentsLoading() {
  return (
    <div className="flex flex-col gap-8">
      <div className="space-y-2">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-9 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i} className="premium-card">
            <CardHeader className="pb-3">
              <Skeleton className="h-3 w-28" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-7 w-32" />
              <Skeleton className="mt-2.5 h-3 w-36" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="premium-card overflow-hidden">
        <CardHeader className="border-b border-border/40 pb-4">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="p-0">
          <div className="flex flex-col divide-y divide-border/40">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between px-6 py-4">
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-5 w-24 rounded-full" />
                <Skeleton className="h-4 w-20" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
