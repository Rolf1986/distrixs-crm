"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { CreateModal, FormField, inputClass } from "@/components/ui/CreateModal";

interface Props {
  customerId: string;
}

export function CreateContactButton({ customerId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [roleOrFunction, setRoleOrFunction] = useState("");

  function reset() {
    setFirstName("");
    setLastName("");
    setEmail("");
    setPhone("");
    setRoleOrFunction("");
    setError(null);
  }

  function handleClose() {
    reset();
    setOpen(false);
  }

  async function handleSubmit() {
    if (!firstName.trim() || !lastName.trim()) {
      setError("Voor- en achternaam zijn verplicht");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/customers/${customerId}/contacts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          email: email.trim() || undefined,
          phone: phone.trim() || undefined,
          roleOrFunction: roleOrFunction.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Onbekende fout");
        return;
      }
      handleClose();
      router.refresh();
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
        <UserPlus className="w-4 h-4" />
        Nieuw contact
      </button>

      {open && (
        <CreateModal
          title="Nieuw contact"
          onClose={handleClose}
          onSubmit={handleSubmit}
          loading={loading}
          error={error ?? undefined}
          submitLabel="Contact aanmaken"
        >
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Voornaam" required>
              <input
                type="text"
                className={inputClass}
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Jan"
              />
            </FormField>
            <FormField label="Achternaam" required>
              <input
                type="text"
                className={inputClass}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Jansen"
              />
            </FormField>
          </div>
          <FormField label="E-mailadres">
            <input
              type="email"
              className={inputClass}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jan@bedrijf.nl"
            />
          </FormField>
          <FormField label="Telefoonnummer">
            <input
              type="tel"
              className={inputClass}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+31 6 12345678"
            />
          </FormField>
          <FormField label="Functie">
            <input
              type="text"
              className={inputClass}
              value={roleOrFunction}
              onChange={(e) => setRoleOrFunction(e.target.value)}
              placeholder="Inkoper"
            />
          </FormField>
        </CreateModal>
      )}
    </>
  );
}
