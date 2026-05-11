import { cn } from "@/lib/utils";

type DealStatus = "NEW" | "CONTACTED" | "QUOTE_SENT" | "WON" | "LOST";
type QuoteStatus = "DRAFT" | "SENT" | "ACCEPTED" | "REJECTED";
type InvoiceStatus = "DRAFT" | "SENT" | "PARTIALLY_PAID" | "PAID" | "OVERDUE" | "CREDITED";
type PoStatus = "DRAFT" | "ORDERED" | "PARTIALLY_RECEIVED" | "RECEIVED" | "CLOSED" | "CANCELLED";

type StatusType = "deal" | "quote" | "invoice" | "po" | "rma" | "oc" | "dn";

const LABELS: Record<string, string> = {
  // Customer
  ACTIVE: "Actief",
  INACTIVE: "Inactief",
  PROSPECT: "Prospect",
  BLOCKED: "Geblokkeerd",
  NEW: "Nieuw",
  CONTACTED: "Gecontacteerd",
  MEETING_PLANNED: "Meeting gepland",
  QUOTE_SENT: "Offerte verstuurd",
  WON: "Gewonnen",
  LOST: "Verloren",
  DRAFT: "Concept",
  SENT: "Verzonden",
  ACCEPTED: "Akkoord",
  REJECTED: "Afgewezen",
  PARTIALLY_PAID: "Deels betaald",
  PAID: "Betaald",
  OVERDUE: "Verlopen",
  CREDITED: "Gecrediteerd",
  ORDERED: "Besteld",
  PARTIALLY_RECEIVED: "Deels ontvangen",
  RECEIVED: "Ontvangen",
  CLOSED: "Gesloten",
  CANCELLED: "Geannuleerd",
  // RMA
  ASSIGNED: "Gekoppeld",
  IN_REVIEW: "In behandeling",
  APPROVED: "Goedgekeurd",
  RESOLVED: "Opgelost",
  // OC / DN
  CONFIRMED: "Bevestigd",
  DELIVERED: "Geleverd",
  // SupplierInvoice
  OPEN: "Open",
  DISPUTED: "Betwist",
};

const COLORS: Record<string, string> = {
  // Customer
  ACTIVE:            "bg-green-100 text-green-700",
  INACTIVE:          "bg-slate-100 text-slate-500",
  PROSPECT:          "bg-brand-blue-light text-brand-blue",
  BLOCKED:           "bg-red-100 text-red-700",
  NEW:               "bg-slate-100 text-slate-600",
  CONTACTED:         "bg-brand-blue-light text-brand-blue",
  MEETING_PLANNED:   "bg-purple-100 text-purple-700",
  QUOTE_SENT:        "bg-brand-blue-light text-brand-blue",
  WON:               "bg-green-100 text-green-700",
  LOST:              "bg-red-100 text-red-700",
  DRAFT:             "bg-slate-100 text-slate-600",
  SENT:              "bg-brand-blue-light text-brand-blue",
  ACCEPTED:          "bg-green-100 text-green-700",
  REJECTED:          "bg-red-100 text-red-700",
  PARTIALLY_PAID:    "bg-orange-100 text-orange-700",
  PAID:              "bg-green-100 text-green-700",
  OVERDUE:           "bg-orange-100 text-orange-700",
  CREDITED:          "bg-slate-100 text-slate-600",
  ORDERED:           "bg-brand-blue-light text-brand-blue",
  PARTIALLY_RECEIVED:"bg-orange-100 text-orange-700",
  RECEIVED:          "bg-green-100 text-green-700",
  CLOSED:            "bg-slate-100 text-slate-600",
  CANCELLED:         "bg-red-100 text-red-700",
  // RMA
  ASSIGNED:          "bg-brand-blue-light text-brand-blue",
  IN_REVIEW:         "bg-brand-blue-light text-brand-blue",
  APPROVED:          "bg-green-100 text-green-700",
  RESOLVED:          "bg-green-100 text-green-700",
  // OC / DN
  CONFIRMED:         "bg-green-100 text-green-700",
  DELIVERED:         "bg-green-100 text-green-700",
  // SupplierInvoice
  OPEN:              "bg-blue-100 text-blue-700",
  DISPUTED:          "bg-orange-100 text-orange-700",
};

export function StatusBadge({
  status,
  type,
}: {
  status: string;
  type?: StatusType;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
        COLORS[status] ?? "bg-slate-100 text-slate-600"
      )}
    >
      {LABELS[status] ?? status}
    </span>
  );
}
