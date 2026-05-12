import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { InstallmentsEditor } from "@/components/InstallmentsEditor";

async function getInvoice(id: string) {
  return prisma.invoice.findUnique({
    where: { id },
    select: {
      id: true,
      total: true,
      twinfieldLocked: true,
      installments: { orderBy: { installmentNumber: "asc" } },
    },
  });
}

export default async function InvoiceInstallmentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const invoice = await getInvoice(id);
  if (!invoice) notFound();

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-800 mb-1">Betalingstermijnen</h2>
        <p className="text-xs text-slate-400">
          Verdeel de factuur in termijnen per percentage of vast bedrag. Gebruik de snelstart-presets of voeg termijnen handmatig toe.
        </p>
      </div>

      <InstallmentsEditor
        invoiceId={id}
        invoiceTotal={Number(invoice.total)}
        installments={invoice.installments.map((i) => ({
          id: i.id,
          installmentNumber: i.installmentNumber,
          dueDate: i.dueDate.toISOString(),
          percentage: i.percentage !== null ? Number(i.percentage) : null,
          amount: i.amount !== null ? Number(i.amount) : null,
          isPaid: i.isPaid,
          notes: i.notes,
        }))}
        locked={invoice.twinfieldLocked}
      />
    </div>
  );
}
