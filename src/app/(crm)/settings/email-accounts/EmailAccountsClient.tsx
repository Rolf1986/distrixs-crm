"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, RefreshCw, Mail, Check, X, Loader2, Server, Eye, EyeOff, Trash2, KeyRound } from "lucide-react";

type Account = {
  id: string;
  label: string;
  host: string;
  port: number;
  secure: boolean;
  username: string;
  isActive: boolean;
  lastSyncAt: string | null;
  emailCount: number;
};

const inputClass =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-blue/30 bg-white";

const PRESETS = [
  { label: "Gmail", host: "imap.gmail.com", port: 993, secure: true,
    hint: "Gebruik een App-wachtwoord: Google-account → Beveiliging → App-wachtwoorden (vereist 2-staps-verificatie)" },
  { label: "Outlook / Office 365", host: "outlook.office365.com", port: 993, secure: true,
    hint: "Gebruik je gewone wachtwoord of een app-wachtwoord" },
  { label: "Eigen IMAP", host: "", port: 993, secure: true, hint: "" },
];

/** Vertaal cryptische IMAP-fouten naar begrijpelijke meldingen */
function friendlyImapError(raw: string): string {
  const r = raw.toLowerCase();
  if (r.includes("authentication failed") || r.includes("invalid credentials") ||
      r.includes("command failed") || r.includes("login failed") ||
      r.includes("bad credentials")) {
    return "Inloggen mislukt. Controleer je wachtwoord. Voor Gmail: gebruik een App-wachtwoord (Google-account → Beveiliging → App-wachtwoorden).";
  }
  if (r.includes("enotfound") || r.includes("getaddrinfo") || r.includes("econnrefused")) {
    return "Server niet bereikbaar. Controleer de hostnaam en poort.";
  }
  if (r.includes("certificate") || r.includes("ssl") || r.includes("tls")) {
    return "SSL/TLS-fout. Probeer poort 993 met SSL aan, of poort 143 zonder.";
  }
  if (r.includes("timeout")) {
    return "Verbinding time-out. De server reageert niet.";
  }
  return raw.slice(0, 120);
}

export function EmailAccountsClient({ initialAccounts }: { initialAccounts: Account[] }) {
  const router = useRouter();
  const [accounts, setAccounts] = useState(initialAccounts);
  const [showForm, setShowForm] = useState(false);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Wachtwoord-bewerken state
  const [editingPassword, setEditingPassword] = useState<string | null>(null); // account id
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const [form, setForm] = useState({
    label: "", host: "imap.gmail.com", port: 993, secure: true,
    username: "", password: "",
  });

  function applyPreset(preset: typeof PRESETS[0]) {
    setForm((f) => ({ ...f, host: preset.host, port: preset.port, secure: preset.secure,
      label: f.label || preset.label }));
  }

  // Bepaal hint op basis van huidig host
  const gmailHosts = ["imap.gmail.com", "imap.googlemail.com"];
  const currentPreset = PRESETS.find(p => p.host === form.host) ??
    (gmailHosts.includes(form.host) ? PRESETS[0] : null);

  async function addAccount() {
    if (!form.host || !form.username || !form.password) return;
    setSaving(true);
    try {
      const res = await fetch("/api/email-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setShowForm(false);
        setForm({ label: "", host: "imap.gmail.com", port: 993, secure: true, username: "", password: "" });
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  }

  async function syncAccount(id: string) {
    setSyncing(id);
    setSyncResult((r) => ({ ...r, [id]: "" }));
    try {
      const res = await fetch(`/api/email-accounts/${id}/sync`, { method: "POST" });
      const data = await res.json() as { synced: number; skipped: number; linked: number; errors: string[] };
      setSyncResult((r) => ({
        ...r,
        [id]: data.errors.length > 0
          ? `⚠️ ${friendlyImapError(data.errors[0])}`
          : [
              `✅ ${data.synced} nieuwe e-mails`,
              data.linked > 0 ? `${data.linked} gekoppeld` : "",
              `${data.skipped} overgeslagen`,
            ].filter(Boolean).join(" · "),
      }));
      router.refresh();
    } finally {
      setSyncing(null);
    }
  }

  async function deleteAccount(id: string, label: string) {
    if (!window.confirm(`Mailbox "${label}" verwijderen? Alle gesynchroniseerde e-mails worden ook verwijderd.`)) return;
    setDeleting(id);
    try {
      await fetch(`/api/email-accounts/${id}`, { method: "DELETE" });
      setAccounts((a) => a.filter((x) => x.id !== id));
    } finally {
      setDeleting(null);
    }
  }

  async function savePassword(id: string) {
    if (!newPassword) return;
    setSavingPassword(true);
    try {
      const res = await fetch(`/api/email-accounts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });
      if (res.ok) {
        setEditingPassword(null);
        setNewPassword("");
        setSyncResult((r) => ({ ...r, [id]: "✅ Wachtwoord bijgewerkt" }));
      }
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Uitleg */}
      <div className="bg-brand-blue-light border border-brand-blue/20 rounded-xl p-4">
        <p className="text-sm text-brand-blue font-medium mb-1">
          Hoe werkt mailbox integratie?
        </p>
        <ul className="text-sm text-brand-blue/80 space-y-1 list-disc list-inside">
          <li>Verbind je inbox via IMAP (Gmail, Outlook, of eigen server)</li>
          <li>E-mails worden automatisch gekoppeld aan klanten op basis van e-mailadres</li>
          <li>Je ziet alle e-mails bij de klant en deal in de <strong>E-mails</strong> tab</li>
          <li><strong>Gmail:</strong> vereist een App-wachtwoord — gewoon wachtwoord werkt niet</li>
        </ul>
      </div>

      {/* Accounts lijst */}
      {accounts.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {accounts.map((acc) => (
            <div key={acc.id} className="border-b border-slate-100 last:border-0">
              <div className="flex items-center justify-between px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
                    <Mail className="w-4 h-4 text-slate-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900">{acc.label}</p>
                    <p className="text-xs text-slate-400">{acc.username} · {acc.host}</p>
                    {syncResult[acc.id] && (
                      <p className={`text-xs mt-0.5 ${syncResult[acc.id].startsWith("⚠️") ? "text-orange-600" : "text-slate-500"}`}>
                        {syncResult[acc.id]}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">
                    {acc.emailCount} e-mails
                    {acc.lastSyncAt && ` · ${new Date(acc.lastSyncAt).toLocaleDateString("nl-NL")}`}
                  </span>
                  {/* Wachtwoord aanpassen */}
                  <button
                    onClick={() => { setEditingPassword(editingPassword === acc.id ? null : acc.id); setNewPassword(""); }}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                    title="Wachtwoord aanpassen"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                  </button>
                  {/* Verwijderen */}
                  <button
                    onClick={() => deleteAccount(acc.id, acc.label)}
                    disabled={deleting === acc.id}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                    title="Mailbox verwijderen"
                  >
                    {deleting === acc.id
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                  {/* Synchroniseren */}
                  <button
                    onClick={() => syncAccount(acc.id)}
                    disabled={syncing === acc.id}
                    className="flex items-center gap-1.5 text-xs font-medium text-brand-blue border border-brand-blue/20 bg-brand-blue-light hover:bg-brand-blue/10 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {syncing === acc.id
                      ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      : <RefreshCw className="w-3.5 h-3.5" />}
                    Synchroniseer
                  </button>
                </div>
              </div>

              {/* Wachtwoord bewerken inline */}
              {editingPassword === acc.id && (
                <div className="px-5 pb-4 flex items-center gap-2 bg-slate-50 border-t border-slate-100">
                  <div className="relative flex-1 max-w-xs">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      placeholder="Nieuw wachtwoord of App-wachtwoord"
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      className={`${inputClass} pr-10`}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(s => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <button
                    onClick={() => savePassword(acc.id)}
                    disabled={savingPassword || !newPassword}
                    className="flex items-center gap-1.5 bg-brand-blue hover:bg-brand-blue-dark disabled:opacity-50 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors"
                  >
                    {savingPassword ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    Opslaan
                  </button>
                  <button
                    onClick={() => { setEditingPassword(null); setNewPassword(""); }}
                    className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:border-slate-300 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Toevoegen knop */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-brand-blue hover:bg-brand-blue-dark text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Mailbox toevoegen
        </button>
      )}

      {/* Formulier */}
      {showForm && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <h3 className="text-sm font-semibold text-slate-900">Nieuwe mailbox koppelen</h3>

          {/* Presets */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-2">Type</label>
            <div className="flex gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => applyPreset(p)}
                  className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                    form.host === p.host
                      ? "bg-brand-blue text-white border-brand-blue"
                      : "bg-white text-slate-600 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <Server className="w-3.5 h-3.5" />
                  {p.label}
                </button>
              ))}
            </div>
            {currentPreset?.hint && (
              <p className="text-xs text-amber-600 mt-2 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                💡 {currentPreset.hint}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Label</label>
              <input className={inputClass} placeholder="bijv. Verkoop inbox"
                value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">E-mailadres</label>
              <input className={inputClass} placeholder="rolf@distrixs.nl" type="email"
                value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">IMAP server</label>
              <input className={inputClass} placeholder="imap.gmail.com"
                value={form.host} onChange={e => setForm(f => ({ ...f, host: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Poort</label>
              <input className={inputClass} type="number"
                value={form.port} onChange={e => setForm(f => ({ ...f, port: Number(e.target.value) }))} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Wachtwoord / App-wachtwoord
            </label>
            <div className="relative">
              <input
                className={`${inputClass} pr-10`}
                type={showPassword ? "text" : "password"}
                placeholder="••••••••••••"
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              />
              <button
                type="button"
                onClick={() => setShowPassword(s => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={addAccount}
              disabled={saving || !form.host || !form.username || !form.password}
              className="flex items-center gap-1.5 bg-brand-blue hover:bg-brand-blue-dark disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Opslaan & verbinden
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="flex items-center gap-1.5 border border-slate-200 text-slate-600 text-sm px-4 py-2 rounded-lg hover:border-slate-300 transition-colors"
            >
              <X className="w-4 h-4" />
              Annuleren
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
