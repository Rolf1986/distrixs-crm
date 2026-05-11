"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { CreateModal, FormField, inputClass } from "@/components/ui/CreateModal";

const REASON_OPTIONS = [
  { value: "DEFECTIVE", label: "Defect" },
  { value: "WRONG_PRODUCT", label: "Verkeerd product" },
  { value: "DAMAGED", label: "Beschadigd" },
  { value: "NOT_AS_DESCRIBED", label: "Niet zoals beschreven" },
  { value: "CHANGED_MIND", label: "Van gedachten veranderd" },
  { value: "OTHER", label: "Anders" },
];

export function CreateRmaButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [submittedName, setSubmittedName] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [submittedPhone, setSubmittedPhone] = useState("");
  const [submittedCompany, setSubmittedCompany] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [reason, setReason] = useState("DEFECTIVE");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [orderReference, setOrderReference] = useState("");

  function reset() {
    setSubmittedName("");
    setSubmittedEmail("");
    setSubmittedPhone("");
    setSubmittedCompany("");
    setProductDescription("");
    setReason("DEFECTIVE");
    setDescription("");
    setQuantity("1");
    setOrderReference("");
    setError(null);
  }

  function handleClose() {
    reset();
    setOpen(false);
  }

  async function handleSubmit() {
    if (!submittedName.trim() || !submittedEmail.trim()) {
      setError("Naam en e-mailadres zijn verplicht");
      return;
    }
    if (!productDescription.trim()) {
      setError("Productomschrijving is verplicht");
      return;
    }
    if (!description.trim()) {
      setError("Omschrijving is verplicht");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/rma", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submittedName: submittedName.trim(),
          submittedEmail: submittedEmail.trim(),
          submittedPhone: submittedPhone.trim() || undefined,
          submittedCompany: submittedCompany.trim() || undefined,
          productDescription: productDescription.trim(),
          reason,
          description: description.trim(),
          quantity: Number(quantity) || 1,
          orderReference: orderReference.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Onbekende fout");
        return;
      }
      handleClose();
      router.push("/rma/" + data.id);
    } catch {
      setError("Verbindingsfout, probeer opnieuw");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 bg-brand-blue hover:bg-brand-blue-dark text-white text-sm font-medium px-3 py-2 rounded-lg transition-colors"
      >
        <RotateCcw className="w-4 h-4" />
        Nieuw RMA
      </button>

      {open && (
        <CreateModal
          title="Nieuw RMA-verzoek"
          onClose={handleClose}
          onSubmit={handleSubmit}
          loading={loading}
          error={error ?? undefined}
          submitLabel="RMA aanmaken"
        >
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Naam indiener" required>
              <input
                type="text"
                className={inputClass}
                value={submittedName}
                onChange={(e) => setSubmittedName(e.target.value)}
                placeholder="Jan Jansen"
              />
            </FormField>
            <FormField label="E-mailadres" required>
              <input
                type="email"
                className={inputClass}
                value={submittedEmail}
                onChange={(e) => setSubmittedEmail(e.target.value)}
                placeholder="jan@bedrijf.nl"
              />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Telefoonnummer">
              <input
                type="tel"
                className={inputClass}
                value={submittedPhone}
                onChange={(e) => setSubmittedPhone(e.target.value)}
                placeholder="+31 6 12345678"
              />
            </FormField>
            <FormField label="Bedrijf">
              <input
                type="text"
                className={inputClass}
                value={submittedCompany}
                onChange={(e) => setSubmittedCompany(e.target.value)}
                placeholder="Bedrijfsnaam"
              />
            </FormField>
          </div>
          <FormField label="Productomschrijving" required>
            <textarea
              className={inputClass}
              rows={2}
              value={productDescription}
              onChange={(e) => setProductDescription(e.target.value)}
              placeholder="Beschrijf het product"
            />
          </FormField>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Reden">
              <select
                className={inputClass}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              >
                {REASON_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="Aantal">
              <input
                type="number"
                min="1"
                className={inputClass}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
              />
            </FormField>
          </div>
          <FormField label="Orderreferentie">
            <input
              type="text"
              className={inputClass}
              value={orderReference}
              onChange={(e) => setOrderReference(e.target.value)}
              placeholder="Optioneel"
            />
          </FormField>
          <FormField label="Omschrijving" required>
            <textarea
              className={inputClass}
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Beschrijf het probleem"
            />
          </FormField>
        </CreateModal>
      )}
    </>
  );
}
