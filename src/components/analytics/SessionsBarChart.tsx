// Sessies-per-dag staafdiagram (server-side SVG, geen chart-library).
// De campagne-toe te schrijven sessies worden in merkblauw gemarkeerd, de rest in
// grijs — zo zie je in één oogopslag of een mailing/social-post een piek gaf.

export type SessionsPoint = {
  day: string; // ISO yyyy-mm-dd
  label: string; // bijv. "28/6"
  sessions: number;
  campaignSessions: number;
};

function niceCeil(v: number): number {
  if (v <= 5) return 5;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

const BLUE = "#0170B9";
const SLATE = "#cbd5e1"; // slate-300

export function SessionsBarChart({ data }: { data: SessionsPoint[] }) {
  const W = 960;
  const H = 260;
  const padL = 34;
  const padR = 12;
  const padT = 14;
  const padB = 26;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;

  const maxSessions = Math.max(1, ...data.map((d) => d.sessions));
  const yMax = niceCeil(maxSessions);
  const n = Math.max(1, data.length);
  const slot = innerW / n;
  const barW = Math.max(1, slot - (n > 45 ? 1 : n > 20 ? 3 : 8));

  const yOf = (v: number) => padT + innerH - (v / yMax) * innerH;
  const labelStep = Math.ceil(n / 8);

  const gridVals = [0, yMax / 2, yMax];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Sessies per dag">
      {/* gridlijnen + y-labels */}
      {gridVals.map((v, i) => (
        <g key={i}>
          <line x1={padL} x2={W - padR} y1={yOf(v)} y2={yOf(v)} stroke="#f1f5f9" strokeWidth={1} />
          <text x={padL - 6} y={yOf(v) + 3} textAnchor="end" fontSize={10} fill="#94a3b8">
            {Math.round(v)}
          </text>
        </g>
      ))}

      {/* staven */}
      {data.map((d, i) => {
        const x = padL + i * slot + (slot - barW) / 2;
        const other = Math.max(0, d.sessions - d.campaignSessions);
        const campH = (d.campaignSessions / yMax) * innerH;
        const otherH = (other / yMax) * innerH;
        const baseY = padT + innerH;
        const title = `${d.label} — ${d.sessions} sessie${d.sessions === 1 ? "" : "s"}${
          d.campaignSessions > 0 ? ` (${d.campaignSessions} via campagne)` : ""
        }`;
        return (
          <g key={d.day}>
            <title>{title}</title>
            {/* onzichtbare hover-zone voor de hele kolom */}
            <rect x={padL + i * slot} y={padT} width={slot} height={innerH} fill="transparent" />
            {other > 0 && (
              <rect x={x} y={baseY - campH - otherH} width={barW} height={otherH} fill={SLATE} rx={1} />
            )}
            {d.campaignSessions > 0 && (
              <rect x={x} y={baseY - campH} width={barW} height={campH} fill={BLUE} rx={1} />
            )}
            {/* x-label */}
            {i % labelStep === 0 && (
              <text x={x + barW / 2} y={H - 8} textAnchor="middle" fontSize={10} fill="#94a3b8">
                {d.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
