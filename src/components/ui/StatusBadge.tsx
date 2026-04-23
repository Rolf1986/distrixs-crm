import { cn } from "@/lib/utils";

type Variant = "gray" | "blue" | "green" | "red" | "orange" | "purple";

const variants: Record<Variant, string> = {
  gray:   "bg-slate-100 text-slate-600",
  blue:   "bg-blue-50 text-blue-700",
  green:  "bg-green-50 text-green-700",
  red:    "bg-red-50 text-red-700",
  orange: "bg-orange-50 text-orange-700",
  purple: "bg-purple-50 text-purple-700",
};

const dealStatusMap: Record<string, { label: string; variant: Variant }> = {
  NEW:          { label: "Nieuw",             variant: "gray" },
  CONTACTED:    { label: "Contact",           variant: "blue" },
  QUOTE_SENT:   { label: "Offerte verzonden", variant: "blue" },
  WON:          { label: "Gewonnen",          variant: "green" },
  LOST:         { label: "Verloren",          variant: "red" },
};

const quoteStatusMap: Record<string, { label: string; variant: Variant }> = {
  DRAFT:    { label: "Concept",   variant: "gray" },
  SENT:     { label: "Verzonden", variant: "blue" },
  ACCEPTED: { label: "Akkoord",   variant: "green" },
  REJECTED: { label: "Afgewezen", variant: "red" },
};

const invoiceStatusMap: Record<string, { label: string; variant: Variant }> = {
  DRAFT:           { label: "Concept",       variant: "gray" },
  SENT:            { label: "Verzonden",     variant: "blue" },
  PARTIALLY_PAID:  { label: "Deels betaald", variant: "orange" },
  PAID:            { label: "Betaald",       variant: "green" },
  OVERDUE:         { label: "Over datum",    variant: "red" },
  CREDITED:        { label: "Gecrediteerd",  variant: "purple" },
};

const poStatusMap: Record<string, { label: string; variant: Variant }> = {
  DRAFT:               { label: "Concept",          variant: "gray" },
  ORDERED:             { label: "Besteld",           variant: "blue" },
  PARTIALLY_RECEIVED:  { label: "Deels ontvangen",  variant: "orange" },
  RECEIVED:            { label: "Ontvangen",         variant: "green" },
  CLOSED:              { label: "Gesloten",          variant: "gray" },
  CANCELLED:           { label: "Geannuleerd",       variant: "red" },
};

type StatusType = "deal" | "quote" | "invoice" | "po";

interface Props {
  status: string;
  type: StatusType;
  className?: string;
}

export function StatusBadge({ status, type, className }: Props) {
  const map = type === "deal" ? dealStatusMap
    : type === "quote" ? quoteStatusMap
    : type === "invoice" ? invoiceStatusMap
    : poStatusMap;

  const { label, variant } = map[status] ?? { label: status, variant: "gray" as Variant };

  return (
    <span className={cn(
      "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
      variants[variant],
      className
    )}>
      {label}
    </span>
  );
}
