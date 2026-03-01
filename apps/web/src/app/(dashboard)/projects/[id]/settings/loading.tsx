import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function SettingsLoading() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div className="space-y-1">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-4 w-56" />
      </div>

      {/* General info card */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-9 w-full" />
            </div>
          ))}
          <Skeleton className="h-9 w-24 mt-2" />
        </CardContent>
      </Card>

      {/* Danger zone card */}
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-28" />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-72" />
          </div>
          <Skeleton className="h-9 w-32" />
        </CardContent>
      </Card>
    </div>
  );
}
