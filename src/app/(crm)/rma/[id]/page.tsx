import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { formatDate, formatDateTime } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { RmaActions } from "./RmaActions";

const REASON_LABELS: Record<string, string> = {
  DEFECTIVE: "Defect product",
  WRONG_PRODUCT: "Verkeerd product geleverd",
  DAMAGED: "Beschadigd bij levering",
  NOT_AS_DESCRIBED: "Niet zoals beschreven",
  CHANGED_MIND: "Van gedachten veranderd",
  OTHER: "Anders",
};

async function getRma(id: string) {
  return prisma.rma.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, companyName: true, customerNumber: true } },
      assignedToUser: { select: { id: true, name: true } },
    },
  });
}

async function getCustomers() {
  return prisma.customer.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, companyName: true, customerNumber: true },
    orderBy: { companyName: "asc" },
  });
}

async function getUsers() {
  return prisma.user.findMany({
    where: { isActive: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div className="flex gap-3">
      <dt className="w-40 shrink-0 text-xs text-slate-500 font-medium pt-0.5">{label}</dt>
      <dd className="text-sm text-slate-900">{value}</dd>
    </div>
  );
}

export default async function RmaDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [rma, customers, users] = await Promise.all([getRma(id), getCustomers(), getUsers()]);
  if (!rma) notFound();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="px-8 py-6 bg-white border-b border-slate-200">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-xl font-semibold text-slate-900 font-mono">{rma.rmaNumber}</h1>
              <StatusBadge status={rma.status} type="rma" />
            </div>
            <p className="text-sm text-slate-500">
              Ingediend op {formatDateTime(rma.createdAt)} · {rma.submittedName}
            </p>
          </div>
        </div>
      </div>

      <div className="px-8 py-6 grid grid-cols-3 gap-6">
        {/* Linker kolom: formulierdata */}
        <div className="col-span-2 space-y-4">
          {/* Contactgegevens */}
          <section className="bg-white border border-slate-200 rounded-lg p-5">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">
              Contactgegevens
            </h2>
            <dl className="space-y-2">
              <InfoRow label="Naam" value={rma.submittedName} />
              <InfoRow label="Bedrijf" value={rma.submittedCompany} />
              <InfoRow label="E-mail" value={rma.submittedEmail} />
              <InfoRow label="Telefoon" value={rma.submittedPhone} />
            </dl>
          </section>

          {/* Productinfo */}
          <section className="bg-white border border-slate-200 rounded-lg p-5">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">
              Productinformatie
            </h2>
            <dl className="space-y-2">
              <InfoRow label="Product" value={rma.productDescription} />
              <InfoRow label="Ordernummer" value={rma.orderReference} />
              <InfoRow label="Serienummer" value={rma.serialNumber} />
              <InfoRow label="Aankoopdatum" value={rma.purchaseDate ? formatDate(rma.purchaseDate) : null} />
              <InfoRow label="Aantal" value={String(rma.quantity)} />
            </dl>
          </section>

          {/* Retourinformatie */}
          <section className="bg-white border border-slate-200 rounded-lg p-5">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4">
              Reden van retour
            </h2>
            <dl className="space-y-2 mb-4">
              <InfoRow label="Categorie" value={REASON_LABELS[rma.reason] ?? rma.reason} />
            </dl>
            <div className="bg-slate-50 rounded-lg px-4 py-3 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
              {rma.description}
            </div>
          </section>
        </div>

        {/* Rechter kolom: beheer */}
        <div className="space-y-4">
          <RmaActions
            rma={{
              id: rma.id,
              status: rma.status,
              customerId: rma.customerId,
              assignedTo: rma.assignedTo,
              resolution: rma.resolution ?? null,
              resolutionNotes: rma.resolutionNotes,
              customer: rma.customer,
              assignedToUser: rma.assignedToUser,
            }}
            customers={customers}
            users={users}
          />
        </div>
      </div>
    </div>
  );
}
