import { prisma } from "@/lib/prisma";

// Termijnen zijn leidend zodra ze op een factuur staan:
// - betalingen dekken de termijnen cumulatief af (oudste eerst) en zetten
//   automatisch de "betaald"-vinkjes;
// - de vervaldatum van de factuur volgt de eerstvolgende onbetaalde termijn,
//   zodat status "over datum" en herinneringen het schema volgen.
export function installmentAmount(
  t: { amount: unknown; percentage: unknown },
  invoiceTotal: number
): number {
  if (t.amount != null) return Number(t.amount);
  return Math.round(invoiceTotal * (Number(t.percentage ?? 0) / 100) * 100) / 100;
}

export async function syncInvoiceInstallments(invoiceId: string): Promise<void> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      total: true,
      paidAmount: true,
      dueDate: true,
      status: true,
      installments: { orderBy: [{ dueDate: "asc" }, { installmentNumber: "asc" }] },
    },
  });
  if (!invoice || invoice.installments.length === 0) return;

  const total = Number(invoice.total);
  let remaining = Number(invoice.paidAmount);
  let nextDue: Date | null = null;

  for (const term of invoice.installments) {
    const amount = installmentAmount(term, total);
    const covered = remaining + 0.005 >= amount;
    remaining = Math.max(0, remaining - amount);
    if (covered !== term.isPaid) {
      await prisma.invoiceInstallment.update({
        where: { id: term.id },
        data: { isPaid: covered },
      });
    }
    if (!covered && !nextDue) nextDue = new Date(term.dueDate);
  }

  if (nextDue && invoice.status !== "PAID" && invoice.status !== "CREDITED") {
    const current = invoice.dueDate ? new Date(invoice.dueDate).getTime() : null;
    if (current !== nextDue.getTime()) {
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: { dueDate: nextDue },
      });
    }
  }
}
