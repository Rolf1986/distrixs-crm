"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div className="min-h-screen bg-slate-50 flex items-center justify-center" style={{ fontFamily: "sans-serif" }}>
          <div className="text-center max-w-sm">
            <div className="flex flex-col gap-[3px] items-center mb-6">
              <div className="w-8 h-[4px] rounded-full" style={{ backgroundColor: "#ff6600" }} />
              <div className="w-6 h-[4px] rounded-full" style={{ backgroundColor: "#ff6600", opacity: 0.7 }} />
              <div className="w-4 h-[4px] rounded-full" style={{ backgroundColor: "#ff6600", opacity: 0.4 }} />
            </div>
            <h1 className="text-2xl font-bold text-slate-800 mb-2">Er is iets misgegaan</h1>
            <p className="text-sm text-slate-500 mb-6">
              Er is een onverwachte fout opgetreden. Probeer het opnieuw.
              {error.digest && (
                <span className="block mt-1 font-mono text-xs text-slate-400">
                  Ref: {error.digest}
                </span>
              )}
            </p>
            <button
              onClick={reset}
              className="px-4 py-2.5 rounded-lg text-sm font-medium text-white transition-colors"
              style={{ backgroundColor: "#0170B9" }}
            >
              Opnieuw proberen
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
