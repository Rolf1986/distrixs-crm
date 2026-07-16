"use client";

import { X } from "lucide-react";

interface Props {
  title: string;
  onClose: () => void;
  onSubmit: () => void;
  loading: boolean;
  error?: string;
  submitLabel?: string;
  children: React.ReactNode;
}

export function CreateModal({
  title,
  onClose,
  onSubmit,
  loading,
  error,
  submitLabel = "Aanmaken",
  children,
}: Props) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 shrink-0">
          <h2 className="font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">{children}</div>
        {error && (
          <div className="px-6 pb-2">
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          </div>
        )}
        <div className="px-6 py-4 border-t border-slate-200 flex gap-3 justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
          >
            Annuleren
          </button>
          <button
            onClick={onSubmit}
            disabled={loading}
            className="bg-brand-blue hover:bg-brand-blue-dark disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            {loading ? "Bezig…" : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export const inputClass =
  "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-blue bg-white";

export function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
