import { TabNav } from "@/components/TabNav";
import { PageHeader } from "@/components/ui/PageHeader";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-200">
        <div className="px-8 pt-6 pb-0">
          <h1 className="text-xl font-semibold text-slate-900 mb-4">Instellingen</h1>
          <TabNav tabs={[
            { label: "Bedrijf",         href: "/settings",                 exact: true },
            { label: "Gebruikers",      href: "/settings/users" },
            { label: "E-mailtemplates", href: "/settings/email" },
            { label: "E-mailboxen",     href: "/settings/email-accounts" },
            { label: "Import",          href: "/settings/import" },
            { label: "Twinfield",       href: "/settings/twinfield" },
          ]} />
        </div>
      </div>
      <div className="px-8 py-6">{children}</div>
    </div>
  );
}
