// MyParcel API integration
// Docs: https://developer.myparcel.nl/api-reference/
// Base URL: https://api.myparcel.nl
// Auth: Basic auth with API key (base64 encoded)

const MYPARCEL_BASE_URL = "https://api.myparcel.nl";
const MYPARCEL_TRACKING_BASE = "https://myparcel.me/track-trace";

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

function getApiKey(): string | null {
  return process.env.MYPARCEL_API_KEY ?? null;
}

function makeAuthHeader(apiKey: string): string {
  const encoded = Buffer.from(apiKey + ":").toString("base64");
  return `Basic ${encoded}`;
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
  const apiKey = getApiKey();
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

export function hasApiKey(): boolean {
  return Boolean(getApiKey());
}
