// Twinfield integration — placeholder for future implementation
// Will be activated once the CRM is feature-complete.
//
// Required when implementing:
// - OAuth2 flow to Twinfield API
// - Invoice sync (POST to Twinfield sales entries)
// - Sync status webhook/polling
// - Lock invoice after successful sync

export type TwinfieldSyncResult = {
  success: boolean;
  reference?: string;
  error?: string;
};

export async function syncInvoiceToTwinfield(
  _invoiceId: string
): Promise<TwinfieldSyncResult> {
  throw new Error("Twinfield integration not yet implemented");
}
