import { prisma } from "@/lib/prisma";
import { TwinfieldSettingsClient } from "./TwinfieldSettingsClient";

type InvoiceRow = {
  id: string;
  invoiceNumber: string;
  status: string;
  twinfieldSyncStatus: string;
  twinfieldLocked: boolean;
  twinfieldReference: string | null;
  updatedAt: Date;
};

async function getData() {
  const settingsRows = await prisma.$queryRaw<
    Array<{
      twinfield_access_token: string | null;
      twinfield_token_expires_at: Date | null;
      twinfield_office_code: string | null;
      twinfield_transaction_type: string | null;
      twinfield_debtor_account: string | null;
      twinfield_revenue_account: string | null;
      twinfield_vat_code: string | null;
    }>
  >`SELECT
      twinfield_access_token,
      twinfield_token_expires_at,
      twinfield_office_code,
      twinfield_transaction_type,
      twinfield_debtor_account,
      twinfield_revenue_account,
      twinfield_vat_code
    FROM company_settings WHERE id = 'singleton' LIMIT 1`;

  const settings = settingsRows[0] ?? null;

  const invoices: InvoiceRow[] = await prisma.invoice.findMany({
    select: {
      id: true,
      invoiceNumber: true,
      status: true,
      twinfieldSyncStatus: true,
      twinfieldLocked: true,
      twinfieldReference: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 10,
  });

  return { settings, invoices };
}

export default async function TwinfieldSettingsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const { settings, invoices } = await getData();

  return (
    <TwinfieldSettingsClient
      connected={!!settings?.twinfield_access_token}
      officeCode={settings?.twinfield_office_code ?? ""}
      transactionType={settings?.twinfield_transaction_type ?? "VRK"}
      debtorAccount={settings?.twinfield_debtor_account ?? "1300"}
      revenueAccount={settings?.twinfield_revenue_account ?? "8000"}
      vatCode={settings?.twinfield_vat_code ?? "VH"}
      tokenExpiresAt={settings?.twinfield_token_expires_at?.toISOString() ?? null}
      recentInvoices={invoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        status: inv.status,
        twinfieldSyncStatus: inv.twinfieldSyncStatus,
        twinfieldLocked: inv.twinfieldLocked,
        twinfieldReference: inv.twinfieldReference,
        updatedAt: inv.updatedAt.toISOString(),
      }))}
      flash={
        params.connected === "true"
          ? "success"
          : params.error
          ? params.error
          : null
      }
    />
  );
}
