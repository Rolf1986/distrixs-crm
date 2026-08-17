"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus, Trash2, X } from "lucide-react";

export interface CustomerRegistration {
  id: string;
  productLabel: string;
  email: string;
  contactName: string | null;
  serialNumber: string | null;
  status: "PENDING" | "ACTIVE" | "UNSUBSCRIBED";
  notificationCount: number;
  lastNotifiedAt: string | null;
}

export interface Suggestion {
  firmwareProductId: string;
  firmwareProductLabel: string;
  productSku: string;
  productTitle: string;
  contactId: string | null;
  contactName: string | null;
  email: string;
  lastInvoiceNumber: string | null;
  lastInvoiceDate: string | null;
}

export interface ContactOption {
  id: string;
  name: string;
  email: string;
}

export interface FirmwareProductOption {
  id: string;
  label: string;
}

export function CustomerFirmwareClient({
  customerId,
  registrations,
  suggestions,
  contacts,
  firmwareProducts,
}: {
  customerId: string;
  registrations: CustomerRegistration[];
  suggestions: Suggestion[];
  contacts: ContactOption[];
  firmwareProducts: FirmwareProductOption[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [productQuery, setProductQuery] = useState("");
  const [newProductId, setNewProductId] = useState("");
  const [newContactId, setNewContactId] = useState(contacts[0]?.id ?? "");
  const [newSerial, setNewSerial] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set(suggestions.map((s) => s.firmwareProductId)));

  const productMatches = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    const base = q ? firmwareProducts.filter((p) => p.label.toLowerCase().includes(q)) : firmwareProducts;
    return base.slice(0, 40);
  }, [firmwareProducts, productQuery]);

  async function addRegistration() {
    const contact = contacts.find((c) => c.id === newContactId);
    if (!newProductId || !contact) return;
    setBusy("new");
    await fetch("/api/firmware/registrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firmwareProductId: newProductId,
        customerId,
        contactId: contact.id,
        email: contact.email,
        name: contact.name,
        serialNumber: newSerial || null,
      }),
    });
    setBusy(null);
    setAdding(false);
    setNewProductId("");
    setNewSerial("");
    setProductQuery("");
    router.refresh();
  }

  async function acceptSuggestions() {
    const items = suggestions
      .filter((s) => checked.has(s.firmwareProductId))
      .map((s) => ({
        firmwareProductId: s.firmwareProductId,
        customerId,
        contactId: s.contactId,
        email: s.email,
        name: s.contactName,
        source: "INVOICE",
      }));
    if (items.length === 0) return;

    setBusy("suggestions");
    await fetch("/api/firmware/registrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    setBusy(null);
    router.refresh();
  }

  async function setStatus(id: string, status: CustomerRegistration["status"]) {
    setBusy(id);
    await fetch(`/api/firmware/registrations/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setBusy(null);
    router.refresh();
  }

  async function remove(id: string) {
    if (!confirm("Registratie verwijderen?")) return;
    setBusy(id);
    await fetch(`/api/firmware/registrations/${id}`, { method: "DELETE" });
    setBusy(null);
    router.refresh();
  }

  return (
    <div className="space-y-8">
      {/* ─── Actieve registraties ─────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Firmware-meldingen</h2>
            <p className="text-sm text-slate-500">
              Aangevinkte producten leveren automatisch een mail op zodra ACME nieuwe firmware publiceert.
            </p>
          </div>
          <button
            onClick={() => setAdding((v) => !v)}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg border border-slate-300 bg-white hover:bg-slate-50"
          >
            <Plus className="w-4 h-4" />
            Product toevoegen
          </button>
        </div>

        {adding && (
          <div className="bg-white rounded-xl border border-slate-200 p-4 mb-3 space-y-3">
            {contacts.length === 0 ? (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Deze klant heeft nog geen contactpersoon met e-mailadres. Voeg die eerst toe op het tabblad
                Contacten.
              </p>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Contactpersoon</label>
                    <select
                      value={newContactId}
                      onChange={(e) => setNewContactId(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    >
                      {contacts.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} — {c.email}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Serienummer (optioneel)</label>
                    <input
                      type="text"
                      value={newSerial}
                      onChange={(e) => setNewSerial(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Product</label>
                  <input
                    type="text"
                    value={productQuery}
                    onChange={(e) => setProductQuery(e.target.value)}
                    placeholder="Zoek ACME-product…"
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm mb-2"
                  />
                  <select
                    value={newProductId}
                    onChange={(e) => setNewProductId(e.target.value)}
                    size={6}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm"
                  >
                    {productMatches.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={addRegistration}
                    disabled={!newProductId || busy === "new"}
                    className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg bg-blue-700 text-white hover:bg-blue-800 disabled:bg-slate-300"
                  >
                    {busy === "new" && <Loader2 className="w-4 h-4 animate-spin" />}
                    Aanmelden
                  </button>
                  <button onClick={() => setAdding(false)} className="text-sm text-slate-500 hover:text-slate-700">
                    annuleren
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {registrations.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">
            Nog geen producten aangemeld voor deze klant.
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 font-medium">Product</th>
                  <th className="px-4 py-3 font-medium">Ontvanger</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Laatste mail</th>
                  <th className="px-4 py-3 font-medium text-right">Actie</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {registrations.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{r.productLabel}</div>
                      {r.serialNumber && <div className="text-xs text-slate-400">s/n {r.serialNumber}</div>}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {r.contactName && <div>{r.contactName}</div>}
                      <div className="text-xs text-slate-400">{r.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      {r.status === "ACTIVE" ? (
                        <span className="inline-block px-2 py-0.5 text-xs rounded-full border bg-green-50 text-green-700 border-green-200">
                          Aangemeld
                        </span>
                      ) : r.status === "PENDING" ? (
                        <span className="inline-block px-2 py-0.5 text-xs rounded-full border bg-amber-50 text-amber-700 border-amber-200">
                          Wacht op akkoord
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 text-xs rounded-full border bg-slate-100 text-slate-500 border-slate-200">
                          Afgemeld
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {r.lastNotifiedAt ?? "—"}
                      {r.notificationCount > 0 && (
                        <span className="text-xs text-slate-400"> · {r.notificationCount}×</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        {busy === r.id && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                        {r.status === "ACTIVE" ? (
                          <button
                            onClick={() => setStatus(r.id, "UNSUBSCRIBED")}
                            title="Uitzetten"
                            className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => setStatus(r.id, "ACTIVE")}
                            title="Aanzetten"
                            className="p-1.5 rounded-md text-green-600 hover:bg-green-50"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => remove(r.id)}
                          title="Verwijderen"
                          className="p-1.5 rounded-md text-slate-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ─── Voorstellen uit factuurhistorie ──────────────────────────────── */}
      {suggestions.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-slate-900 mb-1">Voorstellen uit factuurhistorie</h2>
          <p className="text-sm text-slate-500 mb-3">
            Deze klant heeft de volgende producten gefactureerd gekregen. Vink aan wie firmware-meldingen moet
            krijgen.
          </p>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3 font-medium w-10"></th>
                  <th className="px-4 py-3 font-medium">Product</th>
                  <th className="px-4 py-3 font-medium">Ontvanger</th>
                  <th className="px-4 py-3 font-medium">Laatste factuur</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {suggestions.map((s) => (
                  <tr key={s.firmwareProductId} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={checked.has(s.firmwareProductId)}
                        onChange={(e) => {
                          const next = new Set(checked);
                          if (e.target.checked) next.add(s.firmwareProductId);
                          else next.delete(s.firmwareProductId);
                          setChecked(next);
                        }}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900">{s.firmwareProductLabel}</div>
                      <div className="text-xs text-slate-400">
                        {s.productSku} · {s.productTitle}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {s.contactName}
                      <div className="text-xs text-slate-400">{s.email}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {s.lastInvoiceNumber}
                      {s.lastInvoiceDate && <div className="text-xs text-slate-400">{s.lastInvoiceDate}</div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            onClick={acceptSuggestions}
            disabled={checked.size === 0 || busy === "suggestions"}
            className="mt-3 inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-lg bg-blue-700 text-white hover:bg-blue-800 disabled:bg-slate-300"
          >
            {busy === "suggestions" && <Loader2 className="w-4 h-4 animate-spin" />}
            {checked.size} aangevinkt aanmelden
          </button>
        </section>
      )}
    </div>
  );
}
