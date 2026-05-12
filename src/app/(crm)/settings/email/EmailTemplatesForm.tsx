"use client";

import { useState } from "react";
import { Check, Loader2, Info } from "lucide-react";

interface TemplateValues {
  quoteEmailSubject: string;
  quoteEmailBody: string;
  quoteEmailSubjectEn: string;
  quoteEmailBodyEn: string;
  invoiceEmailSubject: string;
  invoiceEmailBody: string;
  invoiceEmailSubjectEn: string;
  invoiceEmailBodyEn: string;
  reminderEmailSubject: string;
  reminderEmailBody: string;
  reminderEmailSubjectEn: string;
  reminderEmailBodyEn: string;
}

const PLACEHOLDERS = `{documentNumber} · {customerName} · {total} · {dueDate} · {companyName}`;

const inputClass = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-brand-blue/30 bg-white";
const textareaClass = `${inputClass} resize-none`;

const DEFAULTS = {
  NL: {
    quote: {
      subject: "Offerte {documentNumber}",
      body: "Hierbij ontvangt u onze offerte {documentNumber}.\n\nVoor vragen kunt u altijd contact met ons opnemen.\n\nMet vriendelijke groet,\n{companyName}",
    },
    invoice: {
      subject: "Factuur {documentNumber}",
      body: "Hierbij ontvangt u onze factuur {documentNumber}.\n\nGelieve het bedrag voor de vervaldatum over te maken met als betalingskenmerk het factuurnummer.\n\nVoor vragen kunt u altijd contact met ons opnemen.\n\nMet vriendelijke groet,\n{companyName}",
    },
    reminder: {
      subject: "Betalingsherinnering {documentNumber}",
      body: "Wij verzoeken u vriendelijk de openstaande factuur {documentNumber} zo spoedig mogelijk te voldoen.\n\nMocht u al betaald hebben, dan verzoeken wij u dit bericht te negeren.\n\nVoor vragen kunt u contact met ons opnemen.\n\nMet vriendelijke groet,\n{companyName}",
    },
  },
  EN: {
    quote: {
      subject: "Quotation {documentNumber}",
      body: "Please find attached our quotation {documentNumber}.\n\nShould you have any questions, please do not hesitate to contact us.\n\nKind regards,\n{companyName}",
    },
    invoice: {
      subject: "Invoice {documentNumber}",
      body: "Please find attached our invoice {documentNumber}.\n\nKindly transfer the amount before the due date, using the invoice number as payment reference.\n\nShould you have any questions, please do not hesitate to contact us.\n\nKind regards,\n{companyName}",
    },
    reminder: {
      subject: "Payment reminder – Invoice {documentNumber}",
      body: "We would like to kindly remind you that invoice {documentNumber} is still outstanding.\n\nIf you have already processed this payment, please disregard this message.\n\nShould you have any questions, please contact us.\n\nKind regards,\n{companyName}",
    },
  },
};

interface SectionProps {
  title: string;
  subjectKey: keyof TemplateValues;
  bodyKey: keyof TemplateValues;
  defaultSubject: string;
  defaultBody: string;
  values: TemplateValues;
  onChange: (key: keyof TemplateValues, v: string) => void;
}

function TemplateSection({ title, subjectKey, bodyKey, defaultSubject, defaultBody, values, onChange }: SectionProps) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">{title} — Onderwerp / Subject</label>
        <input
          type="text"
          className={inputClass}
          value={values[subjectKey]}
          onChange={(e) => onChange(subjectKey, e.target.value)}
          placeholder={defaultSubject}
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">Berichttekst / Body</label>
        <textarea
          rows={5}
          className={textareaClass}
          value={values[bodyKey]}
          onChange={(e) => onChange(bodyKey, e.target.value)}
          placeholder={defaultBody}
        />
      </div>
    </div>
  );
}

interface TemplatePairProps {
  title: string;
  nlSubjectKey: keyof TemplateValues;
  nlBodyKey: keyof TemplateValues;
  enSubjectKey: keyof TemplateValues;
  enBodyKey: keyof TemplateValues;
  nlDefaults: { subject: string; body: string };
  enDefaults: { subject: string; body: string };
  values: TemplateValues;
  onChange: (key: keyof TemplateValues, v: string) => void;
}

function TemplatePair({ title, nlSubjectKey, nlBodyKey, enSubjectKey, enBodyKey, nlDefaults, enDefaults, values, onChange }: TemplatePairProps) {
  const [lang, setLang] = useState<"NL" | "EN">("NL");

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      {/* Header met taal-toggle */}
      <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs">
          <button
            onClick={() => setLang("NL")}
            className={`px-3 py-1.5 font-medium transition-colors ${lang === "NL" ? "bg-brand-blue text-white" : "text-slate-500 hover:text-slate-700 bg-white"}`}
          >
            NL
          </button>
          <button
            onClick={() => setLang("EN")}
            className={`px-3 py-1.5 font-medium transition-colors border-l border-slate-200 ${lang === "EN" ? "bg-brand-blue text-white" : "text-slate-500 hover:text-slate-700 bg-white"}`}
          >
            EN
          </button>
        </div>
      </div>

      <div className="px-5 py-4">
        {lang === "NL" ? (
          <TemplateSection
            title="Nederlands"
            subjectKey={nlSubjectKey}
            bodyKey={nlBodyKey}
            defaultSubject={nlDefaults.subject}
            defaultBody={nlDefaults.body}
            values={values}
            onChange={onChange}
          />
        ) : (
          <TemplateSection
            title="English"
            subjectKey={enSubjectKey}
            bodyKey={enBodyKey}
            defaultSubject={enDefaults.subject}
            defaultBody={enDefaults.body}
            values={values}
            onChange={onChange}
          />
        )}
        <p className="mt-2 text-xs text-slate-400">
          Variabelen: <span className="font-mono">{PLACEHOLDERS}</span>
        </p>
      </div>
    </div>
  );
}

export function EmailTemplatesForm({ initialValues }: { initialValues: TemplateValues }) {
  const [values, setValues] = useState(initialValues);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function onChange(key: keyof TemplateValues, v: string) {
    setValues((prev) => ({ ...prev, [key]: v }));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    try {
      await fetch("/api/settings/company", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 bg-brand-blue-light border border-brand-blue/20 rounded-lg px-4 py-3">
        <Info className="w-4 h-4 text-brand-blue shrink-0 mt-0.5" />
        <p className="text-sm text-brand-blue">
          Stel per document NL én EN templates in. Bij het versturen wordt automatisch de juiste taal geladen op basis van de documenttaal — je kunt altijd wisselen.
        </p>
      </div>

      <TemplatePair
        title="Offerte e-mail"
        nlSubjectKey="quoteEmailSubject"
        nlBodyKey="quoteEmailBody"
        enSubjectKey="quoteEmailSubjectEn"
        enBodyKey="quoteEmailBodyEn"
        nlDefaults={DEFAULTS.NL.quote}
        enDefaults={DEFAULTS.EN.quote}
        values={values}
        onChange={onChange}
      />

      <TemplatePair
        title="Factuur e-mail"
        nlSubjectKey="invoiceEmailSubject"
        nlBodyKey="invoiceEmailBody"
        enSubjectKey="invoiceEmailSubjectEn"
        enBodyKey="invoiceEmailBodyEn"
        nlDefaults={DEFAULTS.NL.invoice}
        enDefaults={DEFAULTS.EN.invoice}
        values={values}
        onChange={onChange}
      />

      <TemplatePair
        title="Betalingsherinnering"
        nlSubjectKey="reminderEmailSubject"
        nlBodyKey="reminderEmailBody"
        enSubjectKey="reminderEmailSubjectEn"
        enBodyKey="reminderEmailBodyEn"
        nlDefaults={DEFAULTS.NL.reminder}
        enDefaults={DEFAULTS.EN.reminder}
        values={values}
        onChange={onChange}
      />

      <div className="flex justify-end">
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-brand-blue hover:bg-brand-blue-dark text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : null}
          {saved ? "Opgeslagen" : saving ? "Opslaan…" : "Opslaan"}
        </button>
      </div>
    </div>
  );
}
