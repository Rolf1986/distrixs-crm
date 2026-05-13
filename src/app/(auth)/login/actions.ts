"use server";

import { signIn } from "@/lib/auth";
import { AuthError } from "next-auth";

export async function loginAction(email: string, password: string): Promise<{ error?: string }> {
  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: "/dashboard",
    });
    return {};
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: "Onjuist e-mailadres of wachtwoord" };
    }
    // NEXT_REDIRECT gooit een error die Next.js zelf afhandelt — doorgoooien
    throw err;
  }
}
