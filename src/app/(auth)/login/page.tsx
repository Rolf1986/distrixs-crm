"use client";

import { useActionState } from "react";
import { loginAction } from "./actions";

export default function LoginPage() {
  const [error, formAction, pending] = useActionState(
    async (_prev: string, formData: FormData) => {
      try {
        await loginAction(
          formData.get("email") as string,
          formData.get("password") as string
        );
        return "";
      } catch {
        // NEXT_REDIRECT — Next.js handelt de redirect af, geen error tonen
        return "";
      }
    },
    ""
  );

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-slate-900">Distrixs CRM</h1>
          <p className="text-sm text-slate-500 mt-1">Log in op je account</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <form action={formAction} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">E-mailadres</label>
              <input
                type="email"
                name="email"
                required
                autoFocus
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="naam@distrixs.nl"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Wachtwoord</label>
              <input
                type="password"
                name="password"
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="••••••••"
              />
            </div>
            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={pending}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors"
            >
              {pending ? "Inloggen…" : "Inloggen"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
