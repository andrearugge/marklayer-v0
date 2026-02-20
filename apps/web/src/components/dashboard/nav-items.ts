import {
  LayoutDashboard,
  FolderOpen,
  FileText,
  Network,
  Settings,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Projects", href: "/projects", icon: FolderOpen },
  { label: "Content", href: "/content", icon: FileText },
  { label: "Graph", href: "/graph", icon: Network },
  { label: "Settings", href: "/settings", icon: Settings },
];
