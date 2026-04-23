"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Handshake,
  FileText,
  Receipt,
  Users,
  ShoppingCart,
  CalendarCheck,
  FolderOpen,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Deals", href: "/deals", icon: Handshake },
  { label: "Offertes", href: "/quotes", icon: FileText },
  { label: "Facturen", href: "/invoices", icon: Receipt },
  { label: "Klanten", href: "/customers", icon: Users },
  { label: "Inkoop", href: "/purchase-orders", icon: ShoppingCart },
  { label: "Activiteiten", href: "/activities", icon: CalendarCheck },
  { label: "Bestanden", href: "/files", icon: FolderOpen },
];

const bottom = [
  { label: "Instellingen", href: "/settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <aside className="fixed inset-y-0 left-0 w-56 bg-slate-900 flex flex-col z-30">
      <div className="h-16 flex items-center px-5 border-b border-slate-800">
        <span className="text-white font-semibold text-base tracking-tight">Distrixs CRM</span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {nav.map(({ label, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              isActive(href)
                ? "bg-blue-600 text-white"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            )}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="px-3 pb-4 border-t border-slate-800 pt-3 space-y-0.5">
        {bottom.map(({ label, href, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              isActive(href)
                ? "bg-slate-700 text-white"
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            )}
          >
            <Icon className="w-4 h-4 shrink-0" />
            {label}
          </Link>
        ))}
      </div>
    </aside>
  );
}
