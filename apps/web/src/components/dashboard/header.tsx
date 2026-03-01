import { MobileNav } from "./mobile-nav";
import { Breadcrumbs } from "./breadcrumbs";
import { NotificationBell } from "./notification-bell";
import { UserButton } from "@/components/auth/user-button";
import { Separator } from "@/components/ui/separator";

export function Header({ projectCount }: { projectCount?: number }) {
  return (
    <header className="sticky top-0 z-50 flex h-14 items-center border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <MobileNav projectCount={projectCount} />
      <Separator orientation="vertical" className="mx-3 h-4 lg:hidden" />
      <div className="flex flex-1 items-center justify-between">
        <Breadcrumbs />
        <div className="flex items-center gap-1">
          <NotificationBell />
          <UserButton />
        </div>
      </div>
    </header>
  );
}
