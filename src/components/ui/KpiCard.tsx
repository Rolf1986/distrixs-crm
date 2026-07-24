interface KpiCardProps {
  label: string;
  value: string | number;
  sub?: string;
  highlight?: boolean;
}

export function KpiCard({ label, value, sub, highlight }: KpiCardProps) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
        {label}
      </p>
      <p className={`text-lg font-semibold break-words ${highlight ? "text-green-700" : "text-slate-900"}`}>
        {value}
      </p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}
