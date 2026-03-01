import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UsersQuerySchema } from "@/lib/validations/admin";
import type { UserRole, UserStatus } from "@prisma/client";
import { UserFilters } from "./filters";
import { UsersTable } from "./users-table";
import { UsersPagination } from "./pagination";
import { CreateUserDialog } from "./create-user-dialog";

interface UsersPageProps {
  searchParams: Promise<{
    page?: string;
    role?: string;
    status?: string;
    search?: string;
  }>;
}

export default async function UsersPage({ searchParams }: UsersPageProps) {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "admin") {
    redirect("/dashboard");
  }

  const rawParams = await searchParams;
  const parsed = UsersQuerySchema.safeParse({
    page: rawParams.page,
    limit: "10",
    role: rawParams.role,
    status: rawParams.status,
    search: rawParams.search,
  });

  const { page, limit, role, status, search } = parsed.success
    ? parsed.data
    : { page: 1, limit: 10, role: undefined, status: undefined, search: undefined };

  const where = {
    ...(role ? { role: role as UserRole } : {}),
    ...(status ? { status: status as UserStatus } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" as const } },
            { email: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Users</h1>
          <p className="text-muted-foreground">
            {total} utent{total === 1 ? "e" : "i"} registrat{total === 1 ? "o" : "i"}
          </p>
        </div>
        <CreateUserDialog />
      </div>

      <UserFilters
        initialSearch={search ?? ""}
        initialRole={role ?? ""}
        initialStatus={status ?? ""}
      />

      <UsersTable users={users} currentUserId={currentUser.id} />

      <UsersPagination page={page} totalPages={totalPages} total={total} />
    </div>
  );
}
