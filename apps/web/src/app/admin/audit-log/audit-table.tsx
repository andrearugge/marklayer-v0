"use client";

import type { AuditLog } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const ACTION_CONFIG: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" | "destructive" }
> = {
  "user.created": { label: "Registrazione", variant: "default" },
  "user.login": { label: "Login", variant: "outline" },
  "user.role_changed": { label: "Cambio ruolo", variant: "secondary" },
  "user.status_changed": { label: "Cambio status", variant: "secondary" },
};

function MetadataCell({ metadata }: { metadata: AuditLog["metadata"] }) {
  if (!metadata || typeof metadata !== "object") return <span className="text-muted-foreground">—</span>;

  const m = metadata as Record<string, unknown>;

  if (m.oldRole && m.newRole) {
    return (
      <span className="text-xs">
        <span className="text-muted-foreground">{String(m.oldRole)}</span>
        {" → "}
        <span className="font-medium">{String(m.newRole)}</span>
      </span>
    );
  }
  if (m.oldStatus && m.newStatus) {
    return (
      <span className="text-xs">
        <span className="text-muted-foreground">{String(m.oldStatus)}</span>
        {" → "}
        <span className="font-medium">{String(m.newStatus)}</span>
      </span>
    );
  }
  return <span className="text-muted-foreground">—</span>;
}

interface AuditTableProps {
  logs: AuditLog[];
}

export function AuditTable({ logs }: AuditTableProps) {
  if (logs.length === 0) {
    return (
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Evento</TableHead>
              <TableHead>Attore</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Dettagli</TableHead>
              <TableHead>Data</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                Nessun evento trovato.
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Evento</TableHead>
            <TableHead>Attore</TableHead>
            <TableHead>Target</TableHead>
            <TableHead>Dettagli</TableHead>
            <TableHead>Data</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {logs.map((log) => {
            const config = ACTION_CONFIG[log.action] ?? {
              label: log.action,
              variant: "outline" as const,
            };
            return (
              <TableRow key={log.id}>
                <TableCell>
                  <Badge variant={config.variant}>{config.label}</Badge>
                </TableCell>
                <TableCell>
                  <span className="text-sm">
                    {log.actorEmail ?? (
                      <span className="text-muted-foreground">sistema</span>
                    )}
                  </span>
                </TableCell>
                <TableCell>
                  <span className="text-sm">
                    {log.targetEmail !== log.actorEmail && log.targetEmail ? (
                      log.targetEmail
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </span>
                </TableCell>
                <TableCell>
                  <MetadataCell metadata={log.metadata} />
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground">
                    {new Date(log.createdAt).toLocaleString("it-IT", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
