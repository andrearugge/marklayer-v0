import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function BriefsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Skeleton className="h-6 w-28" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-8 w-36" />
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-8 w-20 rounded-full" />
        ))}
      </div>

      {/* Brief cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-3 w-1/2" />
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                {Array.from({ length: 3 }).map((_, j) => (
                  <Skeleton key={j} className="h-3 w-full" />
                ))}
              </div>
              <div className="flex gap-2 pt-1">
                <Skeleton className="h-7 w-20" />
                <Skeleton className="h-7 w-20" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
