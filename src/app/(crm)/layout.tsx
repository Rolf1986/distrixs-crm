import { Sidebar } from "@/components/Sidebar";

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar />
      <div className="pl-56">
        <main className="min-h-screen">{children}</main>
      </div>
    </div>
  );
}
