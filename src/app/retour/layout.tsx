import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "RMA / Retourverzoek | Return Request — Distrixs",
  description: "Dien een retourverzoek in bij Distrixs / Submit a return request to Distrixs",
};

export default function RmaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50" style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="font-bold text-slate-900 text-lg tracking-tight">Distrixs</span>
          <a
            href="https://www.distrixs.nl"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            distrixs.nl
          </a>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-6 py-10">{children}</main>
      <footer className="max-w-2xl mx-auto px-6 pb-10 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} Distrixs · KVK / CoC: — ·{" "}
        <a href="mailto:info@distrixs.nl" className="hover:text-slate-600">info@distrixs.nl</a>
      </footer>
    </div>
  );
}
