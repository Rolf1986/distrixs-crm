import { prisma } from "@/lib/prisma";

type Category = "INVOICE" | "REMINDER" | "QUOTE" | "CREDIT_NOTE" | "OTHER";

/**
 * Centraal logboek: elke vanuit het CRM verstuurde e-mail vastleggen.
 * Nooit fataal — een mislukte log mag het versturen niet blokkeren.
 */
export async function logSentEmail(data: {
  category: Category;
  to: string;
  cc?: string | null;
  subject: string;
  bodyHtml: string;
  relatedType?: string | null;
  relatedId?: string | null;
  relatedLabel?: string | null;
  customerName?: string | null;
  createdBy?: string | null;
}): Promise<void> {
  try {
    await prisma.sentEmail.create({
      data: {
        category: data.category,
        toAddress: data.to,
        ccAddress: data.cc || null,
        subject: data.subject,
        bodyHtml: data.bodyHtml,
        relatedType: data.relatedType || null,
        relatedId: data.relatedId || null,
        relatedLabel: data.relatedLabel || null,
        customerName: data.customerName || null,
        createdBy: data.createdBy || null,
      },
    });
  } catch (e) {
    console.warn("[sent-email] loggen mislukt:", e);
  }
}
