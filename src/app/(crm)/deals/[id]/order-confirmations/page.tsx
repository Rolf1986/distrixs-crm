import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDate } from "@/lib/utils";
import { ClipboardCheck } from "lucide-react";
import { CreateOrderConfirmationButton } from "@/components/CreateOrderConfirmationButton";

async function getDealData(dealId: string) {
  return prisma.deal.findUnique({
    where: { id: dealId },
    select: {
      customerId: true,
      orderConfirmations: {
        include: {
          quote: { select: { quoteNumber: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      quotes: {
        where: { status: { in: ["DRAFT", "SENT", "ACCEPTED"] } },
        select: { id: true, quoteNumber: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
}

export default async function DealOrderConfirmationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const deal = await getDealData(id);
  if (!deal) notFound();

  const ocs = deal.orderConfirmations;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
          Orderbevestigingen ({ocs.length})
        </h2>
        <CreateOrderConfirmationButton dealId={id} quotes={deal.quotes} />
      </div>

      {ocs.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg px-6 py-12 text-center">
          <ClipboardCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
          <p className="text-slate-500 text-sm font-medium">Nog geen orderbevestigingen</p>
          <p className="text-slate-400 text-xs mt-1">
            Maak een orderbevestiging aan om de opdracht te bevestigen aan de klant.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Nummer</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Datum</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Offerte</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Verwachte levering</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ocs.map((oc) => (
                <tr key={oc.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-mono font-medium text-slate-900">
                    {oc.confirmationNumber}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(oc.confirmationDate)}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {oc.quote ? (
                      <Link href={`/quotes/${oc.quoteId}/lines`} className="text-brand-blue hover:underline">
                        {oc.quote.quoteNumber}
                      </Link>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {oc.expectedDelivery ? formatDate(oc.expectedDelivery) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={oc.status} type="oc" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
