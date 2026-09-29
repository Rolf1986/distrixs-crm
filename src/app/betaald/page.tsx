// Publieke bedankpagina na een Mollie-betaling: klanten hebben geen CRM-login,
// dus deze pagina staat bewust buiten de auth (zie src/proxy.ts).
export const dynamic = "force-static";

export default function BetaaldPage() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100">
          <svg viewBox="0 0 24 24" className="h-7 w-7 text-green-600" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-xl font-semibold text-slate-900">Bedankt voor uw betaling</h1>
        <p className="mt-2 text-sm text-slate-500">
          Uw betaling wordt verwerkt. Zodra deze is bevestigd, ontvangt u geen verdere
          herinneringen meer voor deze factuur.
        </p>
        <p className="mt-6 text-xs text-slate-400">
          Vragen? Mail ons op{" "}
          <a href="mailto:info@distrixs.nl" className="text-blue-600 hover:underline">info@distrixs.nl</a>
          {" "}&middot; Distrixs B.V.
        </p>
      </div>
    </div>
  );
}
