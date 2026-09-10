"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Check, X, Trash2, Send, Undo2, ArrowUpRight, Bell } from "lucide-react";
import { usePersistentState } from "@/lib/usePersistentState";

type Item = {
  id: string;
  product: string;
  qty: number;
  location: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  notes: string | null;
  outSince: string | null;
};

const inputClass =
  "rounded border border-slate-300 px-2 py-1 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-blue bg-white";

function isOut(location: string) {
  return location.trim().toLowerCase() !== "kantoor";
}

function daysOut(outSince: string | null): number | null {
  if (!outSince) return null;
  return Math.floor((Date.now() - new Date(outSince).getTime()) / 86400000);
}

export function DemoItemsClient({ initialItems }: { initialItems: Item[] }) {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>(initialItems);
  const [search, setSearch] = usePersistentState("demo-items.search", "");
  const [filter, setFilter] = usePersistentState<"all" | "out" | "in">("demo-items.filter", "all");
  const [busy, setBusy] = useState<string | null>(null);

  // Toevoegen
  const [adding, setAdding] = useState(false);
  const [newProduct, setNewProduct] = useState("");
  const [newQty, setNewQty] = useState("1");

  // Uitgeef-dialoog
  const [issueId, setIssueId] = useState<string | null>(null);
  const [issueLocation, setIssueLocation] = useState("");
  const [issueContact, setIssueContact] = useState("");
  const [issuePhone, setIssuePhone] = useState("");
  const [issueEmail, setIssueEmail] = useState("");

  // Inline notities bewerken
  const [editNotesId, setEditNotesId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState("");

  // Inline productnaam bewerken
  const [editNameId, setEditNameId] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState("");

  const [reminderResult, setReminderResult] = useState<string | null>(null);

  const sorted = [...items].sort((a, b) => {
    const ao = isOut(a.location) ? 0 : 1;
    const bo = isOut(b.location) ? 0 : 1;
    if (ao !== bo) return ao - bo;
    if (ao === 0) {
      const at = a.outSince ? new Date(a.outSince).getTime() : Infinity;
      const bt = b.outSince ? new Date(b.outSince).getTime() : Infinity;
      if (at !== bt) return at - bt;
    }
    return a.product.localeCompare(b.product, "nl");
  });

  const filtered = sorted.filter((i) => {
    if (filter === "out" && !isOut(i.location)) return false;
    if (filter === "in" && isOut(i.location)) return false;
    const q = search.toLowerCase();
    if (!q) return true;
    return [i.product, i.location, i.contactName, i.notes]
      .filter(Boolean)
      .some((v) => (v as string).toLowerCase().includes(q));
  });

  async function patch(id: string, data: Record<string, unknown>) {
    setBusy(id);
    try {
      const res = await fetch(`/api/demo-items/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error ?? "Opslaan mislukt");
        return;
      }
      const updated = await res.json();
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...updated } : i)));
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function addItem() {
    if (!newProduct.trim()) return;
    setBusy("new");
    try {
      const res = await fetch("/api/demo-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product: newProduct, qty: Number(newQty) || 1 }),
      });
      if (!res.ok) return;
      const created = await res.json();
      setItems((prev) => [...prev, ...(Array.isArray(created) ? created : [created])]);
      setNewProduct("");
      setNewQty("1");
      setAdding(false);
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  async function removeItem(id: string) {
    if (!window.confirm("Demo-item verwijderen?")) return;
    setBusy(id);
    try {
      await fetch(`/api/demo-items/${id}`, { method: "DELETE" });
      setItems((prev) => prev.filter((i) => i.id !== id));
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  function openIssue(item: Item) {
    setIssueId(item.id);
    setIssueLocation(isOut(item.location) ? item.location : "");
    setIssueContact(item.contactName ?? "");
    setIssuePhone(item.phone ?? "");
    setIssueEmail(item.email ?? "");
  }

  async function confirmIssue() {
    if (!issueId || !issueLocation.trim()) return;
    await patch(issueId, {
      location: issueLocation,
      contactName: issueContact,
      phone: issuePhone,
      email: issueEmail,
    });
    setIssueId(null);
  }

  async function sendReminderNow() {
    setBusy("remind");
    setReminderResult(null);
    try {
      const res = await fetch("/api/demo-items/remind", { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) setReminderResult(d.error ?? "Versturen mislukt");
      else setReminderResult(d.sent ? `Mail verstuurd (${d.outstanding} uitstaand)` : "Niets uitstaand — geen mail verstuurd");
    } finally {
      setBusy(null);
    }
  }

  const outstanding = items.filter((i) => isOut(i.location)).length;

  return (
    <div className="space-y-4">
      {/* Werkbalk */}
      <div className="flex flex-wrap items-center gap-2">
        <input
          className={`${inputClass} w-64`}
          placeholder="Zoek product, locatie of contact…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex items-center gap-0.5 border border-slate-200 rounded-lg overflow-hidden bg-white">
          {([["all", `Alles (${items.length})`], ["out", `Uitstaand (${outstanding})`], ["in", "Op kantoor"]] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${filter === key ? "bg-brand-blue text-white" : "text-slate-500 hover:bg-slate-50"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {reminderResult && <span className="text-xs text-slate-500">{reminderResult}</span>}
          <button
            onClick={sendReminderNow}
            disabled={busy === "remind"}
            className="flex items-center gap-1.5 border border-slate-200 hover:border-slate-300 bg-white text-slate-700 text-sm font-medium px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
            title="Stuur de reminder-mail met uitstaande demo's nu"
          >
            {busy === "remind" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4" />}
            Reminder nu
          </button>
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 bg-brand-blue hover:bg-brand-blue-dark text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Demo-item
          </button>
        </div>
      </div>

      {/* Toevoegen */}
      {adding && (
        <div className="flex flex-wrap items-end gap-2 bg-white border border-slate-200 rounded-xl p-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Product</label>
            <input className={`${inputClass} w-72`} autoFocus value={newProduct} onChange={(e) => setNewProduct(e.target.value)} placeholder="bijv. Acme BL100 RGBW" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Aantal (losse regels)</label>
            <input className={`${inputClass} w-20`} type="number" min="1" value={newQty} onChange={(e) => setNewQty(e.target.value)} />
          </div>
          <button onClick={addItem} disabled={busy === "new" || !newProduct.trim()} className="p-2 rounded bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-40">
            {busy === "new" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          </button>
          <button onClick={() => setAdding(false)} className="p-2 rounded bg-slate-100 text-slate-500 hover:bg-slate-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tabel */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Product</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Locatie</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Contact</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Uit sinds</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Notities</th>
              <th className="w-28 px-2 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  Geen demo-items{search ? " gevonden" : ""}
                </td>
              </tr>
            )}
            {filtered.map((item) => {
              const out = isOut(item.location);
              const dagen = daysOut(item.outSince);
              return (
                <tr key={item.id} className={`transition-colors ${out ? "bg-orange-50/40" : ""} hover:bg-slate-50`}>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {editNameId === item.id ? (
                      <span className="flex items-center gap-1">
                        <input
                          className={`${inputClass} w-full`}
                          value={nameDraft}
                          autoFocus
                          onChange={(e) => setNameDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && nameDraft.trim()) { patch(item.id, { product: nameDraft }); setEditNameId(null); }
                            if (e.key === "Escape") setEditNameId(null);
                          }}
                        />
                        <button
                          onClick={() => { if (nameDraft.trim()) { patch(item.id, { product: nameDraft }); } setEditNameId(null); }}
                          className="text-green-600"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => { setEditNameId(item.id); setNameDraft(item.product); }}
                        className="text-left hover:text-brand-blue w-full"
                        title="Klik om de naam te bewerken"
                      >
                        {item.product}{item.qty > 1 ? ` (${item.qty}×)` : ""}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {out ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
                        <ArrowUpRight className="w-3 h-3" />
                        {item.location}
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-500">
                        Kantoor
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600 text-xs">
                    {[item.contactName, item.phone, item.email].filter(Boolean).join(" · ") || "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                    {dagen != null ? `${dagen} dagen` : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 max-w-[220px]">
                    {editNotesId === item.id ? (
                      <span className="flex items-center gap-1">
                        <input
                          className={`${inputClass} w-full text-xs`}
                          value={notesDraft}
                          autoFocus
                          onChange={(e) => setNotesDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { patch(item.id, { notes: notesDraft }); setEditNotesId(null); }
                            if (e.key === "Escape") setEditNotesId(null);
                          }}
                        />
                        <button onClick={() => { patch(item.id, { notes: notesDraft }); setEditNotesId(null); }} className="text-green-600"><Check className="w-3.5 h-3.5" /></button>
                      </span>
                    ) : (
                      <button
                        onClick={() => { setEditNotesId(item.id); setNotesDraft(item.notes ?? ""); }}
                        className="text-left hover:text-slate-700 w-full"
                        title="Klik om notities te bewerken"
                      >
                        {item.notes || <span className="text-slate-300">＋ notitie</span>}
                      </button>
                    )}
                  </td>
                  <td className="px-2 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      {out ? (
                        <button
                          onClick={() => patch(item.id, { location: "Kantoor" })}
                          disabled={busy === item.id}
                          className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 px-2 py-1 rounded transition-colors disabled:opacity-50"
                          title="Item is terug op kantoor"
                        >
                          <Undo2 className="w-3 h-3" />
                          Retour
                        </button>
                      ) : (
                        <button
                          onClick={() => openIssue(item)}
                          disabled={busy === item.id}
                          className="flex items-center gap-1 text-xs font-medium text-brand-blue bg-brand-blue-light hover:bg-blue-100 border border-blue-200 px-2 py-1 rounded transition-colors disabled:opacity-50"
                          title="Uitgeven aan klant/relatie"
                        >
                          <Send className="w-3 h-3" />
                          Uitgeven
                        </button>
                      )}
                      <button
                        onClick={() => removeItem(item.id)}
                        disabled={busy === item.id}
                        className="p-1.5 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                        title="Verwijderen"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Uitgeef-dialoog */}
      {issueId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="px-6 pt-5 pb-3 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-900">Demo uitgeven</h2>
              <p className="text-sm text-slate-500 mt-1">
                {items.find((i) => i.id === issueId)?.product}
              </p>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Locatie / bedrijf *</label>
                <input className={`${inputClass} w-full`} autoFocus value={issueLocation} onChange={(e) => setIssueLocation(e.target.value)} placeholder="bijv. Addlive" />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Contactpersoon</label>
                <input className={`${inputClass} w-full`} value={issueContact} onChange={(e) => setIssueContact(e.target.value)} placeholder="bijv. Sander Bloem" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-500 mb-1">Telefoon</label>
                  <input className={`${inputClass} w-full`} value={issuePhone} onChange={(e) => setIssuePhone(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs text-slate-500 mb-1">E-mail</label>
                  <input className={`${inputClass} w-full`} type="email" value={issueEmail} onChange={(e) => setIssueEmail(e.target.value)} />
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-2">
              <button onClick={() => setIssueId(null)} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 border border-slate-200 hover:border-slate-300">
                Annuleren
              </button>
              <button
                onClick={confirmIssue}
                disabled={!issueLocation.trim() || busy === issueId}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-brand-blue hover:bg-brand-blue-dark text-white disabled:opacity-60"
              >
                {busy === issueId && <Loader2 className="w-4 h-4 animate-spin" />}
                Uitgeven
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
