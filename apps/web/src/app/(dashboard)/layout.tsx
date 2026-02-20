import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Header } from "@/components/dashboard/header";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const currentUser = await getCurrentUser();
  let projectCount = 0;
  if (currentUser) {
    try {
      projectCount = await prisma.project.count({
        where: { userId: currentUser.id, status: "ACTIVE" },
      });
    } catch {
      // fail silently — sidebar renders without count
    }
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar projectCount={projectCount} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header projectCount={projectCount} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
