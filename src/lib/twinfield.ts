import { prisma } from "@/lib/prisma";

// ─── Constants ───────────────────────────────────────────────────────────────

const TF_AUTH_URL =
  "https://login.twinfield.com/auth/authentication/connect/authorize";
const TF_TOKEN_URL =
  "https://login.twinfield.com/auth/authentication/connect/token";
const TF_VALIDATE_URL =
  "https://login.twinfield.com/auth/authentication/connect/accesstokenvalidation";
const CLIENT_ID = process.env.TWINFIELD_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.TWINFIELD_CLIENT_SECRET ?? "";
const REDIRECT_URI = `${
  process.env.NEXT_PUBLIC_BASE_URL ?? "https://crm.distrixs.nl"
}/api/twinfield/callback`;

// ─── EU-landen (ISO 3166-1 alpha-2, excl. NL) ────────────────────────────────
const EU_COUNTRIES = new Set([
  "AT", "BE", "BG", "CY", "CZ", "DE", "DK", "EE", "ES", "FI",
  "FR", "GR", "HR", "HU", "IE", "IT", "LT", "LU", "LV", "MT",
  "PL", "PT", "RO", "SE", "SI", "SK",
]);

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
  cluster: string;
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

/**
 * Haal cluster URL op via token validation endpoint en sla op in DB.
 * Geeft de cluster-hostname terug (bv. "accounting.twinfield.com").
 */
export async function fetchAndStoreCluster(accessToken: string): Promise<string> {
  const defaultCluster = process.env.TWINFIELD_CLUSTER ?? "accounting.twinfield.com";

  try {
    // De cluster URL zit in de JWT payload als "twf.clusterUrl"
    // JWT = base64(header).base64(payload).base64(signature)
    const payloadBase64 = accessToken.split(".")[1];
    if (!payloadBase64) throw new Error("Invalid JWT");

    const payload = JSON.parse(
      Buffer.from(payloadBase64, "base64url").toString("utf-8")
    ) as Record<string, unknown>;

    const clusterUrl = (payload["twf.clusterUrl"] as string | undefined) ?? "";
    const cluster = clusterUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");

    console.log(`[twinfield] Cluster uit JWT: "${cluster}"`);

    if (cluster) {
      await prisma.$executeRaw`
        UPDATE company_settings SET twinfield_cluster = ${cluster} WHERE id = 'singleton'
      `;
      return cluster;
    }
  } catch (err) {
    console.warn("[twinfield] Cluster uit JWT lezen mislukt:", err);
  }

  return defaultCluster;
}

async function getCluster(): Promise<string> {
  try {
    const rows = await prisma.$queryRaw<Array<{ twinfield_cluster: string | null }>>`
      SELECT twinfield_cluster FROM company_settings WHERE id = 'singleton' LIMIT 1
    `;
    return (
      rows[0]?.twinfield_cluster ??
      process.env.TWINFIELD_CLUSTER ??
      "accounting.twinfield.com"
    );
  } catch {
    return process.env.TWINFIELD_CLUSTER ?? "accounting.twinfield.com";
  }
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

  const expiresAt = row.twinfield_token_expires_at;
  const isExpired = !expiresAt || expiresAt.getTime() - 60_000 < Date.now();

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

/**
 * POST XML naar Twinfield webservice.
 * - Handelt HTTP 429 af met één retry na de retry-after wachttijd.
 * - Controleert result="0" in de XML-response en gooit een duidelijke fout.
 */
export async function callXml(
  token: string,
  officeCode: string,
  xml: string,
  cluster?: string
): Promise<string> {
  const clusterHost = cluster ?? await getCluster();
  // SOAP endpoint — zonder /ProcessXmlString suffix; CompanyCode gaat in SOAP header
  const endpoint = `https://${clusterHost}/webservices/processxml.asmx`;

  const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://www.twinfield.com/"><soap:Header><tns:Header><tns:AccessToken>${token}</tns:AccessToken><tns:CompanyCode>${officeCode}</tns:CompanyCode></tns:Header></soap:Header><soap:Body><tns:ProcessXmlString><tns:xmlRequest>${xml.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</tns:xmlRequest></tns:ProcessXmlString></soap:Body></soap:Envelope>`;

  const doRequest = async (): Promise<Response> => {
    return fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "SOAPAction": '"http://www.twinfield.com/ProcessXmlString"',
        Authorization: `Bearer ${token}`,
      },
      body: soapEnvelope,
    });
  };

  let res = await doRequest();

  // Rate limiting: wacht retry-after seconden en probeer één keer opnieuw
  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get("retry-after") ?? "5", 10);
    await new Promise((r) => setTimeout(r, retryAfter * 1000));
    res = await doRequest();
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Twinfield XML call failed (${res.status}): ${text}`);
  }

  const soapResponse = await res.text();

  // Extraheer inner XML uit SOAP envelope <ProcessXmlStringResult>...</ProcessXmlStringResult>
  const innerMatch = soapResponse.match(/<ProcessXmlStringResult[^>]*>([\s\S]*?)<\/ProcessXmlStringResult>/i);
  const innerEscaped = innerMatch?.[1] ?? soapResponse;
  // HTML-entities terugzetten naar XML
  const responseText = innerEscaped
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");

  // Twinfield stuurt HTTP 200 ook bij fouten — controleer result attribuut
  if (/result\s*=\s*["']0["']/i.test(responseText)) {
    const msg =
      responseText.match(/\bmsg\s*=\s*["']([^"']+)["']/i)?.[1] ??
      responseText.match(/<msg[^>]*>(.*?)<\/msg>/i)?.[1] ??
      responseText.match(/<message[^>]*>(.*?)<\/message>/i)?.[1] ??
      "Onbekende Twinfield fout";
    throw new Error(`Twinfield fout: ${msg}`);
  }

  return responseText;
}

// ─── Setup discovery ──────────────────────────────────────────────────────────

export async function fetchTwinfieldSetup(
  officeCode: string
): Promise<{ transactionTypes: string[]; vatCodes: string[] }> {
  const token = await getValidToken();

  const transactionTypes: string[] = [];
  const vatCodes: string[] = [];

  try {
    const actXml = `<list><type>ACT</type><office>${escapeXml(officeCode)}</office></list>`;
    const actResponse = await callXml(token, officeCode, actXml);
    const actMatches = [...actResponse.matchAll(/<dimension>([\s\S]*?)<\/dimension>/gi)];
    for (const m of actMatches) {
      const block = m[1];
      const category = block.match(/<category>(.*?)<\/category>/i)?.[1]?.toLowerCase() ?? "";
      const code = block.match(/<code>(.*?)<\/code>/i)?.[1] ?? "";
      if (code && (category === "sales" || category === "sis" || category === "verkopen")) {
        transactionTypes.push(code);
      }
    }
    if (transactionTypes.length === 0) {
      for (const m of actMatches) {
        const code = m[1].match(/<code>(.*?)<\/code>/i)?.[1] ?? "";
        if (code) transactionTypes.push(code);
      }
    }
  } catch (e) {
    console.warn("[twinfield/setup] transaction types niet opgehaald:", e instanceof Error ? e.message : e);
  }

  try {
    const vatXml = `<list><type>VTC</type><office>${escapeXml(officeCode)}</office></list>`;
    const vatResponse = await callXml(token, officeCode, vatXml);
    for (const m of [...vatResponse.matchAll(/<dimension>([\s\S]*?)<\/dimension>/gi)]) {
      const code = m[1].match(/<code>(.*?)<\/code>/i)?.[1] ?? "";
      if (code) vatCodes.push(code);
    }
  } catch (e) {
    console.warn("[twinfield/setup] BTW codes niet opgehaald:", e instanceof Error ? e.message : e);
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

  const { officeCode, cluster } = settings;

  // 2. Search Twinfield by name
  const searchXml = `<list><type>DEB</type><office>${escapeXml(officeCode)}</office><filters><filter field="name" operator="like">${escapeXml(customer.companyName)}</filter></filters></list>`;
  let foundCode: string | null = null;

  try {
    const searchResponse = await callXml(token, officeCode, searchXml, cluster);
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

      if (customer.vatNumber && vatno) {
        const normalizedVat = customer.vatNumber.replace(/\s/g, "").toUpperCase();
        const normalizedVatno = vatno.replace(/\s/g, "").toUpperCase();
        if (normalizedVat === normalizedVatno) {
          foundCode = code;
          break;
        }
      }

      if (name.trim().toLowerCase() === customer.companyName.trim().toLowerCase()) {
        foundCode = code;
        break;
      }
    }
  } catch (err) {
    console.error("[twinfield] findOrCreateDebtor search error:", err);
  }

  // 3. If not found, create a new debtor
  // Nieuwe debiteuren in de 2xxxx-reeks (20000-29999). De oude, uit het
  // Teamleader-tijdperk in Twinfield bestaande debiteuren zitten in de
  // 1xxxx-reeks; door voortaan met 2 te beginnen kunnen we nooit een
  // bestaande code overschrijven (Twinfield geeft geen fout bij dubbele code).
  if (!foundCode) {
    const usedRows = await prisma.$queryRaw<Array<{ twinfield_debtor_code: string }>>`
      SELECT twinfield_debtor_code FROM customers
      WHERE twinfield_debtor_code IS NOT NULL AND twinfield_debtor_code ~ '^2[0-9]{4}$'
    `;
    const usedCodes = new Set(usedRows.map((r) => r.twinfield_debtor_code));

    let nextCode = 20000;
    while (usedCodes.has(String(nextCode)) && nextCode < 29999) {
      nextCode++;
    }
    const candidateCode = String(nextCode);

    const shortname = customer.companyName
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 8) || "DEBITOR";

    const createXml = `<dimension><office>${escapeXml(officeCode)}</office><type>DEB</type><code>${candidateCode}</code><name>${escapeXml(customer.companyName)}</name><shortname>${escapeXml(shortname)}</shortname></dimension>`;

    const createResponse = await callXml(token, officeCode, createXml, cluster);
    foundCode = createResponse.match(/<code[^>]*>(.*?)<\/code>/i)?.[1] ?? null;

    if (!foundCode) {
      throw new Error("Twinfield gaf geen debitor code terug na aanmaken");
    }
  }

  // 4. Save to our DB
  await prisma.$executeRaw`
    UPDATE customers SET twinfield_debtor_code = ${foundCode} WHERE id = ${customer.id}
  `;

  return foundCode;
}

// ─── BTW-logica op basis van land ─────────────────────────────────────────────

type VatMapping = {
  revenueAccount: string;
  vatCode: string | null;
};

function getVatMapping(country: string, defaultSettings: TwinfieldSettings): VatMapping {
  const c = country.trim().toUpperCase();

  if (c === "NL") {
    return { revenueAccount: "8100", vatCode: "VH" };
  }
  if (EU_COUNTRIES.has(c)) {
    return { revenueAccount: "8600", vatCode: "ICL" };
  }
  // Buiten EU
  return { revenueAccount: "8500", vatCode: "VN" };
}

// ─── Invoice sync ─────────────────────────────────────────────────────────────

export async function syncInvoiceToTwinfield(
  invoiceId: string
): Promise<TwinfieldSyncResult> {
  try {
    // 1. Get invoice with customer (incl. adressen) en regels
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        customer: {
          include: {
            addresses: {
              where: { type: "BILLING" },
              orderBy: { isDefault: "desc" },
              take: 1,
            },
          },
        },
        lines: { orderBy: { createdAt: "asc" } },
        deal: { select: { dealNumber: true } },
      },
    });

    if (!invoice) {
      return { success: false, error: "Factuur niet gevonden" };
    }

    // Concepten mogen NOOIT naar Twinfield: geen definitief nummer, nog wijzigbaar
    if (invoice.status === "DRAFT" || invoice.invoiceNumber.startsWith("DRAFT-")) {
      return { success: false, error: "Een concept-factuur kan niet naar Twinfield. Verstuur/boek de factuur eerst." };
    }

    // 2. Get valid OAuth token
    const token = await getValidToken();

    // 3. Get all Twinfield settings (incl. cluster)
    const settingsRows = await prisma.$queryRaw<
      Array<{
        twinfield_office_code: string | null;
        twinfield_transaction_type: string | null;
        twinfield_debtor_account: string | null;
        twinfield_revenue_account: string | null;
        twinfield_vat_code: string | null;
        twinfield_cluster: string | null;
      }>
    >`SELECT
        twinfield_office_code,
        twinfield_transaction_type,
        twinfield_debtor_account,
        twinfield_revenue_account,
        twinfield_vat_code,
        twinfield_cluster
      FROM company_settings WHERE id = 'singleton' LIMIT 1`;

    const row = settingsRows[0];

    if (!row?.twinfield_office_code) {
      throw new Error(
        "Twinfield office code niet ingesteld. Ga naar Instellingen → Twinfield."
      );
    }

    const cluster =
      row.twinfield_cluster ??
      process.env.TWINFIELD_CLUSTER ??
      "accounting.twinfield.com";

    const tfSettings: TwinfieldSettings = {
      officeCode: row.twinfield_office_code,
      transactionType: row.twinfield_transaction_type ?? "VRK",
      debtorAccount: row.twinfield_debtor_account ?? "1300",
      revenueAccount: row.twinfield_revenue_account ?? "8000",
      vatCode: row.twinfield_vat_code ?? "VH",
      cluster,
    };

    // 4. Bepaal BTW/omzetrekening op basis van klantland
    const billingCountry =
      invoice.customer.addresses[0]?.country?.toUpperCase().trim() ?? "NL";
    const vatMapping = getVatMapping(billingCountry, tfSettings);

    // 5. Find or create debtor
    const customerCode = await findOrCreateDebtor(token, tfSettings, {
      id: invoice.customer.id,
      companyName: invoice.customer.companyName,
      vatNumber: invoice.customer.vatNumber,
    });

    // 6. Build transaction XML
    const invoiceDate = formatTwinfieldDate(invoice.invoiceDate);
    const period = formatTwinfieldPeriod(invoice.invoiceDate);
    const total = Number(invoice.total).toFixed(2);

    // Intracommunautaire levering (EU, bv. België): Twinfield eist een
    // uitvoeringstype (performancetype) op de regel + een prestatiedatum in
    // de header. Distrixs levert goederen → "goods".
    const isEuIcp = vatMapping.vatCode === "ICL";
    // Intracommunautaire levering van goederen: alleen het uitvoeringstype.
    // Bij "goods" mag GEEN uitvoeringsdatum mee (die is enkel voor diensten).
    const perfLines = isEuIcp ? `\n        <performancetype>goods</performancetype>` : "";

    const detailLines = invoice.lines
      .map((line, i) => {
        const netValue = Number(line.netLineTotal).toFixed(2);
        const desc = (line.titleSnapshot ?? "").slice(0, 40);
        const vatLine = vatMapping.vatCode
          ? `\n        <vatcode>${escapeXml(vatMapping.vatCode)}</vatcode>`
          : "";
        return `      <line type="detail" id="${2 + i}">
        <dim1>${escapeXml(vatMapping.revenueAccount)}</dim1>
        <value>${netValue}</value>${vatLine}
        <description>${escapeXml(desc)}</description>${perfLines}
      </line>`;
      })
      .join("\n");

    const transactionXml = `<transactions>
  <transaction destiny="concept" autobalancevat="true" raisewarning="true">
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

    // 7. POST to Twinfield
    const response = await callXml(token, tfSettings.officeCode, transactionXml, cluster);

    // 8. Parse transaction reference from response
    const reference =
      response.match(/<number>(.*?)<\/number>/i)?.[1] ??
      response.match(/<transaction[^>]*\s+number="([^"]+)"/i)?.[1] ??
      invoice.invoiceNumber;

    // 9. Update invoice status
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
