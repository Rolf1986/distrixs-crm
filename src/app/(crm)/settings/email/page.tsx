import { prisma } from "@/lib/prisma";
import { EmailTemplatesForm } from "./EmailTemplatesForm";

async function getSettings() {
  return prisma.companySetting.findUnique({ where: { id: "singleton" } });
}

export default async function EmailTemplatesPage() {
  const s = await getSettings();

  return (
    <EmailTemplatesForm
      initialValues={{
        quoteEmailSubject:     s?.quoteEmailSubject     ?? "",
        quoteEmailBody:        s?.quoteEmailBody        ?? "",
        quoteEmailSubjectEn:   s?.quoteEmailSubjectEn   ?? "",
        quoteEmailBodyEn:      s?.quoteEmailBodyEn      ?? "",
        invoiceEmailSubject:   s?.invoiceEmailSubject   ?? "",
        invoiceEmailBody:      s?.invoiceEmailBody      ?? "",
        invoiceEmailSubjectEn: s?.invoiceEmailSubjectEn ?? "",
        invoiceEmailBodyEn:    s?.invoiceEmailBodyEn    ?? "",
        reminderEmailSubject:  s?.reminderEmailSubject  ?? "",
        reminderEmailBody:     s?.reminderEmailBody     ?? "",
        reminderEmailSubjectEn: s?.reminderEmailSubjectEn ?? "",
        reminderEmailBodyEn:   s?.reminderEmailBodyEn   ?? "",
      }}
    />
  );
}
