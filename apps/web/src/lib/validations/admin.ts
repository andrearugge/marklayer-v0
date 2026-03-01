import { z } from "zod";

export const UsersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  role: z.enum(["user", "admin"]).optional(),
  status: z.enum(["active", "suspended"]).optional(),
  search: z.string().trim().optional(),
});

export const UpdateUserSchema = z
  .object({
    role: z.enum(["user", "admin"]).optional(),
    status: z.enum(["active", "suspended"]).optional(),
  })
  .refine((data) => data.role !== undefined || data.status !== undefined, {
    message: "At least one field (role or status) must be provided",
  });

export type UsersQuery = z.infer<typeof UsersQuerySchema>;
export type UpdateUserData = z.infer<typeof UpdateUserSchema>;

export const AuditLogsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  action: z
    .enum([
      "user.created",
      "user.login",
      "user.role_changed",
      "user.status_changed",
    ])
    .optional(),
});

export type AuditLogsQuery = z.infer<typeof AuditLogsQuerySchema>;

export const CreateUserSchema = z.object({
  name: z.string().min(2, "Nome di almeno 2 caratteri"),
  email: z.string().email("Email non valida"),
  password: z
    .string()
    .min(8, "Minimo 8 caratteri")
    .regex(/[A-Z]/, "Richiesta almeno una lettera maiuscola")
    .regex(/[0-9]/, "Richiesto almeno un numero"),
  role: z.enum(["user", "admin"]).default("user"),
});
export type CreateUserFormValues = z.infer<typeof CreateUserSchema>;
