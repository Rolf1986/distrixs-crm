"use client";

import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

// Zwevende terugknop, op elke pagina behalve het dashboard. Gaat één stap
// terug in de browsergeschiedenis (met behoud van zoektermen/filters).
export function BackButton() {
  const router = useRouter();
  const pathname = usePathname();

  if (pathname === "/" || pathname === "/dashboard") return null;

  return (
    <button
      onClick={() => router.back()}
      title="Terug naar de vorige pagina"
      className="fixed bottom-5 right-5 z-40 flex items-center gap-1.5 rounded-full border border-slate-200 bg-white/95 px-3.5 py-2.5 text-sm font-medium text-slate-600 shadow-lg backdrop-blur hover:text-slate-900 hover:border-slate-300 transition-colors"
    >
      <ArrowLeft className="w-4 h-4" />
      Terug
    </button>
  );
}
