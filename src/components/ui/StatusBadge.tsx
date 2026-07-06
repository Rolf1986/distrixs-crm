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
  ACTIVE:            "bg-green-50 text-green-800 border-green-200",
  INACTIVE:          "bg-slate-50 text-slate-500 border-slate-200",
  PROSPECT:          "bg-brand-blue-light text-brand-blue border-blue-200",
  BLOCKED:           "bg-red-50 text-red-800 border-red-200",
  NEW:               "bg-slate-50 text-slate-600 border-slate-200",
  CONTACTED:         "bg-brand-blue-light text-brand-blue border-blue-200",
  MEETING_PLANNED:   "bg-purple-50 text-purple-800 border-purple-200",
  QUOTE_SENT:        "bg-brand-blue-light text-brand-blue border-blue-200",
  WON:               "bg-green-50 text-green-800 border-green-200",
  LOST:              "bg-red-50 text-red-800 border-red-200",
  DRAFT:             "bg-slate-50 text-slate-600 border-slate-200",
  SENT:              "bg-brand-blue-light text-brand-blue border-blue-200",
  ACCEPTED:          "bg-green-50 text-green-800 border-green-200",
  REJECTED:          "bg-red-50 text-red-800 border-red-200",
  PARTIALLY_PAID:    "bg-orange-50 text-orange-800 border-orange-200",
  PAID:              "bg-green-50 text-green-800 border-green-200",
  OVERDUE:           "bg-orange-50 text-orange-800 border-orange-200",
  CREDITED:          "bg-slate-50 text-slate-600 border-slate-200",
  ORDERED:           "bg-brand-blue-light text-brand-blue border-blue-200",
  PARTIALLY_RECEIVED:"bg-orange-50 text-orange-800 border-orange-200",
  RECEIVED:          "bg-green-50 text-green-800 border-green-200",
  CLOSED:            "bg-slate-50 text-slate-600 border-slate-200",
  CANCELLED:         "bg-red-50 text-red-800 border-red-200",
  // RMA
  ASSIGNED:          "bg-brand-blue-light text-brand-blue border-blue-200",
  IN_REVIEW:         "bg-brand-blue-light text-brand-blue border-blue-200",
  APPROVED:          "bg-green-50 text-green-800 border-green-200",
  RESOLVED:          "bg-green-50 text-green-800 border-green-200",
  // OC / DN
  CONFIRMED:         "bg-green-50 text-green-800 border-green-200",
  DELIVERED:         "bg-green-50 text-green-800 border-green-200",
  // SupplierInvoice
  OPEN:              "bg-blue-50 text-blue-800 border-blue-200",
  DISPUTED:          "bg-orange-50 text-orange-800 border-orange-200",
};

// Dot-kleur per status (visuele hint naast het label)
const DOTS: Record<string, string> = {
  ACTIVE: "bg-green-500", WON: "bg-green-500", ACCEPTED: "bg-green-500", PAID: "bg-green-500",
  RECEIVED: "bg-green-500", APPROVED: "bg-green-500", RESOLVED: "bg-green-500", CONFIRMED: "bg-green-500", DELIVERED: "bg-green-500",
  SENT: "bg-brand-blue", CONTACTED: "bg-brand-blue", QUOTE_SENT: "bg-brand-blue", ORDERED: "bg-brand-blue",
  PROSPECT: "bg-brand-blue", ASSIGNED: "bg-brand-blue", IN_REVIEW: "bg-brand-blue", OPEN: "bg-blue-500",
  OVERDUE: "bg-orange-500", PARTIALLY_PAID: "bg-orange-500", PARTIALLY_RECEIVED: "bg-orange-500", DISPUTED: "bg-orange-500",
  LOST: "bg-red-500", REJECTED: "bg-red-500", BLOCKED: "bg-red-500", CANCELLED: "bg-red-500",
  MEETING_PLANNED: "bg-purple-500",
  DRAFT: "bg-slate-400", NEW: "bg-slate-400", INACTIVE: "bg-slate-300", CREDITED: "bg-slate-400", CLOSED: "bg-slate-400",
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
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border",
        COLORS[status] ?? "bg-slate-50 text-slate-600 border-slate-200"
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", DOTS[status] ?? "bg-slate-400")} />
      {LABELS[status] ?? status}
    </span>
  );
}
