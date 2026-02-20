import { z } from "zod";
import { SourcePlatform, ContentType } from "@prisma/client";

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
