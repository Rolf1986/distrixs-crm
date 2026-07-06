import { prisma } from "@/lib/prisma";
import { PaymentSettingsClient } from "./PaymentSettingsClient";

export const dynamic = "force-dynamic";

export default async function PaymentSettingsPage() {
  const settings = await prisma.companySetting.findUnique({
    where: { id: "singleton" },
    select: { mollieApiKey: true },
  });

  const key = settings?.mollieApiKey?.trim() || process.env.MOLLIE_API_KEY?.trim() || null;
  const keyConfigured = !!key;
  const keyMode: "live" | "test" | null = key
    ? key.startsWith("live_") ? "live" : "test"
    : null;
  // Alleen een hint tonen, nooit de volledige key
  const keyHint = key ? `${key.slice(0, 5)}…${key.slice(-4)}` : null;

  return (
    <PaymentSettingsClient
      keyConfigured={keyConfigured}
      keyMode={keyMode}
      keyHint={keyHint}
    />
  );
}
