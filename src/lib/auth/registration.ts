import { z } from "zod";

export const registrationInput = z
  .object({
    email: z.email().max(254),
    password: z.string().min(12, "Use at least 12 characters.").max(200),
    confirm_password: z.string().min(1, "Confirm your password.").max(200),
    terms: z.union([z.literal("1"), z.literal(true)]).optional(),
  })
  .refine((value) => value.password === value.confirm_password, {
    path: ["confirm_password"],
    message: "Passwords do not match. Enter the same password again.",
  });
