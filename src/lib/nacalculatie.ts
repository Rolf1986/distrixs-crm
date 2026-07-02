import { prisma } from "@/lib/prisma";

/**
 * Nacalculatie (Fase 5): verwachte vs. werkelijke marge per deal.
 *
 * Live berekend bij weergave (geen opslag, kan dus nooit verouderen):
 * - Omzet          = som van niet-afgewezen offertes (excl. BTW)
 * - Verwachte kost = som van expected-cost op de offerteregels
 *                    (verkoopprijs − expectedMarginSnapshot)
 * - Werkelijke kost = per PO van de deal: inkoopfactuur-subtotaal
 *                    (of anders PO-regelkosten) + werkelijke extra kosten
 * - Werkelijke marge = omzet − werkelijke kosten
 *
 * De nacalculatie is "compleet" zodra alle niet-geannuleerde PO's van de
 * deal RECEIVED of CLOSED zijn én er minstens één PO is.
 */

const DONE_STATUSES = ["RECEIVED", "CLOSED"] as const;

export interface PoNacalculatie {
  id: string;
  poNumber: string;
  status: string;
  supplierName: string;
  productCost: number;      // inkoopfactuur-subtotaal of PO-regelkosten
  extraCosts: number;       // werkelijke shipping/invoerrechten/...
  totalCost: number;
  hasSupplierInvoice: boolean;
  isDone: boolean;
}

export interface DealNacalculatie {
  omzet: number;
  expectedCost: number;
  expectedMargin: number;
  realCost: number;
  realMargin: number;
  complete: boolean;        // alle PO's afgerond → nacalculatie definitief
  hasPurchaseOrders: boolean;
  purchaseOrders: PoNacalculatie[];
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export async function calcDealNacalculatie(dealId: string): Promise<DealNacalculatie> {
  const deal = await prisma.deal.findUnique({
    where: { id: dealId },
    select: {
      quotes: {
        where: { status: { not: "REJECTED" } },
        select: {
          subtotal: true,
          lines: { select: { netLineTotal: true, expectedMarginSnapshot: true } },
        },
      },
      purchaseOrders: {
        where: { status: { not: "CANCELLED" } },
        select: {
          id: true,
          poNumber: true,
          status: true,
          supplier: { select: { name: true } },
          lines: { select: { baseCostSnapshot: true, qtyOrdered: true, qtyReceived: true } },
          extraCosts: { select: { amount: true } },
          supplierInvoices: { select: { subtotal: true } },
        },
      },
    },
  });

  if (!deal) {
    return {
      omzet: 0, expectedCost: 0, expectedMargin: 0, realCost: 0, realMargin: 0,
      complete: false, hasPurchaseOrders: false, purchaseOrders: [],
    };
  }

  // Verwacht: uit offertes
  let omzet = 0;
  let expectedMargin = 0;
  for (const q of deal.quotes) {
    omzet += Number(q.subtotal);
    expectedMargin += q.lines.reduce((s, l) => s + Number(l.expectedMarginSnapshot), 0);
  }
  const expectedCost = omzet - expectedMargin;

  // Werkelijk: uit inkooporders
  const purchaseOrders: PoNacalculatie[] = deal.purchaseOrders.map((po) => {
    const lineCost = po.lines.reduce((s, l) => {
      const qty = Number(l.qtyReceived) > 0 ? Number(l.qtyReceived) : Number(l.qtyOrdered);
      return s + Number(l.baseCostSnapshot) * qty;
    }, 0);
    const invoiceSubtotal = po.supplierInvoices.reduce((s, si) => s + Number(si.subtotal), 0);
    const productCost = invoiceSubtotal > 0 ? invoiceSubtotal : lineCost;
    const extraCosts = po.extraCosts.reduce((s, c) => s + Number(c.amount), 0);
    return {
      id: po.id,
      poNumber: po.poNumber,
      status: po.status,
      supplierName: po.supplier.name,
      productCost: round2(productCost),
      extraCosts: round2(extraCosts),
      totalCost: round2(productCost + extraCosts),
      hasSupplierInvoice: invoiceSubtotal > 0,
      isDone: (DONE_STATUSES as readonly string[]).includes(po.status),
    };
  });

  const realCost = round2(purchaseOrders.reduce((s, po) => s + po.totalCost, 0));
  const hasPurchaseOrders = purchaseOrders.length > 0;
  const complete = hasPurchaseOrders && purchaseOrders.every((po) => po.isDone);

  return {
    omzet: round2(omzet),
    expectedCost: round2(expectedCost),
    expectedMargin: round2(expectedMargin),
    realCost,
    realMargin: round2(omzet - realCost),
    complete,
    hasPurchaseOrders,
    purchaseOrders,
  };
}
