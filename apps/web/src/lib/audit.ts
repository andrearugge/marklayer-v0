import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export const AUDIT_ACTIONS = {
  // User
  USER_CREATED: "user.created",
  USER_LOGIN: "user.login",
  USER_ROLE_CHANGED: "user.role_changed",
  USER_STATUS_CHANGED: "user.status_changed",
  // Project
  PROJECT_CREATED: "project.created",
  PROJECT_UPDATED: "project.updated",
  PROJECT_ARCHIVED: "project.archived",
  // Content
  CONTENT_CREATED: "content.created",
  CONTENT_UPDATED: "content.updated",
  CONTENT_DELETED: "content.deleted",
  CONTENT_IMPORTED: "content.imported",
  CONTENT_BULK_ACTION: "content.bulk_action",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

interface AuditEventData {
  action: AuditAction;
  actorId?: string;
  actorEmail?: string;
  targetId?: string;
  targetEmail?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Logs an audit event. Never throws — failures are silently logged to console
 * so that audit logging never breaks the primary request flow.
 */
export async function logAuditEvent(data: AuditEventData): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        ...data,
        metadata: data.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (err) {
    console.error("[audit] Failed to log event:", err);
  }
}
