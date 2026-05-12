import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });

  const take = 5;

  const [deals, customers, quotes, invoices, contacts] = await Promise.all([
    prisma.deal.findMany({
      where: {
        OR: [
          { dealNumber: { contains: q, mode: "insensitive" } },
          { title: { contains: q, mode: "insensitive" } },
          { customer: { companyName: { contains: q, mode: "insensitive" } } },
        ],
      },
      select: { id: true, dealNumber: true, title: true, status: true, customer: { select: { companyName: true } } },
      take,
    }),

    prisma.customer.findMany({
      where: {
        OR: [
          { companyName: { contains: q, mode: "insensitive" } },
          { kvkNumber: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, companyName: true, status: true },
      take,
    }),

    prisma.quote.findMany({
      where: {
        OR: [
          { quoteNumber: { contains: q, mode: "insensitive" } },
          { customer: { companyName: { contains: q, mode: "insensitive" } } },
        ],
      },
      select: { id: true, quoteNumber: true, status: true, customer: { select: { companyName: true } } },
      take,
    }),

    prisma.invoice.findMany({
      where: {
        OR: [
          { invoiceNumber: { contains: q, mode: "insensitive" } },
          { customer: { companyName: { contains: q, mode: "insensitive" } } },
        ],
      },
      select: { id: true, invoiceNumber: true, status: true, customer: { select: { companyName: true } } },
      take,
    }),

    prisma.customerContact.findMany({
      where: {
        OR: [
          { firstName: { contains: q, mode: "insensitive" } },
          { lastName: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
        ],
      },
      select: { id: true, firstName: true, lastName: true, email: true, customer: { select: { id: true, companyName: true } } },
      take,
    }),
  ]);

  const results = [
    ...deals.map((d) => ({
      type: "deal" as const,
      id: d.id,
      label: d.title,
      sub: `${d.dealNumber} · ${d.customer.companyName}`,
      href: `/deals/${d.id}/quotes`,
      status: d.status,
    })),
    ...customers.map((c) => ({
      type: "customer" as const,
      id: c.id,
      label: c.companyName,
      sub: c.status,
      href: `/customers/${c.id}`,
      status: c.status,
    })),
    ...quotes.map((q) => ({
      type: "quote" as const,
      id: q.id,
      label: q.quoteNumber,
      sub: q.customer.companyName,
      href: `/quotes/${q.id}/lines`,
      status: q.status,
    })),
    ...invoices.map((i) => ({
      type: "invoice" as const,
      id: i.id,
      label: i.invoiceNumber,
      sub: i.customer.companyName,
      href: `/invoices/${i.id}/lines`,
      status: i.status,
    })),
    ...contacts.map((c) => ({
      type: "contact" as const,
      id: c.id,
      label: `${c.firstName} ${c.lastName}`,
      sub: `${c.customer.companyName}${c.email ? ` · ${c.email}` : ""}`,
      href: `/customers/${c.customer.id}/contacts`,
      status: null,
    })),
  ];

  return NextResponse.json({ results });
}
