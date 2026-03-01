"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useProjectNav } from "./project-nav-context";

const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  projects: "Progetti",
  content: "Contenuti",
  discovery: "Discovery",
  analysis: "Analisi",
  graph: "Graph",
  briefs: "Brief",
  actions: "Azioni",
  settings: "Impostazioni",
  admin: "Admin",
  users: "Users",
  profile: "Profile",
  "audit-log": "Audit Log",
};

// UUID v4 pattern — replaced by project name when available
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getLabel(segment: string, projectName?: string): string {
  if (UUID_RE.test(segment)) return projectName ?? "Dettaglio";
  return SEGMENT_LABELS[segment] ?? segment.charAt(0).toUpperCase() + segment.slice(1);
}

export function Breadcrumbs() {
  const pathname = usePathname();
  const projectNav = useProjectNav();

  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  const crumbs: { label: string; href: string }[] = [];
  let currentPath = "";

  for (const segment of segments) {
    currentPath += `/${segment}`;
    crumbs.push({
      label: getLabel(segment, UUID_RE.test(segment) ? projectNav?.projectName : undefined),
      href: currentPath,
    });
  }

  if (crumbs.length <= 1) {
    return <span className="text-sm font-medium">{crumbs[0]?.label}</span>;
  }

  return (
    <nav aria-label="Breadcrumb">
      <ol className="flex items-center gap-1 text-sm">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1;
          return (
            <li key={crumb.href} className="flex items-center gap-1">
              {index > 0 && (
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              {isLast ? (
                <span className="font-medium text-foreground">{crumb.label}</span>
              ) : (
                <Link
                  href={crumb.href}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
