"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function Breadcrumbs() {
  const pathname = usePathname();
  const [projectName, setProjectName] = useState<string>("");

  const segments = pathname.split("/").filter(Boolean);
  const projectId = segments.find((s) => UUID_RE.test(s)) ?? null;

  useEffect(() => {
    if (!projectId) {
      setProjectName("");
      return;
    }
    let cancelled = false;
    fetch(`/api/projects/${projectId}`)
      .then((r) => r.json())
      .then((d) => { if (!cancelled && d.data?.name) setProjectName(d.data.name); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [projectId]);

  if (segments.length === 0) return null;

  const crumbs: { label: string; href: string }[] = [];
  let currentPath = "";

  for (const segment of segments) {
    currentPath += `/${segment}`;
    let label: string;
    if (UUID_RE.test(segment)) {
      label = projectName || "…";
    } else {
      label = SEGMENT_LABELS[segment] ?? segment.charAt(0).toUpperCase() + segment.slice(1);
    }
    crumbs.push({ label, href: currentPath });
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
