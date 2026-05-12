import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CreateContactButton } from "./CreateContactButton";
import { ContactsClient } from "./ContactsClient";

async function getCustomerContacts(customerId: string) {
  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true },
  });
  if (!customer) return null;

  return prisma.customerContact.findMany({
    where: { customerId },
    orderBy: [{ isPrimary: "desc" }, { lastName: "asc" }],
  });
}

export default async function CustomerContactsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const contacts = await getCustomerContacts(id);
  if (!contacts) notFound();

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
          Contacten ({contacts.length})
        </h2>
        <CreateContactButton customerId={id} />
      </div>

      <ContactsClient
        initialContacts={contacts.map((c) => ({
          id: c.id,
          firstName: c.firstName,
          lastName: c.lastName,
          email: c.email,
          phone: c.phone,
          roleOrFunction: c.roleOrFunction,
          isPrimary: c.isPrimary,
          isActive: c.isActive,
        }))}
      />
    </div>
  );
}
