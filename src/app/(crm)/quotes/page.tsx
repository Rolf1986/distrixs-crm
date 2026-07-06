import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { CreateQuoteStandaloneButton } from "@/components/CreateQuoteStandaloneButton";
import { QuotesClient } from "./QuotesClient";

async function getQuotes() {
  return prisma.quote.findMany({
    include: {
      customer: { select: { companyName: true } },
      deal: { select: { title: true, dealNumber: true } },
      lines: { select: { expectedMarginSnapshot: true } },
      _count: { select: { invoices: true } },
    },
    orderBy: { quoteNumber: "desc" },
  });
}

async function getCustomers() {
  return prisma.customer.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, companyName: true },
    orderBy: { companyName: "asc" },
  });
}

async function getDeals() {
  return prisma.deal.findMany({
    where: { status: { in: ["NEW", "CONTACTED", "MEETING_PLANNED", "QUOTE_SENT"] } },
    select: { id: true, dealNumber: true, title: true },
    orderBy: { dealNumber: "asc" },
  });
}

export default async function QuotesPage() {
  const [quotes, customers, deals] = await Promise.all([getQuotes(), getCustomers(), getDeals()]);

  const openCount = quotes.filter((q) => q.status === "SENT" || q.status === "DRAFT").length;

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader
        title="Offertes"
        description={`${quotes.length} offertes · ${openCount} open`}
        action={<CreateQuoteStandaloneButton customers={customers} deals={deals} />}
      />
      <div className="px-8 py-6">
        <QuotesClient
          quotes={quotes.map((q) => ({
            id: q.id,
            quoteNumber: q.quoteNumber,
            customerId: q.customerId,
            customerName: q.customer.companyName,
            dealId: q.dealId ?? null,
            dealNumber: q.deal?.dealNumber ?? null,
            quoteDate: q.quoteDate.toISOString(),
            validUntil: q.validUntil?.toISOString() ?? null,
            subtotal: Number(q.subtotal),
            total: Number(q.total),
            margin: q.lines.reduce((s, l) => s + Number(l.expectedMarginSnapshot), 0),
            gefactureerd: q._count.invoices > 0,
            status: q.status,
          }))}
        />
      </div>
    </div>
  );
}
