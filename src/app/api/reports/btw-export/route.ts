import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()), 10);
  const quarterParam = searchParams.get("quarter");
  const quarter = quarterParam ? parseInt(quarterParam, 10) : null;

  // Build date range
  let from: Date;
  let to: Date;
  let fileLabel: string;
  if (quarter && quarter >= 1 && quarter <= 4) {
    from = new Date(year, (quarter - 1) * 3, 1);
    to = new Date(year, quarter * 3, 0, 23, 59, 59, 999);
    fileLabel = `BTW-${year}-Q${quarter}`;
  } else {
    from = new Date(year, 0, 1);
    to = new Date(year, 11, 31, 23, 59, 59, 999);
    fileLabel = `BTW-${year}`;
  }

  const REVENUE_STATUSES = ["SENT", "PARTIALLY_PAID", "PAID", "OVERDUE"] as const;

  const invoices = await prisma.invoice.findMany({
    where: {
      status: { in: [...REVENUE_STATUSES] },
      invoiceDate: { gte: from, lte: to },
    },
    include: {
      customer: { select: { companyName: true } },
      lines: { select: { netLineTotal: true, vatRate: true, vatAmount: true } },
    },
    orderBy: { invoiceDate: "asc" },
  });

  // Build CSV rows
  const csvRows: string[][] = [
    ["Factuurnr", "Datum", "Klant", "Subtotaal", "BTW21", "BTW9", "BTW0", "Totaal"],
  ];

  for (const inv of invoices) {
    const subtotal = Number(inv.subtotal);
    const total = Number(inv.total);

    // Group vat amounts by rate
    const vatGroups: Record<string, number> = { "21": 0, "9": 0, "0": 0 };
    for (const line of inv.lines) {
      const rate = Number(line.vatRate);
      const key = rate === 21 ? "21" : rate === 9 ? "9" : "0";
      vatGroups[key] += Number(line.vatAmount);
    }

    const dateStr = new Intl.DateTimeFormat("nl-NL", { day: "2-digit", month: "2-digit", year: "numeric" }).format(
      new Date(inv.invoiceDate)
    );

    const row = [
      inv.invoiceNumber,
      dateStr,
      inv.customer.companyName,
      subtotal.toFixed(2),
      vatGroups["21"].toFixed(2),
      vatGroups["9"].toFixed(2),
      vatGroups["0"].toFixed(2),
      total.toFixed(2),
    ];
    csvRows.push(row);
  }

  // Totals row
  let tSubtotal = 0, tBtw21 = 0, tBtw9 = 0, tBtw0 = 0, tTotal = 0;
  for (const row of csvRows.slice(1)) {
    tSubtotal += parseFloat(row[3]);
    tBtw21 += parseFloat(row[4]);
    tBtw9 += parseFloat(row[5]);
    tBtw0 += parseFloat(row[6]);
    tTotal += parseFloat(row[7]);
  }
  csvRows.push(["TOTAAL", "", "", tSubtotal.toFixed(2), tBtw21.toFixed(2), tBtw9.toFixed(2), tBtw0.toFixed(2), tTotal.toFixed(2)]);

  // Serialize to CSV
  function escapeCsv(value: string) {
    if (value.includes(",") || value.includes('"') || value.includes("\n")) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  const csv = csvRows.map((row) => row.map(escapeCsv).join(",")).join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileLabel}.csv"`,
    },
  });
}
