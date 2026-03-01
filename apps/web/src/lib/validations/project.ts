import { z } from "zod";

export const CreateProjectSchema = z.object({
  name: z.string().trim().min(1, "Il nome è obbligatorio").max(255),
  description: z.string().trim().max(2000).optional(),
  domain: z.string().trim().max(255).optional(),
});

export const UpdateProjectSchema = CreateProjectSchema.partial().extend({
  status: z.enum(["ACTIVE"]).optional(),
});

export type CreateProjectData = z.infer<typeof CreateProjectSchema>;
export type UpdateProjectData = z.infer<typeof UpdateProjectSchema>;
