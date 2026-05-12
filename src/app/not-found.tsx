import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <div className="flex flex-col gap-[3px] items-center mb-6">
          <div className="w-8 h-[4px] rounded-full" style={{ backgroundColor: "#ff6600" }} />
          <div className="w-6 h-[4px] rounded-full" style={{ backgroundColor: "#ff6600", opacity: 0.7 }} />
          <div className="w-4 h-[4px] rounded-full" style={{ backgroundColor: "#ff6600", opacity: 0.4 }} />
        </div>
        <h1 className="text-6xl font-bold text-slate-200 mb-2">404</h1>
        <p className="text-slate-600 font-medium mb-1">Pagina niet gevonden</p>
        <p className="text-sm text-slate-400 mb-6">De pagina die je zoekt bestaat niet of is verplaatst.</p>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-colors"
          style={{ backgroundColor: "#0170B9" }}
        >
          Naar dashboard
        </Link>
      </div>
    </div>
  );
}
