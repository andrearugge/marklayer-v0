import { z } from "zod";

export const UpdateProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Il nome deve avere almeno 2 caratteri")
    .max(100, "Il nome non può superare i 100 caratteri"),
  image: z
    .string()
    .url("Inserisci un URL valido")
    .optional()
    .or(z.literal("")),
});

export type UpdateProfileData = z.infer<typeof UpdateProfileSchema>;
