"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Pencil, Check, X, UserCheck, UserX, Shield, Eye } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

const inputClass =
  "rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-blue/30 bg-white w-full";

const ROLE_OPTIONS = [
  { value: "ADMIN",   label: "Admin" },
  { value: "SALES",   label: "Sales" },
  { value: "FINANCE", label: "Finance" },
  { value: "VIEWER",  label: "Viewer" },
];

const ROLE_COLOR: Record<string, string> = {
  ADMIN:   "bg-red-100 text-red-700",
  SALES:   "bg-brand-blue-light text-brand-blue",
  FINANCE: "bg-green-100 text-green-700",
  VIEWER:  "bg-slate-100 text-slate-600",
};

const ROLE_ICON: Record<string, React.ReactNode> = {
  ADMIN:   <Shield className="w-3 h-3" />,
  SALES:   <UserCheck className="w-3 h-3" />,
  FINANCE: <UserCheck className="w-3 h-3" />,
  VIEWER:  <Eye className="w-3 h-3" />,
};

export function UsersClient({ initialUsers }: { initialUsers: User[] }) {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; role: string; password: string }>({ name: "", role: "SALES", password: "" });
  const [error, setError] = useState<string | null>(null);

  const blank = { name: "", email: "", role: "SALES", password: "" };
  const [form, setForm] = useState(blank);

  async function createUser() {
    setError(null);
    if (!form.name.trim() || !form.email.trim()) { setError("Naam en e-mail zijn verplicht"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Fout bij aanmaken"); return; }
      setUsers((prev) => [...prev, data]);
      setForm(blank);
      setShowForm(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit(id: string) {
    setSaving(true);
    setError(null);
    try {
      const patch: Record<string, string> = {};
      if (editForm.name.trim()) patch.name = editForm.name;
      if (editForm.role) patch.role = editForm.role;
      if (editForm.password.trim()) patch.password = editForm.password;
      const res = await fetch(`/api/users/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        const updated = await res.json();
        setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...updated } : u)));
        setEditingId(null);
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "Wijzigen mislukt");
      }
    } catch {
      setError("Netwerk- of serverfout");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(user: User) {
    setError(null);
    const res = await fetch(`/api/users/${user.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !user.isActive }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Status wijzigen mislukt");
      return;
    }
    setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, isActive: !u.isActive } : u)));
    router.refresh();
  }

  const active = users.filter((u) => u.isActive);
  const inactive = users.filter((u) => !u.isActive);

  return (
    <div className="space-y-6">
      {/* Header + add button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-slate-800">Gebruikers</h2>
          <p className="text-sm text-slate-500">{active.length} actieve gebruikers</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-brand-blue hover:bg-brand-blue-dark text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors"
        >
          <Plus className="w-4 h-4" />
          Gebruiker toevoegen
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-brand-blue/20 p-5 space-y-4">
          <p className="text-sm font-semibold text-slate-700">Nieuwe gebruiker</p>
          {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Naam *</label>
              <input className={inputClass} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Jan Jansen" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">E-mail *</label>
              <input className={inputClass} type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="jan@distrixs.nl" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Rol</label>
              <select className={inputClass} value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}>
                {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Wachtwoord (optioneel)</label>
              <input className={inputClass} type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="Tijdelijk wachtwoord" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => { setShowForm(false); setError(null); }} className="px-3 py-2 text-sm text-slate-600">Annuleren</button>
            <button
              onClick={createUser}
              disabled={saving}
              className="flex items-center gap-2 bg-brand-blue hover:bg-brand-blue-dark disabled:opacity-60 text-white font-medium px-4 py-2 rounded-lg text-sm"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Aanmaken
            </button>
          </div>
        </div>
      )}

      {/* Users table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Naam</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">E-mail</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Rol</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Laatste login</th>
              <th className="w-32 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {active.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-slate-400">Geen gebruikers gevonden</td></tr>
            )}
            {active.map((user) =>
              editingId === user.id ? (
                <tr key={user.id} className="bg-brand-blue-light/40">
                  <td className="px-4 py-2">
                    <input className={inputClass} value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} placeholder={user.name} />
                  </td>
                  <td className="px-4 py-2 text-slate-400 text-xs">{user.email}</td>
                  <td className="px-4 py-2">
                    <select className={inputClass} value={editForm.role} onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}>
                      {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <input className={inputClass} type="password" value={editForm.password} onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))} placeholder="Nieuw wachtwoord (optioneel)" />
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex gap-1">
                      <button onClick={() => saveEdit(user.id)} disabled={saving} className="p-1.5 rounded bg-green-100 text-green-600 hover:bg-green-200 disabled:opacity-40">
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      </button>
                      <button onClick={() => setEditingId(null)} className="p-1.5 rounded bg-slate-100 text-slate-500 hover:bg-slate-200">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-900">{user.name}</td>
                  <td className="px-4 py-3 text-slate-500 text-sm">{user.email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${ROLE_COLOR[user.role] ?? "bg-slate-100 text-slate-600"}`}>
                      {ROLE_ICON[user.role]}
                      {ROLE_OPTIONS.find((r) => r.value === user.role)?.label ?? user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs">
                    {user.lastLoginAt ? formatDateTime(user.lastLoginAt) : "Nog niet ingelogd"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button
                        onClick={() => { setEditingId(user.id); setEditForm({ name: user.name, role: user.role, password: "" }); }}
                        className="p-1.5 rounded text-slate-300 hover:text-slate-600 hover:bg-slate-100"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => toggleActive(user)}
                        className="px-2 py-1 rounded text-xs text-slate-300 hover:text-red-500 hover:bg-red-50"
                      >
                        <UserX className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>

      {/* Inactive users */}
      {inactive.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
            Inactief ({inactive.length})
          </p>
          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-50 opacity-60">
            {inactive.map((u) => (
              <div key={u.id} className="px-4 py-3 flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-slate-600">{u.name}</span>
                  <span className="text-xs text-slate-400 ml-2">{u.email}</span>
                </div>
                <button onClick={() => toggleActive(u)} className="text-xs text-brand-blue hover:underline">
                  Activeer
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
