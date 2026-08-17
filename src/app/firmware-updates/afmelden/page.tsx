export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";
import { UnsubscribeClient } from "./UnsubscribeClient";

export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  const registration = token
    ? await prisma.firmwareRegistration.findUnique({
        where: { token },
        select: { status: true, firmwareProduct: { select: { name: true, model: true } } },
      })
    : null;

  if (!registration) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
        <h2 className="text-lg font-semibold text-slate-900 mb-2">Link niet geldig</h2>
        <p className="text-sm text-slate-600">
          Deze afmeldlink werkt niet (meer). Mail ons gerust op{" "}
          <a href="mailto:info@distrixs.nl" className="text-blue-600">
            info@distrixs.nl
          </a>{" "}
          en we regelen het handmatig.
        </p>
      </div>
    );
  }

  const fp = registration.firmwareProduct;
  const label = fp.model && fp.model !== fp.name ? `${fp.name} (${fp.model})` : fp.name;

  if (registration.status === "UNSUBSCRIBED") {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
        <h2 className="text-lg font-semibold text-slate-900 mb-2">Je bent al afgemeld</h2>
        <p className="text-sm text-slate-600">Je ontvangt geen firmware-updates meer voor {label}.</p>
      </div>
    );
  }

  return <UnsubscribeClient token={token!} productLabel={label} />;
}
