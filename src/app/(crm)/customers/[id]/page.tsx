import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CustomerInfoClient } from "./CustomerInfoClient";

async function getCustomer(id: string) {
  return prisma.customer.findUnique({
    where: { id },
    include: { addresses: { orderBy: { type: "asc" } } },
  });
}

export default async function CustomerInfoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = await getCustomer(id);
  if (!customer) notFound();

  return (
    <CustomerInfoClient
      customer={{
        id: customer.id,
        companyName: customer.companyName,
        kvkNumber: customer.kvkNumber,
        vatNumber: customer.vatNumber,
        status: customer.status,
        defaultPaymentTerm: customer.defaultPaymentTerm,
        notes: customer.notes,
        addresses: customer.addresses.map((a) => ({
          id: a.id,
          type: a.type,
          isDefault: a.isDefault,
          street: a.street,
          houseNumber: a.houseNumber,
          postalCode: a.postalCode,
          city: a.city,
          country: a.country,
        })),
      }}
    />
  );
}
