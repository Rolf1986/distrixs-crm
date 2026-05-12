import Link from "next/link";

export default async function RmaBedanktPage({
  searchParams,
}: {
  searchParams: Promise<{ nr?: string }>;
}) {
  const { nr } = await searchParams;

  return (
    <div className="text-center py-12">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Retourverzoek ontvangen</h1>
      {nr && (
        <p className="text-slate-500 mb-1 text-sm">
          Je RMA-nummer is:{" "}
          <span className="font-mono font-semibold text-slate-900">{nr}</span>
        </p>
      )}
      <p className="text-slate-500 text-sm mb-8">
        We hebben je verzoek ontvangen en nemen zo snel mogelijk contact met je op.
      </p>
      <Link
        href="/retour"
        className="text-sm text-blue-600 hover:text-brand-blue-dark underline underline-offset-2"
      >
        Nog een retourverzoek indienen
      </Link>
    </div>
  );
}
