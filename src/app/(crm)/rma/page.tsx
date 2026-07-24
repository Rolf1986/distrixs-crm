import { prisma } from "@/lib/prisma";
import { RowLink } from "@/components/RowLink";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import { CreateRmaButton } from "@/components/CreateRmaButton";

async function getRmas() {
  return prisma.rma.findMany({
    include: {
      customer: { select: { companyName: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

const REASON_LABELS: Record<string, string> = {
  DEFECTIVE: "Defect",
  WRONG_PRODUCT: "Verkeerd product",
  DAMAGED: "Beschadigd",
  NOT_AS_DESCRIBED: "Niet zoals beschreven",
  CHANGED_MIND: "Van gedachten veranderd",
  OTHER: "Anders",
};

export default async function RmaPage() {
  const rmas = await getRmas();
  const nieuw = rmas.filter((r) => r.status === "NEW").length;

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader
        title="RMA"
        description={`${rmas.length} verzoeken${nieuw > 0 ? ` · ${nieuw} nieuw` : ""}`}
        action={<CreateRmaButton />}
      />
      <div className="px-8 py-6">
        <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Nummer</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Indiener</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Product</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Reden</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Klant</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Datum</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500 text-xs uppercase tracking-wide">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rmas.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-slate-400">
                    Nog geen RMA-verzoeken
                  </td>
                </tr>
              )}
              {rmas.map((rma) => (
                <tr key={rma.id} className="hover:bg-slate-50 cursor-pointer transition-colors group relative">
                  <td className="px-4 py-3">
                    <RowLink href={`/rma/${rma.id}`} />
                    <span className="font-mono text-slate-900 font-medium group-hover:text-brand-blue transition-colors">
                      {rma.rmaNumber}
                    </span>
                    {rma.status === "NEW" && (
                      <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700">
                        Nieuw
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-slate-900 font-medium">{rma.submittedName}</div>
                    <div className="text-slate-400 text-xs">{rma.submittedEmail}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600 max-w-[200px] truncate">
                    {rma.productDescription}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {REASON_LABELS[rma.reason] ?? rma.reason}
                  </td>
                  <td className="px-4 py-3">
                    {rma.customer ? (
                      <span className="text-slate-900">{rma.customer.companyName}</span>
                    ) : (
                      <span className="text-slate-400 italic text-xs">Niet gekoppeld</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(rma.createdAt)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={rma.status} type="rma" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
