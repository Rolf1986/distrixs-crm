import type { DealNacalculatie } from "@/lib/nacalculatie";

function eur(n: number): string {
  return n.toLocaleString("nl-NL", { style: "currency", currency: "EUR" });
}

function pct(part: number, whole: number): string {
  if (whole <= 0) return "—";
  return `${((part / whole) * 100).toFixed(1)}%`;
}

const PO_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Concept",
  ORDERED: "Besteld",
  PARTIALLY_RECEIVED: "Deels ontvangen",
  RECEIVED: "Ontvangen",
  CLOSED: "Afgesloten",
};

export function NacalculatieCard({ data }: { data: DealNacalculatie }) {
  if (data.omzet === 0 && !data.hasPurchaseOrders) return null;

  const variance = data.realMargin - data.expectedMargin;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">Nacalculatie</h2>
        {data.hasPurchaseOrders && (
          <span
            className={`text-xs font-medium px-2 py-1 rounded-full ${
              data.complete
                ? "bg-green-50 text-green-700"
                : "bg-orange-50 text-orange-700"
            }`}
          >
            {data.complete ? "Definitief" : "Voorlopig — inkoop loopt nog"}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
        <div className="text-slate-500">Omzet (excl. BTW)</div>
        <div className="text-right font-medium text-slate-900">{eur(data.omzet)}</div>

        <div className="text-slate-500">Verwachte marge</div>
        <div className="text-right font-medium text-slate-900">
          {eur(data.expectedMargin)}
          <span className="ml-2 text-xs text-slate-400">{pct(data.expectedMargin, data.omzet)}</span>
        </div>

        {data.hasPurchaseOrders ? (
          <>
            <div className="text-slate-500">Werkelijke inkoopkosten</div>
            <div className="text-right font-medium text-slate-900">{eur(data.realCost)}</div>

            <div className="text-slate-500">Werkelijke marge</div>
            <div
              className={`text-right font-semibold ${
                data.realMargin >= 0 ? "text-green-700" : "text-red-600"
              }`}
            >
              {eur(data.realMargin)}
              <span className="ml-2 text-xs font-normal text-slate-400">{pct(data.realMargin, data.omzet)}</span>
            </div>

            <div className="text-slate-500">Verschil t.o.v. verwacht</div>
            <div
              className={`text-right font-medium ${
                variance >= 0 ? "text-green-700" : "text-red-600"
              }`}
            >
              {variance >= 0 ? "+" : ""}{eur(variance)}
            </div>
          </>
        ) : (
          <div className="col-span-2 text-xs text-slate-400 pt-1">
            Nog geen inkooporders — werkelijke marge volgt zodra inkoop is geregistreerd.
          </div>
        )}
      </div>

      {data.purchaseOrders.length > 0 && (
        <div className="border-t border-slate-100 pt-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-400">
                <th className="text-left font-medium pb-1">Inkooporder</th>
                <th className="text-left font-medium pb-1">Status</th>
                <th className="text-right font-medium pb-1">Product</th>
                <th className="text-right font-medium pb-1">Extra kosten</th>
                <th className="text-right font-medium pb-1">Totaal</th>
              </tr>
            </thead>
            <tbody>
              {data.purchaseOrders.map((po) => (
                <tr key={po.id} className="border-t border-slate-50">
                  <td className="py-1.5 text-slate-700">
                    {po.poNumber} <span className="text-slate-400">· {po.supplierName}</span>
                  </td>
                  <td className="py-1.5 text-slate-500">{PO_STATUS_LABELS[po.status] ?? po.status}</td>
                  <td className="py-1.5 text-right text-slate-700">
                    {eur(po.productCost)}
                    {!po.hasSupplierInvoice && (
                      <span className="ml-1 text-slate-400" title="Geen inkoopfactuur gekoppeld — op basis van PO-regels">
                        *
                      </span>
                    )}
                  </td>
                  <td className="py-1.5 text-right text-slate-700">{eur(po.extraCosts)}</td>
                  <td className="py-1.5 text-right font-medium text-slate-900">{eur(po.totalCost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.purchaseOrders.some((po) => !po.hasSupplierInvoice) && (
            <p className="text-[11px] text-slate-400 mt-2">
              * Geen inkoopfactuur gekoppeld — productkosten op basis van PO-regels.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
