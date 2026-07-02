// Simpele conversie-funnel (server-side, geen dependency). Elke stap toont het
// aantal + de conversie t.o.v. de vorige stap; de balk is geschaald op stap 1.

export type FunnelStep = { label: string; value: number };

export function FunnelBar({ steps }: { steps: FunnelStep[] }) {
  const top = Math.max(1, steps[0]?.value ?? 1);
  return (
    <div className="space-y-3.5">
      {steps.map((s, i) => {
        const widthPct = Math.round((s.value / top) * 100);
        const prev = i > 0 ? steps[i - 1].value : null;
        const conv = prev && prev > 0 ? Math.round((s.value / prev) * 100) : null;
        return (
          <div key={s.label}>
            <div className="flex items-baseline justify-between text-sm mb-1">
              <span className="text-slate-600">{s.label}</span>
              <span className="font-medium text-slate-900">
                {s.value.toLocaleString("nl-NL")}
                {conv !== null && (
                  <span className="ml-1.5 text-xs font-normal text-slate-400">{conv}% →</span>
                )}
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${Math.max(2, widthPct)}%`, backgroundColor: "#0170B9" }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
