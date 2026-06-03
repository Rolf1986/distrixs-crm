import { prisma } from "@/lib/prisma";

// ─── Constants ───────────────────────────────────────────────────────────────

const TF_AUTH_URL =
  "https://login.twinfield.com/auth/authentication/connect/authorize";
const TF_TOKEN_URL =
  "https://login.twinfield.com/auth/authentication/connect/token";
const CLIENT_ID = process.env.TWINFIELD_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.TWINFIELD_CLIENT_SECRET ?? "";
const REDIRECT_URI = `${
  process.env.NEXT_PUBLIC_BASE_URL ?? "https://crm.distrixs.nl"
}/api/twinfield/callback`;
const CLUSTER =
  process.env.TWINFIELD_CLUSTER ?? "accounting.twinfield.com";
const XML_ENDPOINT = `https://${CLUSTER}/webservices/processxml.asmx/ProcessXmlString`;

// ─── Types ────────────────────────────────────────────────────────────────────

export type TwinfieldSyncResult = {
  success: boolean;
  reference?: string;
  error?: string;
};

export type TwinfieldSettings = {
  officeCode: string;
  transactionType: string;
  debtorAccount: string;
  revenueAccount: string;
  vatCode: string;
};

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
};

// ─── OAuth2 helpers ───────────────────────────────────────────────────────────

export function getAuthorizationUrl(state: string): string {
  // offline_access is required for refresh tokens (valid 25 years)
  // twf.organisationUser is mandatory for login
  // Scope separator must be space (URLSearchParams encodes to +)
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    scope: "openid offline_access twf.user twf.organisation twf.organisationUser",
    state,
    nonce: state,
  });
  return `${TF_AUTH_URL}?${params.toString()}`;
}

/** Base64-encoded "client_id:client_secret" — vereist door Twinfield als Authorization header */
function basicAuthHeader(): string {
  return "Basic " + Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");
}

export async function exchangeCode(code: string): Promise<TokenResponse> {
  const res = await fetch(TF_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": basicAuthHeader(),
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
    }).toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${text}`);
  }

  return res.json() as Promise<TokenResponse>;
}

export async function refreshToken(
  refreshTokenValue: string
): Promise<TokenResponse> {
  const res = await fetch(TF_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Authorization": basicAuthHeader(),
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshTokenValue,
    }).toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed (${res.status}): ${text}`);
  }

  return res.json() as Promise<TokenResponse>;
}

export async function getValidToken(): Promise<string> {
  const settings = await prisma.$queryRaw<
    Array<{
      twinfield_access_token: string | null;
      twinfield_refresh_token: string | null;
      twinfield_token_expires_at: Date | null;
    }>
  >`SELECT twinfield_access_token, twinfield_refresh_token, twinfield_token_expires_at
    FROM company_settings WHERE id = 'singleton' LIMIT 1`;

  const row = settings[0];
  if (!row?.twinfield_access_token) {
    throw new Error("Twinfield is niet verbonden. Ga naar Instellingen → Twinfield.");
  }

  // Check if token is expired (with 60s buffer)
  const expiresAt = row.twinfield_token_expires_at;
  const isExpired =
    !expiresAt || expiresAt.getTime() - 60_000 < Date.now();

  if (isExpired) {
    if (!row.twinfield_refresh_token) {
      throw new Error(
        "Twinfield token verlopen en geen refresh token beschikbaar. Herverbinden vereist."
      );
    }

    const tokens = await refreshToken(row.twinfield_refresh_token);
    const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await prisma.$executeRaw`
      UPDATE company_settings SET
        twinfield_access_token = ${tokens.access_token},
        twinfield_refresh_token = ${tokens.refresh_token},
        twinfield_token_expires_at = ${newExpiresAt}
      WHERE id = 'singleton'
    `;

    return tokens.access_token;
  }

  return row.twinfield_access_token;
}

// ─── XML webservice ───────────────────────────────────────────────────────────

export async function callXml(
  token: string,
  officeCode: string,
  xml: string
): Promise<string> {
  const body = new URLSearchParams({
    xmlRequest: xml,
    companyCode: officeCode,
  }).toString();

  const res = await fetch(XML_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Bearer ${token}`,
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Twinfield XML call failed (${res.status}): ${text}`);
  }

  return res.text();
}

// ─── Setup discovery ──────────────────────────────────────────────────────────

export async function fetchTwinfieldSetup(
  officeCode: string
): Promise<{ transactionTypes: string[]; vatCodes: string[] }> {
  const token = await getValidToken();

  // List all activities (transaction types)
  const actXml = `<list><type>ACT</type><office>${escapeXml(officeCode)}</office></list>`;
  const actResponse = await callXml(token, officeCode, actXml);

  // Extract codes from <dimension><code>...</code><category>...</category></dimension>
  const transactionTypes: string[] = [];
  const actMatches = [...actResponse.matchAll(/<dimension>([\s\S]*?)<\/dimension>/gi)];
  for (const m of actMatches) {
    const block = m[1];
    const category = block.match(/<category>(.*?)<\/category>/i)?.[1]?.toLowerCase() ?? "";
    const code = block.match(/<code>(.*?)<\/code>/i)?.[1] ?? "";
    // Keep sales-related types: category "sales", "verkopen", "sis", etc.
    if (code && (category === "sales" || category === "sis" || category === "verkopen")) {
      transactionTypes.push(code);
    }
  }
  // If nothing matched by category, return all codes so user can pick
  if (transactionTypes.length === 0) {
    for (const m of actMatches) {
      const code = m[1].match(/<code>(.*?)<\/code>/i)?.[1] ?? "";
      if (code) transactionTypes.push(code);
    }
  }

  // List VAT codes (type VTC = btw-codes)
  const vatXml = `<list><type>VTC</type><office>${escapeXml(officeCode)}</office></list>`;
  const vatResponse = await callXml(token, officeCode, vatXml);

  const vatCodes: string[] = [];
  const vatMatches = [...vatResponse.matchAll(/<dimension>([\s\S]*?)<\/dimension>/gi)];
  for (const m of vatMatches) {
    const block = m[1];
    const code = block.match(/<code>(.*?)<\/code>/i)?.[1] ?? "";
    if (code) vatCodes.push(code);
  }

  return { transactionTypes, vatCodes };
}

// ─── Debtor helpers ───────────────────────────────────────────────────────────

export async function findOrCreateDebtor(
  token: string,
  settings: TwinfieldSettings,
  customer: {
    id: string;
    companyName: string;
    vatNumber?: string | null;
  }
): Promise<string> {
  // 1. Check if already stored in our DB
  const existing = await prisma.$queryRaw<
    Array<{ twinfield_debtor_code: string | null }>
  >`SELECT twinfield_debtor_code FROM customers WHERE id = ${customer.id} LIMIT 1`;

  const storedCode = existing[0]?.twinfield_debtor_code;
  if (storedCode) return storedCode;

  const { officeCode } = settings;

  // 2. Search Twinfield by name
  const searchXml = `<list><type>DEB</type><office>${escapeXml(officeCode)}</office><filters><filter field="name" operator="like">${escapeXml(customer.companyName)}</filter></filters></list>`;
  let foundCode: string | null = null;

  try {
    const searchResponse = await callXml(token, officeCode, searchXml);
    const debtors = [...searchResponse.matchAll(/<dimension>([\s\S]*?)<\/dimension>/gi)].map(
      (m) => m[1]
    );

    for (const debtor of debtors) {
      const code = debtor.match(/<code>(.*?)<\/code>/i)?.[1] ?? "";
      const vatno =
        debtor.match(/<vatno>(.*?)<\/vatno>/i)?.[1] ??
        debtor.match(/<vatnumber>(.*?)<\/vatnumber>/i)?.[1] ??
        "";
      const name = debtor.match(/<name>(.*?)<\/name>/i)?.[1] ?? "";

      // Match by VAT number first (most reliable)
      if (customer.vatNumber && vatno) {
        const normalizedVat = customer.vatNumber.replace(/\s/g, "").toUpperCase();
        const normalizedVatno = vatno.replace(/\s/g, "").toUpperCase();
        if (normalizedVat === normalizedVatno) {
          foundCode = code;
          break;
        }
      }

      // Match by exact company name
      if (name.trim().toLowerCase() === customer.companyName.trim().toLowerCase()) {
        foundCode = code;
        break;
      }
    }
  } catch (err) {
    console.error("[twinfield] findOrCreateDebtor search error:", err);
  }

  // 3. If not found, create a new debtor — let Twinfield auto-assign code
  if (!foundCode) {
    const createXml = `<dimensions>
  <dimension>
    <name>${escapeXml(customer.companyName)}</name>
    <type>DEB</type>
    <financials>
      <paymentcondition>30</paymentcondition>
    </financials>
  </dimension>
</dimensions>`;

    const createResponse = await callXml(token, officeCode, createXml);

    if (createResponse.includes("<msgtype>error</msgtype>")) {
      const msg = createResponse.match(/<msg>(.*?)<\/msg>/i)?.[1] ?? createResponse;
      throw new Error(`Twinfield debtor create failed: ${msg}`);
    }

    // Parse auto-assigned code from response
    foundCode =
      createResponse.match(/<code>(.*?)<\/code>/i)?.[1] ?? null;

    if (!foundCode) {
      throw new Error("Twinfield returned no debtor code after creation");
    }
  }

  // 4. Save to our DB
  await prisma.$executeRaw`
    UPDATE customers SET twinfield_debtor_code = ${foundCode} WHERE id = ${customer.id}
  `;

  return foundCode;
}

// ─── Invoice sync ─────────────────────────────────────────────────────────────

export async function syncInvoiceToTwinfield(
  invoiceId: string
): Promise<TwinfieldSyncResult> {
  try {
    // 1. Get invoice with customer and lines
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        customer: true,
        lines: { orderBy: { createdAt: "asc" } },
        deal: { select: { dealNumber: true } },
      },
    });

    if (!invoice) {
      return { success: false, error: "Factuur niet gevonden" };
    }

    // 2. Get valid OAuth token
    const token = await getValidToken();

    // 3. Get all Twinfield settings
    const settingsRows = await prisma.$queryRaw<
      Array<{
        twinfield_office_code: string | null;
        twinfield_transaction_type: string | null;
        twinfield_debtor_account: string | null;
        twinfield_revenue_account: string | null;
        twinfield_vat_code: string | null;
      }>
    >`SELECT
        twinfield_office_code,
        twinfield_transaction_type,
        twinfield_debtor_account,
        twinfield_revenue_account,
        twinfield_vat_code
      FROM company_settings WHERE id = 'singleton' LIMIT 1`;

    const row = settingsRows[0];

    if (!row?.twinfield_office_code) {
      throw new Error(
        "Twinfield office code niet ingesteld. Ga naar Instellingen → Twinfield."
      );
    }

    const tfSettings: TwinfieldSettings = {
      officeCode: row.twinfield_office_code,
      transactionType: row.twinfield_transaction_type ?? "VRK",
      debtorAccount: row.twinfield_debtor_account ?? "1300",
      revenueAccount: row.twinfield_revenue_account ?? "8000",
      vatCode: row.twinfield_vat_code ?? "VH",
    };

    // 4. Find or create debtor
    const customerCode = await findOrCreateDebtor(token, tfSettings, {
      id: invoice.customer.id,
      companyName: invoice.customer.companyName,
      vatNumber: invoice.customer.vatNumber,
    });

    // 5. Build transaction XML
    const invoiceDate = formatTwinfieldDate(invoice.invoiceDate);
    const period = formatTwinfieldPeriod(invoice.invoiceDate);
    const total = Number(invoice.total).toFixed(2);

    // Build detail lines for each invoice line
    const detailLines = invoice.lines
      .map((line, i) => {
        const netValue = Number(line.netLineTotal).toFixed(2);
        const desc = (line.titleSnapshot ?? "").slice(0, 40);
        return `      <line type="detail" id="${2 + i}">
        <dim1>${escapeXml(tfSettings.revenueAccount)}</dim1>
        <value>${netValue}</value>
        <vatcode>${escapeXml(tfSettings.vatCode)}</vatcode>
        <description>${escapeXml(desc)}</description>
      </line>`;
      })
      .join("\n");

    const transactionXml = `<transactions>
  <transaction destiny="final" autobalancevat="true" raisewarning="false">
    <header>
      <office>${escapeXml(tfSettings.officeCode)}</office>
      <code>${escapeXml(tfSettings.transactionType)}</code>
      <currency>EUR</currency>
      <date>${invoiceDate}</date>
      <period>${period}</period>
      <invoicenumber>${escapeXml(invoice.invoiceNumber)}</invoicenumber>
      <description>${escapeXml(invoice.invoiceNumber)}</description>
    </header>
    <lines>
      <line type="total" id="1">
        <dim1>${escapeXml(tfSettings.debtorAccount)}</dim1>
        <dim2>${escapeXml(customerCode)}</dim2>
        <value>${total}</value>
        <description>${escapeXml(invoice.invoiceNumber)}</description>
      </line>
${detailLines}
    </lines>
  </transaction>
</transactions>`;

    // 6. POST to Twinfield
    const response = await callXml(token, tfSettings.officeCode, transactionXml);

    if (response.includes("<msgtype>error</msgtype>")) {
      const msg = response.match(/<msg>(.*?)<\/msg>/i)?.[1] ?? "Onbekende fout";
      throw new Error(`Twinfield transactie mislukt: ${msg}`);
    }

    // 7. Parse transaction reference from response
    const reference =
      response.match(/<number>(.*?)<\/number>/i)?.[1] ??
      response.match(/<transaction[^>]*\s+number="([^"]+)"/i)?.[1] ??
      invoice.invoiceNumber;

    // 8. Update invoice status
    await prisma.$executeRaw`
      UPDATE invoices SET
        twinfield_sync_status = 'SYNCED',
        twinfield_locked = true,
        twinfield_reference = ${reference}
      WHERE id = ${invoiceId}
    `;

    return { success: true, reference };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    console.error("[twinfield] syncInvoiceToTwinfield error:", error);

    await prisma.$executeRaw`
      UPDATE invoices SET twinfield_sync_status = 'ERROR' WHERE id = ${invoiceId}
    `.catch((e) => console.error("[twinfield] Failed to update sync status:", e));

    return { success: false, error };
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function formatTwinfieldDate(date: Date): string {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function formatTwinfieldPeriod(date: Date): string {
  const d = new Date(date);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}/${m}`;
}
