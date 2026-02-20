import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function ProjectDetailLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <Skeleton className="h-4 w-32" />
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-4 w-80" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-24" />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-5 space-y-1">
              <Skeleton className="h-8 w-12" />
              <Skeleton className="h-3 w-28" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Breakdown */}
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-3">
              <Skeleton className="h-4 w-28" />
            </CardHeader>
            <CardContent className="pt-0 space-y-2">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="flex items-center justify-between">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-6" />
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
