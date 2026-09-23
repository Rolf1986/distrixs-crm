"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { CreateModal, FormField, inputClass } from "@/components/ui/CreateModal";
import { SearchableSelect } from "@/components/ui/SearchableSelect";

interface Props {
  customers: { id: string; companyName: string }[];
}

export function CreateDealButton({ customers }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [contactId, setContactId] = useState("");
  const [contacts, setContacts] = useState<Array<{ id: string; firstName: string; lastName: string; isPrimary: boolean }>>([]);

  // Nieuw contactpersoon direct vanuit deze popup toevoegen
  const [addingContact, setAddingContact] = useState(false);
  const [newFirst, setNewFirst] = useState("");
  const [newLast, setNewLast] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newContactBusy, setNewContactBusy] = useState(false);
  const [newContactError, setNewContactError] = useState<string | null>(null);

  async function createContact() {
    if (!newFirst.trim() || !newLast.trim()) {
      setNewContactError("Voor- en achternaam zijn verplicht");
      return;
    }
    setNewContactBusy(true);
    setNewContactError(null);
    try {
      const res = await fetch(`/api/customers/${customerId}/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName: newFirst, lastName: newLast, email: newEmail || null }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setNewContactError(d.error ?? "Toevoegen mislukt"); return; }
      setContacts((prev) => [...prev, d]);
      setContactId(d.id);
      setAddingContact(false);
      setNewFirst(""); setNewLast(""); setNewEmail("");
    } finally {
      setNewContactBusy(false);
    }
  }

  // Contactpersonen laden zodra er een klant gekozen is; primaire vooraf selecteren
  useEffect(() => {
    if (!customerId) { setContacts([]); setContactId(""); return; }
    let cancelled = false;
    fetch(`/api/customers/${customerId}/contacts`)
      .then((r) => (r.ok ? r.json() : []))
      .then((list) => {
        if (cancelled) return;
        setContacts(list);
        setContactId(list.find((c: { isPrimary: boolean }) => c.isPrimary)?.id ?? list[0]?.id ?? "");
      })
      .catch(() => { if (!cancelled) setContacts([]); });
    return () => { cancelled = true; };
  }, [customerId]);
  const [expectedCloseDate, setExpectedCloseDate] = useState("");

  function reset() { setTitle(""); setCustomerId(""); setExpectedCloseDate(""); setError(""); }

  async function handleSubmit() {
    setError("");
    if (!customerId) { setError("Selecteer eerst een klant"); return; }
    if (!title.trim()) { setError("Titel is verplicht"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/deals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), customerId, primaryContactId: contactId || undefined, expectedCloseDate: expectedCloseDate || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Fout bij aanmaken"); return; }
      setOpen(false);
      router.push(`/deals/${data.id}/info`);
      router.refresh();
    } finally { setLoading(false); }
  }

  const customerOptions = customers.map((c) => ({ id: c.id, label: c.companyName }));

  return (
    <>
      <button
        onClick={() => { reset(); setOpen(true); }}
        className="flex items-center gap-1.5 bg-brand-blue hover:bg-brand-blue-dark text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors"
      >
        <Plus className="w-4 h-4" />
        Nieuwe deal
      </button>
      {open && (
        <CreateModal title="Nieuwe deal" onClose={() => setOpen(false)} onSubmit={handleSubmit} loading={loading} error={error}>
          <FormField label="Klant" required>
            <SearchableSelect
              options={customerOptions}
              value={customerId}
              onChange={setCustomerId}
              placeholder="Zoek en selecteer klant…"
            />
          </FormField>
          {customerId && (
            <FormField label="Contactpersoon">
              <select
                className={inputClass}
                value={contactId}
                onChange={(e) => {
                  if (e.target.value === "__new__") { setAddingContact(true); return; }
                  setContactId(e.target.value);
                }}
              >
                <option value="">— Geen contactpersoon —</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.firstName} {c.lastName}{c.isPrimary ? " (primair)" : ""}
                  </option>
                ))}
                <option value="__new__">＋ Nieuw contactpersoon…</option>
              </select>
              {addingContact && (
                <div className="mt-2 space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={newFirst}
                      onChange={(e) => setNewFirst(e.target.value)}
                      placeholder="Voornaam *"
                      autoFocus
                      className={inputClass}
                    />
                    <input
                      value={newLast}
                      onChange={(e) => setNewLast(e.target.value)}
                      placeholder="Achternaam *"
                      className={inputClass}
                    />
                  </div>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="E-mail (optioneel)"
                    className={`${inputClass} w-full`}
                  />
                  {newContactError && <p className="text-xs text-red-600">{newContactError}</p>}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={createContact}
                      disabled={newContactBusy}
                      className="text-xs font-medium bg-brand-blue hover:bg-brand-blue-dark text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60"
                    >
                      Toevoegen & selecteren
                    </button>
                    <button
                      type="button"
                      onClick={() => { setAddingContact(false); setNewContactError(null); }}
                      className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1.5"
                    >
                      Annuleren
                    </button>
                  </div>
                </div>
              )}
            </FormField>
          )}
          <FormField label="Titel" required>
            <input
              className={inputClass}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="bijv. Zonnepanelen levering 2026"
              autoFocus={false}
            />
          </FormField>
          <FormField label="Verwachte sluitdatum">
            <input
              type="date"
              className={inputClass}
              value={expectedCloseDate}
              onChange={(e) => setExpectedCloseDate(e.target.value)}
            />
          </FormField>
        </CreateModal>
      )}
    </>
  );
}
