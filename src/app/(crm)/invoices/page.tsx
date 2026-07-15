import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { CreateInvoiceStandaloneButton } from "@/components/CreateInvoiceStandaloneButton";
import { InvoicesClient } from "./InvoicesClient";
import { BulkReminderButton, type OverdueInvoice } from "./BulkReminderButton";

async function getInvoices() {
  return prisma.invoice.findMany({
    include: {
      customer: {
        select: {
          companyName: true,
          contacts: { where: { isPrimary: true, isActive: true }, select: { email: true }, take: 1 },
        },
      },
      deal: { select: { dealNumber: true } },
      reminders: {
        where: { status: "SENT" },
        select: { sentAt: true },
        orderBy: { sentAt: "desc" },
      },
    },
    orderBy: { invoiceDate: "desc" },
  });
}

async function getCreditNotes() {
  return prisma.creditNote.findMany({
    include: {
      customer: { select: { companyName: true } },
      invoice: { select: { id: true, invoiceNumber: true } },
    },
    orderBy: { creditNoteDate: "desc" },
  });
}

async function getCustomers() {
  return prisma.customer.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, companyName: true, defaultPaymentTerm: true },
    orderBy: { companyName: "asc" },
  });
}

async function getDealsForInvoice() {
  return prisma.deal.findMany({
    where: { status: { in: ["NEW", "CONTACTED", "MEETING_PLANNED", "QUOTE_SENT", "WON"] } },
    select: { id: true, dealNumber: true, title: true },
    orderBy: { dealNumber: "asc" },
  });
}

export default async function InvoicesPage() {
  const [invoices, customers, deals, creditNotes] = await Promise.all([
    getInvoices(),
    getCustomers(),
    getDealsForInvoice(),
    getCreditNotes(),
  ]);

  const unpaidCount = invoices.filter(
    (i) => i.status !== "PAID" && i.status !== "CREDITED"
  ).length;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const overdueInvoices: OverdueInvoice[] = invoices
    .filter((inv) => {
      const due = new Date(inv.dueDate);
      due.setHours(0, 0, 0, 0);
      return (
        inv.status !== "PAID" &&
        inv.status !== "CREDITED" &&
        inv.status !== "DRAFT" &&
        due < today
      );
    })
    .map((inv) => {
      const due = new Date(inv.dueDate);
      due.setHours(0, 0, 0, 0);
      const daysOverdue = Math.ceil((today.getTime() - due.getTime()) / 86400000);
      const primaryEmail = inv.customer.contacts[0]?.email ?? null;
      return {
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        customerName: inv.customer.companyName,
        customerEmail: primaryEmail,
        total: Number(inv.total),
        openAmount: Number(inv.openAmount),
        dueDate: inv.dueDate.toISOString(),
        daysOverdue,
      };
    });

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader
        title="Facturen"
        description={`${invoices.length} facturen · ${unpaidCount} openstaand`}
        action={
          <div className="flex items-center gap-2">
            <BulkReminderButton overdueInvoices={overdueInvoices} />
            <CreateInvoiceStandaloneButton customers={customers} deals={deals} />
          </div>
        }
      />
      <div className="px-8 py-6">
        <InvoicesClient
          invoices={invoices.map((inv) => ({
            id: inv.id,
            invoiceNumber: inv.invoiceNumber,
            ourReference: inv.ourReference ?? null,
            customerId: inv.customerId,
            customerName: inv.customer.companyName,
            dealId: inv.dealId ?? null,
            dealNumber: inv.deal?.dealNumber ?? null,
            invoiceDate: inv.invoiceDate.toISOString(),
            dueDate: inv.dueDate.toISOString(),
            total: Number(inv.total),
            openAmount: Number(inv.openAmount),
            status: inv.status,
            reminderCount: inv.reminders.length,
            lastReminderAt: inv.reminders[0]?.sentAt?.toISOString() ?? null,
          }))}
          creditNotes={creditNotes.map((cn) => ({
            id: cn.id,
            creditNoteNumber: cn.creditNoteNumber,
            creditNoteDate: cn.creditNoteDate.toISOString(),
            customerName: cn.customer.companyName,
            invoiceId: cn.invoice?.id ?? null,
            invoiceNumber: cn.invoice?.invoiceNumber ?? null,
            total: Number(cn.total),
          }))}
        />
      </div>
    </div>
  );
}
