"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Search, X } from "lucide-react";

interface Option {
  id: string;
  label: string;
  sub?: string;
}

interface Props {
  options: Option[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

export function SearchableSelect({
  options, value, onChange, placeholder = "Selecteer…", required, className,
}: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  // Beschermt op touch-apparaten tegen de "ghost click": de tik die het menu
  // opent, mag niet meteen de optie selecteren die eronder verschijnt.
  const openedAtRef = useRef(0);

  const selected = options.find((o) => o.id === value);

  const filtered = q.trim()
    ? options.filter(
        (o) =>
          o.label.toLowerCase().includes(q.toLowerCase()) ||
          o.sub?.toLowerCase().includes(q.toLowerCase())
      )
    : options;

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    function onOutsideClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, []);

  function select(id: string) {
    // Negeer klikken binnen 350ms na openen (ghost click op mobiel)
    if (Date.now() - openedAtRef.current < 350) return;
    onChange(id);
    setOpen(false);
    setQ("");
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation();
    onChange("");
  }

  return (
    <div ref={containerRef} className={`relative ${className ?? ""}`}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => { openedAtRef.current = Date.now(); setOpen(!open); }}
        className="w-full flex items-center justify-between gap-2 border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white text-left focus:outline-none focus:ring-2 focus:ring-brand-blue/30 hover:border-slate-300 transition-colors"
      >
        <span className={selected ? "text-slate-800" : "text-slate-400"}>
          {selected ? selected.label : placeholder}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {value && (
            <span onClick={clear} className="text-slate-400 hover:text-slate-600 p-0.5 rounded">
              <X className="w-3 h-3" />
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-50 overflow-hidden">
          {/* Zoekbalk */}
          <div className="px-3 py-2 border-b border-slate-100 flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <input
              ref={searchRef}
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Zoeken…"
              className="flex-1 text-sm focus:outline-none placeholder-slate-400"
              onKeyDown={(e) => {
                if (e.key === "Escape") setOpen(false);
                if (e.key === "Enter" && filtered.length === 1) select(filtered[0].id);
              }}
            />
            {q && (
              <button onClick={() => setQ("")} className="text-slate-400 hover:text-slate-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Opties */}
          <div className="max-h-56 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="px-4 py-3 text-sm text-slate-400 text-center">Geen resultaten</p>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => select(o.id)}
                  className={`w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors flex items-center justify-between gap-2 ${
                    o.id === value ? "bg-brand-blue-light text-brand-blue" : "text-slate-800"
                  }`}
                >
                  <span>{o.label}</span>
                  {o.sub && <span className="text-xs text-slate-400 shrink-0">{o.sub}</span>}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
