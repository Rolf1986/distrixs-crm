"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      console.log("[login] signIn result:", JSON.stringify(result));
      // v5 beta: result is een URL string bij succes, of heeft .error bij falen
      if (result && typeof result === "object" && "error" in result && result.error) {
        setError("Onjuist e-mailadres of wachtwoord");
      } else {
        // succes — navigeer naar dashboard
        window.location.href = "/dashboard";
      }
    } catch (err: unknown) {
      console.log("[login] signIn exception:", err);
      setError("Onjuist e-mailadres of wachtwoord");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold text-slate-900">Distrixs CRM</h1>
          <p className="text-sm text-slate-500 mt-1">Log in op je account</p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">E-mailadres</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="naam@distrixs.nl"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Wachtwoord</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm
                           focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              disabled={loading}
              className="w-full bg-brand-blue hover:bg-brand-blue-dark disabled:opacity-60
                         text-white font-medium py-2 px-4 rounded-lg text-sm transition-colors"
            >
              {loading ? "Inloggen…" : "Inloggen"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
