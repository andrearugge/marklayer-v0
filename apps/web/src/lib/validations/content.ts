import { z } from "zod";
import { SourcePlatform, ContentType, ContentStatus } from "@prisma/client";

export const CreateContentSchema = z.object({
  url: z.string().url("URL non valido").optional().or(z.literal("")),
  title: z.string().trim().min(1, "Il titolo è obbligatorio").max(500),
  sourcePlatform: z.nativeEnum(SourcePlatform),
  contentType: z.nativeEnum(ContentType),
  rawContent: z.string().trim().optional(),
  excerpt: z.string().trim().max(1000).optional(),
  publishedAt: z
    .string()
    .refine(
      (v) => !v || !isNaN(Date.parse(v)),
      "Data non valida"
    )
    .optional()
    .or(z.literal("")),
});

export type CreateContentData = z.infer<typeof CreateContentSchema>;

// ─── Update schema for PATCH /api/projects/:id/content/:contentId ─────────────

export const UpdateContentSchema = CreateContentSchema.partial().extend({
  status: z.nativeEnum(ContentStatus).optional(),
});

export type UpdateContentData = z.infer<typeof UpdateContentSchema>;

// ─── Edit form schema (no status — changed separately) ────────────────────────

export const EditContentFormSchema = CreateContentSchema.partial();
export type EditContentFormData = z.infer<typeof EditContentFormSchema>;

// ─── Query schema for GET /api/projects/:id/content ──────────────────────────

export const ContentQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.nativeEnum(ContentStatus).optional().catch(undefined),
  sourcePlatform: z.nativeEnum(SourcePlatform).optional().catch(undefined),
  contentType: z.nativeEnum(ContentType).optional().catch(undefined),
  search: z.string().trim().optional(),
  sortBy: z.enum(["createdAt", "publishedAt", "title"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

export type ContentQueryData = z.infer<typeof ContentQuerySchema>;
