import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Project layout — ownership guard only.
 * Sets no extra wrappers to avoid Next.js streaming hydration mismatches
 * (Client Component wrappers at layout level interfere with Suspense boundaries).
 * The sidebar reads project info client-side via useParams() + fetch.
 */
export default async function ProjectLayout({
  params,
  children,
}: {
  params: Promise<{ id: string }>;
  children: React.ReactNode;
}) {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");

  const { id } = await params;

  const project = await prisma.project.findFirst({
    where: { id, userId: currentUser.id },
    select: { id: true },
  });

  if (!project) notFound();

  return <>{children}</>;
}
