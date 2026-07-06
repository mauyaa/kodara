import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function PropertiesLoading() {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-9 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-36 rounded-lg" />
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="premium-card h-full">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-4">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-40" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 border-t border-border/40 pt-5 mt-2">
                <div className="space-y-1.5">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-6 w-12" />
                </div>
                <div className="space-y-1.5">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-6 w-20" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
