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

type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
};

// ─── OAuth2 helpers ───────────────────────────────────────────────────────────

export function getAuthorizationUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    scope: "openid twf.user twf.organisation twf.organisationUser",
    state,
    nonce: state, // Twinfield vereist nonce voor OpenID Connect
  });
  return `${TF_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCode(code: string): Promise<TokenResponse> {
  const res = await fetch(TF_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
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
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshTokenValue,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
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

export async function callXml(token: string, xml: string): Promise<string> {
  const res = await fetch(XML_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Bearer ${token}`,
    },
    body: new URLSearchParams({ xmlRequest: xml }).toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Twinfield XML call failed (${res.status}): ${text}`);
  }

  return res.text();
}

// ─── Debtor helpers ───────────────────────────────────────────────────────────

export async function findDebtor(
  token: string,
  officeCode: string,
  vatNumber?: string | null,
  companyName?: string
): Promise<string | null> {
  const xml = `<list><type>DEB</type><office>${officeCode}</office></list>`;

  try {
    const response = await callXml(token, xml);
    // Parse debtors from XML response
    // Expected response: <dimension><code>...</code><name>...</name><vatno>...</vatno></dimension> per debtor
    const debtors = [...response.matchAll(/<dimension>([\s\S]*?)<\/dimension>/gi)].map(
      (m) => m[1]
    );

    for (const debtor of debtors) {
      const code = debtor.match(/<code>(.*?)<\/code>/i)?.[1] ?? "";
      const vatno =
        debtor.match(/<vatno>(.*?)<\/vatno>/i)?.[1] ??
        debtor.match(/<vatnumber>(.*?)<\/vatnumber>/i)?.[1] ??
        "";
      const name = debtor.match(/<name>(.*?)<\/name>/i)?.[1] ?? "";

      if (vatNumber && vatno) {
        const normalizedVat = vatNumber.replace(/\s/g, "").toUpperCase();
        const normalizedVatno = vatno.replace(/\s/g, "").toUpperCase();
        if (normalizedVat === normalizedVatno) return code;
      }

      if (companyName) {
        const normalizedName = companyName.trim().toLowerCase();
        const normalizedDbName = name.trim().toLowerCase();
        if (normalizedName === normalizedDbName) return code;
      }
    }
  } catch (err) {
    console.error("[twinfield] findDebtor error:", err);
  }

  return null;
}

function generateDebtorCode(companyName: string): string {
  return companyName
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6)
    .padEnd(3, "X");
}

export async function createDebtor(
  token: string,
  officeCode: string,
  customer: {
    companyName: string;
    vatNumber?: string | null;
    email?: string | null;
    phone?: string | null;
  }
): Promise<string> {
  const baseCode = generateDebtorCode(customer.companyName);

  // Try base code first, then with numeric suffix
  let debtorCode = baseCode;
  for (let i = 1; i <= 99; i++) {
    const xml = `<read><type>DEB</type><office>${officeCode}</office><code>${debtorCode}</code></read>`;
    try {
      const checkRes = await callXml(token, xml);
      if (checkRes.includes("<msgtype>error</msgtype>")) {
        // Code doesn't exist, use it
        break;
      }
    } catch {
      break;
    }
    debtorCode = `${baseCode.slice(0, 4)}${i.toString().padStart(2, "0")}`;
  }

  const vatLine = customer.vatNumber
    ? `<vatno>${escapeXml(customer.vatNumber)}</vatno>`
    : "";

  const xml = `<dimension>
  <office>${escapeXml(officeCode)}</office>
  <type>DEB</type>
  <code>${escapeXml(debtorCode)}</code>
  <name>${escapeXml(customer.companyName)}</name>
  ${vatLine}
  <financials>
    <paymentcondition>30</paymentcondition>
    <vatcode>VH</vatcode>
    <ebilling>false</ebilling>
  </financials>
</dimension>`;

  const response = await callXml(token, xml);

  if (response.includes("<msgtype>error</msgtype>")) {
    const msg = response.match(/<msg>(.*?)<\/msg>/i)?.[1] ?? response;
    throw new Error(`Twinfield debtor create failed: ${msg}`);
  }

  return debtorCode;
}

// ─── Invoice sync ─────────────────────────────────────────────────────────────

export async function syncInvoiceToTwinfield(
  invoiceId: string
): Promise<TwinfieldSyncResult> {
  try {
    // 1. Get invoice
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

    // 3. Get office code
    const settingsRows = await prisma.$queryRaw<
      Array<{ twinfield_office_code: string | null }>
    >`SELECT twinfield_office_code FROM company_settings WHERE id = 'singleton' LIMIT 1`;
    const officeCode = settingsRows[0]?.twinfield_office_code;

    if (!officeCode) {
      throw new Error(
        "Twinfield office code niet ingesteld. Ga naar Instellingen → Twinfield."
      );
    }

    // 4. Find or create debtor
    let debtorCode = await findDebtor(
      token,
      officeCode,
      invoice.customer.vatNumber,
      invoice.customer.companyName
    );

    if (!debtorCode) {
      debtorCode = await createDebtor(token, officeCode, {
        companyName: invoice.customer.companyName,
        vatNumber: invoice.customer.vatNumber,
      });
    }

    // 5. Build transaction XML
    const invoiceDate = formatTwinfieldDate(invoice.invoiceDate);
    const dueDate = formatTwinfieldDate(invoice.dueDate);
    const period = formatTwinfieldPeriod(invoice.invoiceDate);

    const subtotal = Number(invoice.subtotal).toFixed(2);
    const vatAmount = Number(invoice.vatAmount).toFixed(2);
    const total = Number(invoice.total).toFixed(2);

    const description = invoice.lines
      .map((l) => l.titleSnapshot)
      .join(", ")
      .slice(0, 40);

    const transactionXml = `<transaction>
  <header>
    <office>${escapeXml(officeCode)}</office>
    <code>VRK</code>
    <currency>EUR</currency>
    <date>${invoiceDate}</date>
    <period>${period}</period>
    <invoicenumber>${escapeXml(invoice.invoiceNumber)}</invoicenumber>
    <due>${dueDate}</due>
  </header>
  <lines>
    <line type="total">
      <dim1>1300</dim1>
      <dim2>${escapeXml(debtorCode)}</dim2>
      <value>${total}</value>
      <description>${escapeXml(invoice.invoiceNumber)}</description>
      <matchlevel>2</matchlevel>
    </line>
    <line type="detail">
      <dim1>8000</dim1>
      <value>${subtotal}</value>
      <vatcode>VH</vatcode>
      <vatvalue>${vatAmount}</vatvalue>
      <description>${escapeXml(description)}</description>
    </line>
  </lines>
</transaction>`;

    // 6. Call Twinfield
    const response = await callXml(token, transactionXml);

    if (response.includes("<msgtype>error</msgtype>")) {
      const msg = response.match(/<msg>(.*?)<\/msg>/i)?.[1] ?? "Onbekende fout";
      throw new Error(`Twinfield transactie mislukt: ${msg}`);
    }

    // 7. Parse reference from response
    const reference =
      response.match(/<number>(.*?)<\/number>/i)?.[1] ??
      response.match(/<transaction[^>]*\s+number="([^"]+)"/i)?.[1] ??
      invoice.invoiceNumber;

    // 8. Update invoice
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
