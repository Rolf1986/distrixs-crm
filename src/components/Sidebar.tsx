"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Handshake,
  FileText,
  Receipt,
  Users,
  ShoppingCart,
  Calendar,
  FolderOpen,
  Settings,
  RotateCcw,
  Package,
  Truck,
  BarChart2,
  Mail,
  FileInput,
  UserPlus,
  RefreshCw,
  Navigation,
  Activity,
  LogOut,
  Send,
  Menu,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GlobalSearch } from "@/components/GlobalSearch";

const navGroups: Array<{ title: string | null; items: Array<{ label: string; href: string; icon: typeof LayoutDashboard }> }> = [
  {
    title: null,
    items: [
      { label: "Dashboard",      href: "/dashboard",       icon: LayoutDashboard },
    ],
  },
  {
    title: "Verkoop",
    items: [
      { label: "Deals",          href: "/deals",            icon: Handshake },
      { label: "Leads",          href: "/leads",            icon: UserPlus },
      { label: "Offertes",       href: "/quotes",           icon: FileText },
      { label: "Facturen",       href: "/invoices",         icon: Receipt },
      { label: "Terugkerend",    href: "/recurring-invoices", icon: RefreshCw },
    ],
  },
  {
    title: "Relaties & catalogus",
    items: [
      { label: "Klanten",        href: "/customers",        icon: Users },
      { label: "Producten",      href: "/products",         icon: Package },
      { label: "Leveranciers",   href: "/suppliers",        icon: Truck },
    ],
  },
  {
    title: "Inkoop & logistiek",
    items: [
      { label: "Inkooporders",   href: "/purchase-orders",  icon: ShoppingCart },
      { label: "Inkoopfacturen", href: "/purchase-invoices", icon: FileInput },
      { label: "Zendingen",      href: "/shipments",         icon: Navigation },
      { label: "RMA",            href: "/rma",              icon: RotateCcw },
    ],
  },
  {
    title: "Werk & inzicht",
    items: [
      { label: "E-mails",        href: "/emails",           icon: Mail },
      { label: "Verzonden mail", href: "/sent-emails",      icon: Send },
      { label: "Activiteiten",   href: "/activities",       icon: Calendar },
      { label: "Bestanden",      href: "/files",            icon: FolderOpen },
      { label: "Rapportages",    href: "/reports",          icon: BarChart2 },
      { label: "Analytics",      href: "/analytics",        icon: Activity },
    ],
  },
  {
    title: null,
    items: [
      { label: "Instellingen",   href: "/settings",         icon: Settings },
    ],
  },
];

export function Sidebar({ overdueActivityCount = 0 }: { overdueActivityCount?: number }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Sluit het mobiele menu bij navigatie
  useEffect(() => { setOpen(false); }, [pathname]);

  return (
    <>
      {/* Mobiele topbalk met hamburger (alleen < md) */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-14 z-40 flex items-center gap-3 px-4 border-b border-white/10" style={{ backgroundColor: "#2a2a2a" }}>
        <button onClick={() => setOpen(true)} aria-label="Menu openen" className="text-white/80 hover:text-white">
          <Menu className="w-6 h-6" />
        </button>
        <img src="/logo.png" alt="Distrixs" className="h-6 w-auto" style={{ filter: "brightness(0) invert(1)" }} />
      </div>

      {/* Achtergrond-overlay bij open mobiel menu */}
      {open && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setOpen(false)} />
      )}

      <aside
        className={cn(
          "fixed left-0 top-0 h-screen w-56 flex flex-col z-50 transition-transform duration-200 md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
        style={{ backgroundColor: "#2a2a2a" }}
      >
        {/* Sluitknop (alleen mobiel) */}
        <button
          onClick={() => setOpen(false)}
          aria-label="Menu sluiten"
          className="md:hidden absolute top-3 right-3 text-white/60 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
      {/* Logo / branding */}
      <div className="px-5 py-4 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        <img
          src="/logo.png"
          alt="Distrixs"
          className="h-8 w-auto"
          style={{ filter: "brightness(0) invert(1)" }}
        />
      </div>

      {/* Search */}
      <div className="px-3 py-2.5 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        <GlobalSearch />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2.5 py-3 overflow-y-auto">
        {navGroups.map((group, gi) => (
          <div key={group.title ?? `group-${gi}`} className={gi > 0 ? "mt-4" : undefined}>
            {group.title && (
              <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-white/25">
                {group.title}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active =
                  item.href === "/deals"
                    ? pathname === "/deals" || pathname.startsWith("/deals/")
                    : item.href === "/quotes"
                    ? pathname === "/quotes" || pathname.startsWith("/quotes/")
                    : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "relative flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150",
                      active
                        ? "bg-brand-blue text-white shadow-lg shadow-brand-blue/25"
                        : "text-white/50 hover:text-white hover:bg-white/[0.06] hover:translate-x-0.5"
                    )}
                  >
                    <Icon className={cn("w-4 h-4 shrink-0", active ? "text-white" : "text-white/40")} />
                    <span className="flex-1">{item.label}</span>
                    {item.href === "/activities" && overdueActivityCount > 0 && (
                      <span className="ml-auto bg-red-500 text-white text-xs font-semibold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 leading-none shadow-sm">
                        {overdueActivityCount > 99 ? "99+" : overdueActivityCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
        <button
          onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            window.location.href = "/login";
          }}
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium w-full text-white/50 hover:text-white/80 hover:bg-white/5 transition-all"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span>Uitloggen</span>
        </button>
        <p className="text-xs px-3 mt-1" style={{ color: "rgba(255,255,255,0.2)" }}>Distrixs · v0.1</p>
      </div>
      </aside>
    </>
  );
}
