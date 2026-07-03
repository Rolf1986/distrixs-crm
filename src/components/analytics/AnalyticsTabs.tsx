"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { label: "Overzicht", href: "/analytics" },
  { label: "Bezoekers", href: "/analytics/bezoekers" },
  { label: "Klanten", href: "/analytics/klanten" },
];

export function AnalyticsTabs() {
  const pathname = usePathname();
  return (
    <div className="flex items-center gap-1 border-b border-slate-200">
      {tabs.map((t) => {
        const active =
          t.href === "/analytics" ? pathname === "/analytics" : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className="px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors"
            style={
              active
                ? { borderColor: "#0170B9", color: "#0170B9" }
                : { borderColor: "transparent", color: "#64748b" }
            }
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
