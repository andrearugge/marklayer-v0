import { Skeleton } from "@/components/ui/skeleton";

export default function AuditLogLoading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-44" />
      </div>

      {/* Filter */}
      <Skeleton className="h-10 w-48" />

      {/* Table */}
      <div className="rounded-md border">
        <div className="border-b p-4 flex gap-8">
          {[80, 140, 140, 80, 120].map((w, i) => (
            <Skeleton key={i} className="h-4" style={{ width: w }} />
          ))}
        </div>
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="flex items-center gap-8 p-4 border-b last:border-0">
            <Skeleton className="h-5 w-24 rounded-full" />
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-32" />
          </div>
        ))}
      </div>
    </div>
  );
}
