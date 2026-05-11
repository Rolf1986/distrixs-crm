"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, Handshake, Users, FileText, Receipt, User, X, Loader2 } from "lucide-react";

type ResultType = "deal" | "customer" | "quote" | "invoice" | "contact";

interface SearchResult {
  type: ResultType;
  id: string;
  label: string;
  sub: string;
  href: string;
  status: string | null;
}

const TYPE_ICON: Record<ResultType, React.ReactNode> = {
  deal:     <Handshake className="w-3.5 h-3.5" />,
  customer: <Users className="w-3.5 h-3.5" />,
  quote:    <FileText className="w-3.5 h-3.5" />,
  invoice:  <Receipt className="w-3.5 h-3.5" />,
  contact:  <User className="w-3.5 h-3.5" />,
};

const TYPE_COLOR: Record<ResultType, string> = {
  deal:     "bg-brand-blue-light text-brand-blue",
  customer: "bg-green-100 text-green-600",
  quote:    "bg-violet-100 text-violet-600",
  invoice:  "bg-orange-100 text-orange-600",
  contact:  "bg-slate-100 text-slate-600",
};

const TYPE_LABEL: Record<ResultType, string> = {
  deal:     "Deal",
  customer: "Klant",
  quote:    "Offerte",
  invoice:  "Factuur",
  contact:  "Contact",
};

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cmd+K / Ctrl+K shortcut
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setResults([]);
      setSelected(0);
    }
  }, [open]);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.results ?? []);
      setSelected(0);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setQuery(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(v), 200);
  }

  function navigate(href: string) {
    setOpen(false);
    router.push(href);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelected((s) => Math.min(s + 1, results.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)); }
    if (e.key === "Enter" && results[selected]) { navigate(results[selected].href); }
    if (e.key === "Escape") setOpen(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-slate-400 hover:text-slate-200 transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-800 text-sm"
        title="Zoeken (⌘K)"
      >
        <Search className="w-4 h-4" />
        <span className="hidden lg:inline">Zoeken…</span>
        <kbd className="hidden lg:inline text-xs bg-slate-700 text-slate-400 rounded px-1.5 py-0.5 font-mono">⌘K</kbd>
      </button>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50"
        onClick={() => setOpen(false)}
      />

      {/* Dialog */}
      <div className="fixed top-[20vh] left-1/2 -translate-x-1/2 w-full max-w-xl z-50 shadow-2xl rounded-xl overflow-hidden bg-white">
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200">
          {loading
            ? <Loader2 className="w-4 h-4 text-slate-400 animate-spin shrink-0" />
            : <Search className="w-4 h-4 text-slate-400 shrink-0" />
          }
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder="Zoek deals, klanten, offertes, facturen…"
            className="flex-1 text-sm text-slate-900 placeholder-slate-400 outline-none bg-transparent"
          />
          <button onClick={() => setOpen(false)} className="text-slate-300 hover:text-slate-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div className="max-h-80 overflow-y-auto py-1">
            {results.map((r, i) => (
              <button
                key={`${r.type}-${r.id}`}
                onClick={() => navigate(r.href)}
                onMouseEnter={() => setSelected(i)}
                className={`w-full text-left px-4 py-2.5 flex items-center gap-3 transition-colors ${
                  i === selected ? "bg-brand-blue-light" : "hover:bg-slate-50"
                }`}
              >
                <span className={`p-1.5 rounded-full shrink-0 ${TYPE_COLOR[r.type]}`}>
                  {TYPE_ICON[r.type]}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{r.label}</p>
                  <p className="text-xs text-slate-400 truncate">{r.sub}</p>
                </div>
                <span className="text-xs text-slate-400 shrink-0">{TYPE_LABEL[r.type]}</span>
              </button>
            ))}
          </div>
        )}

        {query.length >= 2 && !loading && results.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-slate-400">
            Geen resultaten voor "{query}"
          </div>
        )}

        {query.length === 0 && (
          <div className="px-4 py-4 text-center text-xs text-slate-400">
            Type om te zoeken · <kbd className="bg-slate-100 rounded px-1 font-mono">↑↓</kbd> navigeren · <kbd className="bg-slate-100 rounded px-1 font-mono">↵</kbd> openen
          </div>
        )}
      </div>
    </>
  );
}
