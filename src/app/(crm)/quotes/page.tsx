import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { CreateQuoteStandaloneButton } from "@/components/CreateQuoteStandaloneButton";
import { QuotesClient } from "./QuotesClient";

async function getQuotes() {
  // Marge als aggregatie i.p.v. alle regels meesturen (KWAL-05: ~20k
  // regelrijtjes minder in de payload bij 4.700 offertes)
  const [quotes, margins] = await Promise.all([
    prisma.quote.findMany({
      include: {
        customer: { select: { companyName: true } },
        deal: { select: { title: true, dealNumber: true } },
        _count: { select: { invoices: true } },
      },
      orderBy: { quoteNumber: "desc" },
    }),
    prisma.quoteLine.groupBy({
      by: ["quoteId"],
      _sum: { expectedMarginSnapshot: true },
    }),
  ]);
  const marginByQuote = new Map(
    margins.map((m) => [m.quoteId, Number(m._sum.expectedMarginSnapshot ?? 0)])
  );
  return quotes.map((q) => ({ ...q, margin: marginByQuote.get(q.id) ?? 0 }));
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
            margin: q.margin,
            gefactureerd: q._count.invoices > 0,
            status: q.status,
          }))}
        />
      </div>
    </div>
  );
}
