import { z } from "zod";

export const LoginSchema = z.object({
  email: z.string().email("Inserisci un indirizzo email valido"),
  password: z.string().min(1, "La password è obbligatoria"),
});

export const RegisterSchema = z
  .object({
    name: z.string().min(2, "Il nome deve avere almeno 2 caratteri"),
    email: z.string().email("Inserisci un indirizzo email valido"),
    password: z
      .string()
      .min(8, "La password deve avere almeno 8 caratteri")
      .regex(/[A-Z]/, "La password deve contenere almeno una lettera maiuscola")
      .regex(/[0-9]/, "La password deve contenere almeno un numero"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Le password non coincidono",
    path: ["confirmPassword"],
  });

export type LoginFormValues = z.infer<typeof LoginSchema>;
export type RegisterFormValues = z.infer<typeof RegisterSchema>;
