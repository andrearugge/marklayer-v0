import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AuditLogsQuerySchema } from "@/lib/validations/admin";
import { AuditTable } from "./audit-table";
import { AuditFilters } from "./filters";
import { AuditPagination } from "./pagination";

interface AuditLogPageProps {
  searchParams: Promise<{ page?: string; action?: string }>;
}

export default async function AuditLogPage({ searchParams }: AuditLogPageProps) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "admin") redirect("/dashboard");

  const rawParams = await searchParams;
  const parsed = AuditLogsQuerySchema.safeParse({
    page: rawParams.page,
    limit: "20",
    action: rawParams.action,
  });

  const { page, limit, action } = parsed.success
    ? parsed.data
    : { page: 1, limit: 20, action: undefined };

  const where = action ? { action } : {};

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Audit Log</h1>
        <p className="text-muted-foreground">
          {total} event{total === 1 ? "o" : "i"} registrat{total === 1 ? "o" : "i"}
        </p>
      </div>

      <AuditFilters initialAction={action ?? ""} />

      <AuditTable logs={logs} />

      <AuditPagination page={page} totalPages={totalPages} total={total} />
    </div>
  );
}
