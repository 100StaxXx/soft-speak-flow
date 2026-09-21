import { z } from "zod";

export const newPasswordSchema = z.string()
  .min(8, "Password must be at least 8 characters")
  .max(100, "Password too long")
  .regex(
    /^(?=.*[a-zA-Z])(?=.*[0-9]|.*[^a-zA-Z0-9])/,
    "Password must contain letters and at least one number or special character",
  );

export const loginPasswordSchema = z.string()
  .min(1, "Enter your password")
  .max(100, "Password too long");
