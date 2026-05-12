"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Star, StarOff, Pencil, Check, X, Trash2, Loader2 } from "lucide-react";

type Contact = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  roleOrFunction: string | null;
  isPrimary: boolean;
  isActive: boolean;
};

const inputClass =
  "rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-blue/30 bg-white w-full";

export function ContactsClient({ initialContacts }: { initialContacts: Contact[] }) {
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>(initialContacts);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Contact>>({});
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function saveEdit(id: string) {
    setSaving(true);
    try {
      const res = await fetch(`/api/contacts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        const updated = await res.json();
        setContacts((prev) =>
          prev.map((c) => (c.id === id ? { ...c, ...updated } : c))
        );
        setEditingId(null);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteContact(id: string) {
    if (!confirm("Contact verwijderen? Dit kan niet ongedaan worden gemaakt.")) return;
    setDeletingId(id);
    try {
      await fetch(`/api/contacts/${id}`, { method: "DELETE" });
      setContacts((prev) => prev.filter((c) => c.id !== id));
      router.refresh();
    } finally {
      setDeletingId(null);
    }
  }

  async function togglePrimary(contact: Contact) {
    const newVal = !contact.isPrimary;
    await fetch(`/api/contacts/${contact.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPrimary: newVal }),
    });
    // If marking as primary, unset all others
    setContacts((prev) =>
      prev.map((c) =>
        c.id === contact.id
          ? { ...c, isPrimary: newVal }
          : newVal
          ? { ...c, isPrimary: false }
          : c
      )
    );
    router.refresh();
  }

  async function toggleActive(contact: Contact) {
    await fetch(`/api/contacts/${contact.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !contact.isActive }),
    });
    setContacts((prev) =>
      prev.map((c) => (c.id === contact.id ? { ...c, isActive: !c.isActive } : c))
    );
    router.refresh();
  }

  const active = contacts.filter((c) => c.isActive);
  const inactive = contacts.filter((c) => !c.isActive);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Naam</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Email</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Telefoon</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Functie</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide w-16">Primair</th>
              <th className="w-28 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {active.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  Nog geen contacten
                </td>
              </tr>
            )}
            {active.map((contact) =>
              editingId === contact.id ? (
                <tr key={contact.id} className="bg-brand-blue-light/40">
                  <td className="px-4 py-2">
                    <div className="flex gap-1">
                      <input
                        className={inputClass}
                        placeholder="Voornaam"
                        value={editForm.firstName ?? contact.firstName}
                        onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))}
                      />
                      <input
                        className={inputClass}
                        placeholder="Achternaam"
                        value={editForm.lastName ?? contact.lastName}
                        onChange={(e) => setEditForm((f) => ({ ...f, lastName: e.target.value }))}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <input
                      className={inputClass}
                      type="email"
                      placeholder="email@bedrijf.nl"
                      value={editForm.email ?? contact.email ?? ""}
                      onChange={(e) => setEditForm((f) => ({ ...f, email: e.target.value }))}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      className={inputClass}
                      type="tel"
                      placeholder="+31 6 …"
                      value={editForm.phone ?? contact.phone ?? ""}
                      onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      className={inputClass}
                      placeholder="Functie"
                      value={editForm.roleOrFunction ?? contact.roleOrFunction ?? ""}
                      onChange={(e) => setEditForm((f) => ({ ...f, roleOrFunction: e.target.value }))}
                    />
                  </td>
                  <td className="px-4 py-2 text-center" />
                  <td className="px-4 py-2">
                    <div className="flex gap-1">
                      <button
                        onClick={() => saveEdit(contact.id)}
                        disabled={saving}
                        className="p-1.5 rounded bg-green-100 text-green-600 hover:bg-green-200 disabled:opacity-40"
                      >
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="p-1.5 rounded bg-slate-100 text-slate-500 hover:bg-slate-200"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                <tr key={contact.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {contact.firstName} {contact.lastName}
                  </td>
                  <td className="px-4 py-3">
                    {contact.email ? (
                      <a href={`mailto:${contact.email}`} className="text-slate-600 hover:text-brand-blue transition-colors">
                        {contact.email}
                      </a>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {contact.phone ?? <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">
                    {contact.roleOrFunction ?? <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => togglePrimary(contact)}
                      className="transition-colors"
                      title={contact.isPrimary ? "Verwijder als primair contact" : "Stel in als primair contact"}
                    >
                      {contact.isPrimary ? (
                        <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                      ) : (
                        <StarOff className="w-4 h-4 text-slate-200 hover:text-amber-300" />
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => { setEditingId(contact.id); setEditForm({}); }}
                        className="p-1.5 rounded text-slate-300 hover:text-slate-600 hover:bg-slate-100"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => toggleActive(contact)}
                        className="px-2 py-1 rounded text-xs text-slate-300 hover:text-orange-500 hover:bg-orange-50"
                        title="Deactiveer contact"
                      >
                        Deactiveer
                      </button>
                      <button
                        onClick={() => deleteContact(contact.id)}
                        disabled={deletingId === contact.id}
                        className="p-1.5 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 disabled:opacity-40"
                      >
                        {deletingId === contact.id
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Trash2 className="w-3.5 h-3.5" />
                        }
                      </button>
                    </div>
                  </td>
                </tr>
              )
            )}
          </tbody>
        </table>
      </div>

      {/* Inactive contacts */}
      {inactive.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
            Inactief ({inactive.length})
          </p>
          <div className="bg-white rounded-xl border border-slate-200 divide-y divide-slate-50 opacity-60">
            {inactive.map((c) => (
              <div key={c.id} className="px-4 py-3 flex items-center justify-between">
                <span className="text-sm text-slate-600">
                  {c.firstName} {c.lastName}
                  {c.email && <span className="ml-2 text-xs text-slate-400">{c.email}</span>}
                </span>
                <button
                  onClick={() => toggleActive(c)}
                  className="text-xs text-brand-blue hover:underline"
                >
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
