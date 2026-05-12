import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ExtraCostsClient } from "./ExtraCostsClient";

async function getPo(id: string) {
  return prisma.purchaseOrder.findUnique({
    where: { id },
    include: { extraCosts: { orderBy: { createdAt: "asc" } } },
  });
}

export default async function PoExtraCostsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const po = await getPo(id);
  if (!po) notFound();

  return (
    <ExtraCostsClient
      poId={id}
      initialCosts={po.extraCosts.map((c) => ({
        id: c.id,
        costType: c.costType as string,
        amount: Number(c.amount),
        currency: c.currency,
        description: c.description,
      }))}
    />
  );
}
