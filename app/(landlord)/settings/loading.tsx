import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <div className="flex flex-col gap-8 max-w-2xl mx-auto">
      <div className="space-y-2">
        <Skeleton className="h-3 w-32" />
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <Card className="premium-card">
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="mt-1 h-3 w-48" />
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-4 w-32" />
        </CardContent>
      </Card>
      <Card className="premium-card">
        <CardHeader>
          <Skeleton className="h-5 w-24" />
          <Skeleton className="mt-1 h-3 w-56" />
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
          <Skeleton className="h-10 w-full rounded-xl" />
        </CardContent>
      </Card>
    </div>
  );
}
