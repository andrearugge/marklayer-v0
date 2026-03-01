import {
  LayoutDashboard,
  FolderOpen,
  Settings,
  BarChart2,
  FileText,
  Network,
  BookOpen,
  Lightbulb,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

/** Voci della sidebar globale (non dentro un progetto) */
export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Progetti", href: "/projects", icon: FolderOpen },
  { label: "Impostazioni", href: "/settings", icon: Settings },
];

/** Voci della sidebar quando si è dentro un progetto specifico */
export function getProjectNavItems(projectId: string): NavItem[] {
  const base = `/projects/${projectId}`;
  return [
    { label: "Dashboard", href: base, icon: LayoutDashboard },
    { label: "Contenuti", href: `${base}/content`, icon: FileText },
    { label: "Analisi", href: `${base}/analysis`, icon: BarChart2 },
    { label: "Graph", href: `${base}/graph`, icon: Network },
    { label: "Brief", href: `${base}/briefs`, icon: BookOpen },
    { label: "Azioni", href: `${base}/actions`, icon: Lightbulb },
    { label: "Impostazioni", href: `${base}/settings`, icon: Settings },
  ];
}
