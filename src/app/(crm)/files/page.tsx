import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/ui/PageHeader";
import { FileText, Receipt, Handshake, ShoppingCart, FileImage, FileCode, FileArchive, File } from "lucide-react";
import Link from "next/link";
import { formatDateTime } from "@/lib/utils";

async function getFiles() {
  return prisma.fileAsset.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      deal: { select: { id: true, dealNumber: true, title: true } },
      quote: { select: { id: true, quoteNumber: true } },
      invoice: { select: { id: true, invoiceNumber: true } },
      purchaseOrder: { select: { id: true, poNumber: true } },
    },
  });
}

function getEntityLink(file: {
  entityType: string;
  entityId: string;
  deal?: { id: string; dealNumber: string; title: string } | null;
  quote?: { id: string; quoteNumber: string } | null;
  invoice?: { id: string; invoiceNumber: string } | null;
  purchaseOrder?: { id: string; poNumber: string } | null;
}) {
  switch (file.entityType) {
    case "deal":
      return { href: `/deals/${file.entityId}/quotes`, label: file.deal?.dealNumber ?? file.entityId, icon: Handshake };
    case "quote":
      return { href: `/quotes/${file.entityId}/lines`, label: file.quote?.quoteNumber ?? file.entityId, icon: FileText };
    case "invoice":
      return { href: `/invoices/${file.entityId}/lines`, label: file.invoice?.invoiceNumber ?? file.entityId, icon: Receipt };
    case "purchase_order":
      return { href: `/purchase-orders/${file.entityId}`, label: file.purchaseOrder?.poNumber ?? file.entityId, icon: ShoppingCart };
    default:
      return { href: "#", label: file.entityId, icon: File };
  }
}

function FileIcon({ mimeType }: { mimeType: string }) {
  if (mimeType.startsWith("image/")) return <FileImage className="w-4 h-4 text-violet-500" />;
  if (mimeType === "application/pdf") return <FileText className="w-4 h-4 text-red-500" />;
  if (mimeType.includes("zip") || mimeType.includes("tar") || mimeType.includes("gzip"))
    return <FileArchive className="w-4 h-4 text-amber-500" />;
  if (mimeType.startsWith("text/") || mimeType.includes("json") || mimeType.includes("xml"))
    return <FileCode className="w-4 h-4 text-blue-500" />;
  return <File className="w-4 h-4 text-slate-400" />;
}

const ENTITY_TYPE_LABEL: Record<string, string> = {
  deal: "Deal",
  quote: "Offerte",
  invoice: "Factuur",
  purchase_order: "Inkooporder",
};

const ENTITY_TYPE_COLOR: Record<string, string> = {
  deal: "bg-brand-blue-light text-brand-blue",
  quote: "bg-violet-50 text-violet-700",
  invoice: "bg-orange-50 text-orange-700",
  purchase_order: "bg-teal-50 text-teal-700",
};

export default async function FilesPage() {
  const files = await getFiles();

  return (
    <div className="min-h-screen bg-slate-50">
      <PageHeader
        title="Bestanden"
        description={`${files.length} bestand${files.length !== 1 ? "en" : ""}`}
      />

      <div className="px-8 py-6">
        {files.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
            <File className="w-8 h-8 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Nog geen bestanden geüpload</p>
            <p className="text-slate-300 text-xs mt-1">
              Bestanden worden automatisch opgeslagen wanneer je PDF-documenten genereert.
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Bestandsnaam</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Gekoppeld aan</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Datum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {files.map((file) => {
                  const entity = getEntityLink(file);
                  const EntityIcon = entity.icon;
                  return (
                    <tr key={file.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <FileIcon mimeType={file.mimeType} />
                          <span className="text-slate-900 font-medium">{file.fileName}</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5 ml-6">{file.mimeType}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ENTITY_TYPE_COLOR[file.entityType] ?? "bg-slate-100 text-slate-600"}`}>
                          {ENTITY_TYPE_LABEL[file.entityType] ?? file.entityType}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={entity.href}
                          className="flex items-center gap-1.5 text-brand-blue hover:text-brand-blue-dark font-medium transition-colors"
                        >
                          <EntityIcon className="w-3.5 h-3.5" />
                          {entity.label}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs">
                        {formatDateTime(file.createdAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
