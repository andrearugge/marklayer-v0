"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserRowActions } from "./user-row-actions";

type UserRole = "user" | "admin";
type UserStatus = "active" | "suspended";

export interface UserRow {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
}

function getInitials(name: string | null, email: string) {
  if (name) {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }
  return email[0].toUpperCase();
}

export function createColumns(currentUserId: string): ColumnDef<UserRow>[] {
  return [
    {
      accessorKey: "name",
      header: "Utente",
      cell: ({ row }) => {
        const { name, email, image } = row.original;
        return (
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={image ?? undefined} />
              <AvatarFallback className="text-xs">
                {getInitials(name, email)}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-sm font-medium leading-none">
                {name ?? <span className="text-muted-foreground">—</span>}
              </p>
              <p className="text-xs text-muted-foreground">{email}</p>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: "role",
      header: "Ruolo",
      cell: ({ row }) => {
        const role = row.getValue<UserRole>("role");
        return (
          <Badge variant={role === "admin" ? "default" : "secondary"}>
            {role}
          </Badge>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue<UserStatus>("status");
        return (
          <Badge
            variant={status === "suspended" ? "destructive" : "outline"}
            className={
              status === "active"
                ? "border-green-600 text-green-600"
                : undefined
            }
          >
            {status}
          </Badge>
        );
      },
    },
    {
      accessorKey: "createdAt",
      header: "Registrato",
      cell: ({ row }) => {
        const date = row.getValue<Date>("createdAt");
        return (
          <span className="text-sm text-muted-foreground">
            {new Date(date).toLocaleDateString("it-IT", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </span>
        );
      },
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <UserRowActions user={row.original} currentUserId={currentUserId} />
      ),
    },
  ];
}
