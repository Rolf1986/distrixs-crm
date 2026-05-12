import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

/**
 * KvK + VIES BTW lookup endpoint
 *
 * GET /api/kvk-lookup?kvk=12345678        → bedrijfsinfo via KvK
 * GET /api/kvk-lookup?vat=NL123456789B01  → BTW validatie via EU VIES
 * GET /api/kvk-lookup?kvk=12345678&vat=NL... → beide
 */

interface KvkResult {
  companyName?: string;
  street?: string;
  houseNumber?: string;
  postalCode?: string;
  city?: string;
}

interface ViesResult {
  valid: boolean;
  companyName?: string;
  address?: string;
  countryCode?: string;
  vatNumber?: string;
}

// ── KvK opzoeken ──────────────────────────────────────────────────────────────

async function lookupKvkOfficial(kvkNumber: string, apiKey: string): Promise<KvkResult | null> {
  try {
    const res = await fetch(`https://api.kvk.nl/api/v2/zoeken?kvkNummer=${encodeURIComponent(kvkNumber)}`, {
      headers: { apikey: apiKey },
    });
    if (!res.ok) return null;
    const data = await res.json() as { resultaten?: Array<{ naam?: string; adres?: { binnenlandsAdres?: { straatnaam?: string; huisnummer?: number; postcode?: string; plaats?: string } } }> };
    const hit = data.resultaten?.[0];
    if (!hit?.naam) return null;
    const addr = hit.adres?.binnenlandsAdres;
    return {
      companyName: hit.naam,
      street: addr?.straatnaam,
      houseNumber: addr?.huisnummer?.toString(),
      postalCode: addr?.postcode,
      city: addr?.plaats,
    };
  } catch { return null; }
}

async function lookupKvkOpen(kvkNumber: string): Promise<KvkResult | null> {
  try {
    const res = await fetch(`https://api.openkvk.nl/json/${encodeURIComponent(kvkNumber)}/1`);
    if (!res.ok) return null;
    const data = await res.json() as { RESULT?: Array<{ bedrijfsnaam?: string; straat?: string; huisnummer?: string; postcode?: string; plaats?: string }> };
    const hit = data.RESULT?.[0];
    if (!hit?.bedrijfsnaam) return null;
    return { companyName: hit.bedrijfsnaam, street: hit.straat, houseNumber: hit.huisnummer, postalCode: hit.postcode, city: hit.plaats };
  } catch { return null; }
}

// ── VIES BTW validatie (EU) ───────────────────────────────────────────────────

async function validateVies(vatNumber: string): Promise<ViesResult> {
  // Format: NL123456789B01 → countryCode=NL, number=123456789B01
  const cleaned = vatNumber.replace(/[\s\.\-]/g, "").toUpperCase();
  const countryCode = cleaned.slice(0, 2);
  const number = cleaned.slice(2);

  if (!/^[A-Z]{2}/.test(cleaned) || number.length < 4) {
    return { valid: false };
  }

  try {
    const url = `https://ec.europa.eu/taxation_customs/vies/rest-api/ms/${countryCode}/vat/${number}`;
    const res = await fetch(url, {
      headers: { "Accept": "application/json" },
    });

    if (!res.ok) {
      // VIES kan tijdelijk onbereikbaar zijn per land
      return { valid: false };
    }

    const data = await res.json() as {
      isValid?: boolean;
      name?: string;
      address?: string;
      countryCode?: string;
      vatNumber?: string;
      userError?: string;
    };

    return {
      valid: data.isValid ?? false,
      companyName: data.name && data.name !== "---" ? data.name : undefined,
      address: data.address && data.address !== "---" ? data.address : undefined,
      countryCode: data.countryCode,
      vatNumber: data.vatNumber ? `${data.countryCode}${data.vatNumber}` : cleaned,
    };
  } catch {
    return { valid: false };
  }
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const kvkNumber = req.nextUrl.searchParams.get("kvk")?.trim();
  const vatNumber = req.nextUrl.searchParams.get("vat")?.trim();

  if (!kvkNumber && !vatNumber) {
    return NextResponse.json({ error: "Geef kvk of vat parameter op" }, { status: 400 });
  }

  const result: {
    companyName?: string;
    vatNumber?: string;
    vatValid?: boolean;
    street?: string;
    houseNumber?: string;
    postalCode?: string;
    city?: string;
    viesAddress?: string;
  } = {};

  // ── KvK lookup ──
  if (kvkNumber) {
    if (!/^\d{8}$/.test(kvkNumber)) {
      return NextResponse.json({ error: "KvK-nummer moet 8 cijfers bevatten" }, { status: 400 });
    }

    const apiKey = process.env.KVK_API_KEY;
    let kvkResult = apiKey ? await lookupKvkOfficial(kvkNumber, apiKey) : null;
    if (!kvkResult) kvkResult = await lookupKvkOpen(kvkNumber);

    if (!kvkResult && !vatNumber) {
      return NextResponse.json({ error: `Geen bedrijf gevonden voor KvK ${kvkNumber}` }, { status: 404 });
    }

    if (kvkResult) {
      result.companyName = kvkResult.companyName;
      result.street = kvkResult.street;
      result.houseNumber = kvkResult.houseNumber;
      result.postalCode = kvkResult.postalCode;
      result.city = kvkResult.city;
    }
  }

  // ── VIES BTW validatie ──
  if (vatNumber) {
    const vies = await validateVies(vatNumber);
    result.vatValid = vies.valid;
    result.vatNumber = vies.vatNumber ?? vatNumber.toUpperCase().replace(/\s/g, "");

    if (vies.companyName && !result.companyName) {
      result.companyName = vies.companyName;
    }
    if (vies.address) {
      result.viesAddress = vies.address;
    }
  }

  return NextResponse.json(result);
}
