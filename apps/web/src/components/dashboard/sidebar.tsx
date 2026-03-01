"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowLeft, ShieldCheck, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { NAV_ITEMS, getProjectNavItems } from "./nav-items";
import { useProjectNav } from "./project-nav-context";

/** Returns true when a sidebar link should be highlighted as active. */
function isActive(pathname: string, itemHref: string, projectBase?: string): boolean {
  // The project dashboard item (/projects/[id]) must be an exact match only,
  // otherwise it would light up for every sub-route of the project.
  if (projectBase && itemHref === projectBase) {
    return pathname === projectBase;
  }
  return pathname === itemHref || pathname.startsWith(itemHref + "/");
}

export function Sidebar({ projectCount }: { projectCount?: number }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const projectNav = useProjectNav();
  const isAdmin = session?.user?.role === "admin";

  const linkClass = (active: boolean) =>
    cn(
      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
      active
        ? "bg-primary/10 text-primary"
        : "text-muted-foreground hover:bg-muted hover:text-foreground"
    );

  return (
    <aside className="hidden h-screen w-60 shrink-0 flex-col border-r bg-background lg:flex">
      {/* Logo */}
      <div className="flex h-14 items-center border-b px-4">
        <Link href="/projects" className="flex items-center gap-2 font-semibold">
          <span className="text-primary">◆</span>
          <span>Visiblee</span>
        </Link>
      </div>

      <ScrollArea className="flex-1 py-4">
        {projectNav ? (
          /* ── PROJECT NAV ─────────────────────────────────────── */
          <nav className="space-y-1 px-2">
            {/* Back link */}
            <Link
              href="/projects"
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4 shrink-0" />
              Tutti i progetti
            </Link>

            {/* Project name header */}
            <div className="px-3 pt-3 pb-1">
              <p
                className="truncate text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                title={projectNav.projectName}
              >
                {projectNav.projectName}
              </p>
            </div>

            {/* Project-specific links */}
            {getProjectNavItems(projectNav.projectId).map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={linkClass(
                  isActive(pathname, item.href, `/projects/${projectNav.projectId}`)
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            ))}
          </nav>
        ) : (
          /* ── GLOBAL NAV ──────────────────────────────────────── */
          <nav className="space-y-1 px-2">
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              const showCount =
                item.href === "/projects" &&
                typeof projectCount === "number" &&
                projectCount > 0;
              return (
                <Link key={item.href} href={item.href} className={linkClass(active)}>
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.label}
                  {showCount && (
                    <span className="ml-auto text-xs tabular-nums">{projectCount}</span>
                  )}
                </Link>
              );
            })}
          </nav>
        )}

        {/* Admin section — always visible at the bottom for admins */}
        {isAdmin && (
          <div className="mt-4 px-2">
            <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Admin
            </p>
            <nav className="space-y-1">
              {[
                { label: "Users", href: "/admin/users", icon: ShieldCheck },
                { label: "Audit Log", href: "/admin/audit-log", icon: ClipboardList },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={linkClass(isActive(pathname, item.href))}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        )}
      </ScrollArea>
    </aside>
  );
}
