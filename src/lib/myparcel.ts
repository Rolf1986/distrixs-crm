// MyParcel API integration
// Docs: https://developer.myparcel.nl/api-reference/
// Base URL: https://api.myparcel.nl
// Auth: Basic auth with API key (base64 encoded)

import { prisma } from "@/lib/prisma";
import { normalizeCountry } from "@/lib/vat";

const MYPARCEL_BASE_URL = "https://api.myparcel.nl";
const MYPARCEL_TRACKING_BASE = "https://myparcel.me/track-trace";

// MyParcel carrier-ID's (api.myparcel.nl). Uitbreidbaar.
export const MYPARCEL_CARRIERS: Array<{ id: number; label: string }> = [
  { id: 11, label: "DHL Europlus" },
  { id: 1, label: "PostNL" },
  { id: 2, label: "bpost" },
  { id: 4, label: "DPD" },
  { id: 9, label: "DHL for you" },
  { id: 10, label: "DHL Parcel Connect" },
  { id: 12, label: "UPS Standard" },
];

// Map MyParcel numeric status codes to internal status strings and NL labels
const STATUS_MAP: Record<number, { status: string; label: string }> = {
  1:  { status: "PENDING",    label: "Aangemeld" },
  2:  { status: "PENDING",    label: "Aangemeld" },
  3:  { status: "PENDING",    label: "Verwerkt" },
  4:  { status: "IN_TRANSIT", label: "Onderweg" },
  5:  { status: "IN_TRANSIT", label: "Onderweg" },
  6:  { status: "IN_TRANSIT", label: "Onderweg" },
  7:  { status: "IN_TRANSIT", label: "Onderweg" },
  8:  { status: "IN_TRANSIT", label: "Bezorgd bij buren/balie" },
  9:  { status: "DELIVERED",  label: "Afgeleverd" },
  10: { status: "IN_TRANSIT", label: "Niet afgeleverd" },
  11: { status: "IN_TRANSIT", label: "Bezorgpoging mislukt" },
  12: { status: "DELIVERED",  label: "Afgeleverd" },
  13: { status: "RETURN",     label: "Retour" },
  14: { status: "RETURN",     label: "Retour afgeleverd" },
  15: { status: "IN_TRANSIT", label: "Beschadigd" },
  16: { status: "RETURN",     label: "Retour onderweg" },
  30: { status: "PENDING",    label: "Aangemeld bij douane" },
  31: { status: "IN_TRANSIT", label: "Douane vrijgegeven" },
  32: { status: "IN_TRANSIT", label: "Douane ingehouden" },
  33: { status: "IN_TRANSIT", label: "Bezorgd bij buren" },
  34: { status: "IN_TRANSIT", label: "Afgemeld door geadresseerde" },
  35: { status: "DELIVERED",  label: "Afgeleverd in brievenbus" },
  36: { status: "IN_TRANSIT", label: "Retour initiatief geadresseerde" },
  40: { status: "CANCELLED",  label: "Geannuleerd" },
  41: { status: "CANCELLED",  label: "Verwijderd" },
  42: { status: "PENDING",    label: "Concept" },
  43: { status: "PENDING",    label: "Zending aangemeld" },
  44: { status: "IN_TRANSIT", label: "In aflevering" },
  45: { status: "DELIVERED",  label: "Afgeleverd" },
};

async function getApiKey(): Promise<string | null> {
  try {
    const rows = await prisma.$queryRaw<Array<{ myparcel_api_key: string | null }>>`
      SELECT myparcel_api_key FROM company_settings WHERE id = 'singleton' LIMIT 1
    `;
    if (rows[0]?.myparcel_api_key) return rows[0].myparcel_api_key;
  } catch { /* kolom bestaat nog niet / geen DB → val terug op env */ }
  return process.env.MYPARCEL_API_KEY ?? null;
}

// MyParcel wijkt af van standaard Basic-auth: base64 van de kale sleutel,
// ZONDER ":" erachter (zie developer.myparcel.nl → Authentication).
function makeAuthHeader(apiKey: string): string {
  return `basic ${Buffer.from(apiKey).toString("base64")}`;
}

export interface ShipmentStatusResult {
  status: string;
  statusLabel: string;
  trackingCode: string | null;
  estimatedDelivery: Date | null;
}

export async function getShipmentStatus(
  myParcelShipmentId: string
): Promise<ShipmentStatusResult | null> {
  const apiKey = await getApiKey();
  if (!apiKey) return null;

  try {
    const response = await fetch(
      `${MYPARCEL_BASE_URL}/shipments/${myParcelShipmentId}`,
      {
        method: "GET",
        headers: {
          Accept: "application/json;charset=utf-8;version=2.0",
          Authorization: makeAuthHeader(apiKey),
        },
        // Don't cache — we always want fresh status
        cache: "no-store",
      }
    );

    if (!response.ok) {
      console.error(
        `MyParcel API error: ${response.status} ${response.statusText}`
      );
      return null;
    }

    const data = await response.json();

    // Response shape: { data: { shipments: [ {...} ] } }
    const shipments = data?.data?.shipments;
    if (!Array.isArray(shipments) || shipments.length === 0) return null;

    const shipment = shipments[0];
    const statusCode: number = shipment?.status?.current ?? shipment?.status;
    const mapped = STATUS_MAP[statusCode] ?? {
      status: "PENDING",
      label: `Status ${statusCode}`,
    };

    const trackingCode: string | null =
      shipment?.barcode ?? shipment?.tracking_code ?? null;

    // Estimated delivery: check several possible fields
    let estimatedDelivery: Date | null = null;
    const rawDate =
      shipment?.options?.delivery_date ??
      shipment?.delivery_date ??
      shipment?.drop_off_day ??
      null;
    if (rawDate) {
      const d = new Date(rawDate);
      if (!isNaN(d.getTime())) estimatedDelivery = d;
    }

    return {
      status: mapped.status,
      statusLabel: mapped.label,
      trackingCode,
      estimatedDelivery,
    };
  } catch (err) {
    console.error("MyParcel fetch error:", err);
    return null;
  }
}

/**
 * Returns the MyParcel track-trace URL.
 * postalCode is optional; when omitted the URL still works for basic tracking.
 */
export function getTrackingUrl(
  trackingCode: string,
  postalCode?: string
): string {
  const postal = postalCode?.replace(/\s+/g, "") ?? "";
  if (postal) {
    return `${MYPARCEL_TRACKING_BASE}/${trackingCode}/${postal}/NL`;
  }
  return `${MYPARCEL_TRACKING_BASE}/${trackingCode}`;
}

export async function hasApiKey(): Promise<boolean> {
  return Boolean(await getApiKey());
}

function makeAuth(apiKey: string): string {
  return makeAuthHeader(apiKey);
}

export interface MyParcelRecipient {
  cc: string;            // landcode, bv. NL
  postal_code: string;
  city: string;
  street: string;
  number: string;
  person: string;        // naam/bedrijf
  email?: string | null;
}

/**
 * Maak één MyParcel-zending aan (multicollo bij >1 pakket) en geef de
 * MyParcel shipment-id's terug. Package_type 1 = pakket.
 */
export async function createMyParcelShipments(opts: {
  recipient: MyParcelRecipient;
  carrier: number;
  numberOfPackages: number;
  reference?: string;
}): Promise<{ ids: number[]; error?: string }> {
  const apiKey = await getApiKey();
  if (!apiKey) return { ids: [], error: "MyParcel API-sleutel niet ingesteld" };

  const n = Math.max(1, Math.min(20, Math.floor(opts.numberOfPackages || 1)));
  const shipment: Record<string, unknown> = {
    recipient: {
      cc: opts.recipient.cc,
      postal_code: opts.recipient.postal_code,
      city: opts.recipient.city,
      street: opts.recipient.street,
      number: opts.recipient.number,
      person: opts.recipient.person,
      ...(opts.recipient.email ? { email: opts.recipient.email } : {}),
    },
    carrier: opts.carrier,
    options: {
      package_type: 1,
      ...(opts.reference ? { label_description: opts.reference.slice(0, 45) } : {}),
    },
    ...(n > 1 ? { secondary_shipments: Array.from({ length: n - 1 }, () => ({})) } : {}),
  };

  try {
    const res = await fetch(`${MYPARCEL_BASE_URL}/shipments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/vnd.shipment+json;charset=utf-8;version=1.1",
        Accept: "application/json;charset=utf-8",
        Authorization: makeAuth(apiKey),
      },
      body: JSON.stringify({ data: { shipments: [shipment] } }),
    });
    const text = await res.text();
    if (!res.ok) {
      console.error("[myparcel] create shipment fout:", res.status, text.slice(0, 500));
      return { ids: [], error: `MyParcel-fout (${res.status})` };
    }
    const json = JSON.parse(text);
    const ids: number[] = (json?.data?.ids ?? []).map((x: { id: number }) => x.id).filter(Boolean);
    return { ids };
  } catch (e) {
    console.error("[myparcel] create shipment error:", e);
    return { ids: [], error: "Netwerkfout richting MyParcel" };
  }
}

/** Haal het barcode/tracking van een MyParcel-zending op (kan even duren na aanmaken). */
export async function getBarcode(myParcelShipmentId: number | string): Promise<string | null> {
  const s = await getShipmentStatus(String(myParcelShipmentId));
  return s?.trackingCode ?? null;
}

/** Label-PDF (A6) van één of meer MyParcel-zendingen ophalen. */
export async function fetchLabelPdf(ids: Array<number | string>): Promise<Buffer | null> {
  const apiKey = await getApiKey();
  if (!apiKey || ids.length === 0) return null;
  try {
    const res = await fetch(`${MYPARCEL_BASE_URL}/shipment_labels/${ids.join(";")}?format=A6`, {
      method: "GET",
      headers: { Accept: "application/pdf", Authorization: makeAuth(apiKey) },
    });
    if (!res.ok) {
      console.error("[myparcel] label ophalen fout:", res.status);
      return null;
    }
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  } catch (e) {
    console.error("[myparcel] label error:", e);
    return null;
  }
}

export { normalizeCountry };
