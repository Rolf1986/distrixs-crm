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
              <select className={inputClass} value={contactId} onChange={(e) => setContactId(e.target.value)}>
                <option value="">— Geen contactpersoon —</option>
                {contacts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.firstName} {c.lastName}{c.isPrimary ? " (primair)" : ""}
                  </option>
                ))}
              </select>
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
