// Teamleader Focus API v2 client

// Credentials uit env; fallback op de bestaande waarden zolang env nog niet
// overal gezet is (worden bij de Teamleader-uitfasering verwijderd + geroteerd).
const CLIENT_ID = process.env.TEAMLEADER_CLIENT_ID ?? "38fb7bf0cfe0e21d64b4441f0a6be867";
const CLIENT_SECRET = process.env.TEAMLEADER_CLIENT_SECRET ?? "b04fed6f12716b2b0516144f236ae969";
const REDIRECT_URI = "https://crm.distrixs.nl/api/teamleader/callback";

const AUTHORIZE_URL = "https://focus.teamleader.eu/oauth2/authorize";
const TOKEN_URL = "https://focus.teamleader.eu/oauth2/access_token";
const API_BASE = "https://api.focus.teamleader.eu";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TLTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
}

export interface TLCompany {
  id: string;
  name: string;
  added_at?: string;
  vat_number?: string;
  national_identification_number?: string;
  emails?: Array<{ type: string; email: string }>;
  telephones?: Array<{ type: string; number: string }>;
  invoice_emails?: Array<{ email: string }>;
  website?: string;
  primary_address?: {
    line_1?: string;
    postal_code?: string;
    city?: string;
    country?: string;
  };
}

export interface TLContact {
  id: string;
  first_name: string;
  last_name: string;
  emails?: Array<{ type: string; email: string }>;
  telephones?: Array<{ type: string; number: string }>;
  companies?: Array<{ company: { id: string; type: string }; function?: string }>;
}

export interface TLDeal {
  id: string;
  title: string;
  status: "new" | "open" | "won" | "lost";
  lead?: { customer?: { type: string; id: string }; contact_person?: { type: string; id: string } };
  customer?: { type: string; id: string }; // legacy veld, nieuwe deals gebruiken lead.customer
  responsible_user?: { type: string; id: string };
  estimated_closing_date?: string;
  created_at?: string;
  reference?: string;
}

export interface TLQuotation {
  id: string;
  quotation_number?: { id: string; number: number };
  deal?: { type: string; id: string };
  lead?: { customer?: { type: string; id: string } };
  customer?: { type: string; id: string }; // legacy
  status: "draft" | "sent" | "accepted" | "rejected";
  total?: { tax_exclusive?: { amount: number; currency: string }; tax_inclusive?: { amount: number; currency: string } };
  created_at?: string;
}

export interface TLInvoice {
  id: string;
  invoice_number?: string | null; // bv. "2026 / 326"; null zolang concept
  deal?: { type: string; id: string };
  customer?: { type: string; id: string };
  invoicee?: { customer?: { type: string; id: string } };
  status: "draft" | "outstanding" | "paid" | "overdue" | "matched";
  due_on?: string;
  invoice_date?: string;
  total?: { tax_exclusive?: { amount: number; currency: string }; tax_inclusive?: { amount: number; currency: string } };
}

export interface TLCreditNote {
  id: string;
  credit_note_number?: { id?: string; number?: number } | string | number;
  credit_note_date?: string;
  status?: string;
  invoice?: { type: string; id: string };
  customer?: { type: string; id: string };
  invoicee?: { customer?: { type: string; id: string } };
  total?: { tax_exclusive?: { amount: number; currency: string }; tax_inclusive?: { amount: number; currency: string } };
  created_at?: string;
}

export interface TLProduct {
  id: string;
  name: string;
  description?: string;
  code?: string;
  price?: { amount: number; currency: string };
  selling_price?: { amount: number; currency: string };
  purchase_price?: { amount: number; currency: string };
  unit?: string;
  vat_rate?: { type: string; rate: number };
}

export interface TLListResponse<T> {
  data: T[];
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export function getAuthUrl(state?: string): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    ...(state ? { state } : {}),
  });
  return `${AUTHORIZE_URL}?${params.toString()}`;
}

export async function exchangeCode(code: string): Promise<TLTokenResponse> {
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    code,
    grant_type: "authorization_code",
    redirect_uri: REDIRECT_URI,
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${text}`);
  }

  return res.json() as Promise<TLTokenResponse>;
}

export async function refreshTokens(refreshToken: string): Promise<TLTokenResponse> {
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed: ${res.status} ${text}`);
  }

  return res.json() as Promise<TLTokenResponse>;
}

// ─── Paginated list helper ────────────────────────────────────────────────────

async function fetchAllPages<T>(
  accessToken: string,
  endpoint: string,
  filter: Record<string, unknown> = {}
): Promise<T[]> {
  const results: T[] = [];
  let page = 1;
  const size = 100;

  while (true) {
    const res = await fetch(`${API_BASE}/${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ filter, page: { size, number: page } }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${endpoint} failed (page ${page}): ${res.status} ${text}`);
    }

    const json = (await res.json()) as TLListResponse<T>;
    results.push(...json.data);

    if (json.data.length < size) break;
    page++;
  }

  return results;
}

// ─── Resource fetchers ────────────────────────────────────────────────────────

export async function fetchCompanies(accessToken: string): Promise<TLCompany[]> {
  return fetchAllPages<TLCompany>(accessToken, "companies.list");
}

export async function fetchContacts(accessToken: string): Promise<TLContact[]> {
  return fetchAllPages<TLContact>(accessToken, "contacts.list");
}

export async function fetchDeals(accessToken: string): Promise<TLDeal[]> {
  return fetchAllPages<TLDeal>(accessToken, "deals.list");
}

export async function fetchQuotations(accessToken: string): Promise<TLQuotation[]> {
  return fetchAllPages<TLQuotation>(accessToken, "quotations.list");
}

export async function fetchInvoices(accessToken: string): Promise<TLInvoice[]> {
  return fetchAllPages<TLInvoice>(accessToken, "invoices.list");
}

export async function fetchProducts(accessToken: string): Promise<TLProduct[]> {
  return fetchAllPages<TLProduct>(accessToken, "products.list");
}

export async function fetchCreditNotes(accessToken: string): Promise<TLCreditNote[]> {
  return fetchAllPages<TLCreditNote>(accessToken, "creditNotes.list");
}

// ─── Detail-info (regels zitten niet in de list-response) ────────────────────

export interface TLLineItem {
  product?: { type: string; id: string };
  quantity?: number;
  description?: string;
  unit_price?: { amount: number; tax: string };
  discount?: { value?: number; type?: string } | null;
  purchase_price?: { amount: number; currency: string };
  total?: {
    tax_exclusive?: { amount: number };
    tax_inclusive?: { amount: number };
  };
}

export interface TLInvoiceInfo {
  id: string;
  grouped_lines?: Array<{ line_items?: TLLineItem[] }>;
}

async function fetchDetailInfo(
  accessToken: string,
  endpoint: string,
  id: string
): Promise<TLInvoiceInfo | null> {
  const res = await fetch(`${API_BASE}/${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ id }),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { data: TLInvoiceInfo };
  return json.data;
}

export async function fetchInvoiceInfo(
  accessToken: string,
  invoiceId: string
): Promise<TLInvoiceInfo | null> {
  return fetchDetailInfo(accessToken, "invoices.info", invoiceId);
}

export async function fetchQuotationInfo(
  accessToken: string,
  quotationId: string
): Promise<TLInvoiceInfo | null> {
  return fetchDetailInfo(accessToken, "quotations.info", quotationId);
}

export async function fetchCreditNoteInfo(
  accessToken: string,
  creditNoteId: string
): Promise<TLInvoiceInfo | null> {
  return fetchDetailInfo(accessToken, "creditNotes.info", creditNoteId);
}
