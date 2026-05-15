import Link from "next/link";

const T = {
  nl: {
    title: "Retourverzoek ontvangen",
    rmaLabel: "Je RMA-nummer is:",
    message: "We hebben je verzoek ontvangen en nemen zo snel mogelijk contact met je op.",
    another: "Nog een retourverzoek indienen",
    keepRef: "Bewaar dit nummer voor je administratie.",
  },
  en: {
    title: "Return Request Received",
    rmaLabel: "Your RMA number is:",
    message: "We have received your request and will contact you as soon as possible.",
    another: "Submit another return request",
    keepRef: "Please keep this number for your records.",
  },
};

export default async function RmaBedanktPage({
  searchParams,
}: {
  searchParams: Promise<{ nr?: string; lang?: string }>;
}) {
  const { nr, lang } = await searchParams;
  const tx = T[(lang === "en" ? "en" : "nl") as keyof typeof T];

  return (
    <div className="text-center py-12">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
        <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <h1 className="text-2xl font-bold text-slate-900 mb-2">{tx.title}</h1>

      {nr && (
        <div className="inline-block bg-slate-100 border border-slate-200 rounded-xl px-6 py-4 my-4">
          <p className="text-xs text-slate-500 mb-1">{tx.rmaLabel}</p>
          <p className="font-mono text-2xl font-bold text-slate-900 tracking-wider">{nr}</p>
          <p className="text-xs text-slate-400 mt-2">{tx.keepRef}</p>
        </div>
      )}

      <p className="text-slate-500 text-sm mb-8 max-w-sm mx-auto">{tx.message}</p>

      <Link
        href={`/retour${lang === "en" ? "?lang=en" : ""}`}
        className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 underline underline-offset-2"
      >
        {tx.another}
      </Link>
    </div>
  );
}
