"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, ShieldCheck, ShieldOff, UserCheck, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type UserRole = "user" | "admin";
type UserStatus = "active" | "suspended";

interface User {
  id: string;
  name: string | null;
  email: string;
  role: UserRole;
  status: UserStatus;
}

type PendingAction = "promote" | "demote" | "suspend" | "activate";

const ACTION_CONFIG: Record<
  PendingAction,
  { title: string; description: (user: User) => string; label: string }
> = {
  promote: {
    title: "Promuovi ad Admin",
    description: (u) =>
      `Sei sicuro di voler promuovere ${u.name ?? u.email} al ruolo Admin? Avrà accesso completo al pannello amministrativo.`,
    label: "Promuovi",
  },
  demote: {
    title: "Rimuovi Admin",
    description: (u) =>
      `Sei sicuro di voler rimuovere i privilegi Admin da ${u.name ?? u.email}?`,
    label: "Rimuovi",
  },
  suspend: {
    title: "Sospendi utente",
    description: (u) =>
      `Sei sicuro di voler sospendere ${u.name ?? u.email}? Non potrà più accedere all'applicazione.`,
    label: "Sospendi",
  },
  activate: {
    title: "Riattiva utente",
    description: (u) =>
      `Sei sicuro di voler riattivare ${u.name ?? u.email}?`,
    label: "Riattiva",
  },
};

interface UserRowActionsProps {
  user: User;
  currentUserId: string;
}

export function UserRowActions({ user, currentUserId }: UserRowActionsProps) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const isSelf = user.id === currentUserId;

  async function handleConfirm() {
    if (!pendingAction) return;
    setIsLoading(true);

    const body: { role?: UserRole; status?: UserStatus } = {};
    if (pendingAction === "promote") body.role = "admin";
    if (pendingAction === "demote") body.role = "user";
    if (pendingAction === "suspend") body.status = "suspended";
    if (pendingAction === "activate") body.status = "active";

    await fetch(`/api/admin/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    setIsLoading(false);
    setPendingAction(null);
    router.refresh();
  }

  if (isSelf) return null;

  const config = pendingAction ? ACTION_CONFIG[pendingAction] : null;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
            <span className="sr-only">Azioni</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Azioni</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {user.role === "user" ? (
            <DropdownMenuItem onClick={() => setPendingAction("promote")}>
              <ShieldCheck className="mr-2 h-4 w-4" />
              Promuovi ad Admin
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => setPendingAction("demote")}>
              <ShieldOff className="mr-2 h-4 w-4" />
              Rimuovi Admin
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          {user.status === "active" ? (
            <DropdownMenuItem
              onClick={() => setPendingAction("suspend")}
              className="text-destructive focus:text-destructive"
            >
              <UserX className="mr-2 h-4 w-4" />
              Sospendi
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem onClick={() => setPendingAction("activate")}>
              <UserCheck className="mr-2 h-4 w-4" />
              Riattiva
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog
        open={pendingAction !== null}
        onOpenChange={(open) => !open && setPendingAction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{config?.title}</AlertDialogTitle>
            <AlertDialogDescription>
              {config?.description(user)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isLoading}>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={isLoading}>
              {isLoading ? "..." : config?.label}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
