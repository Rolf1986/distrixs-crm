import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

/**
 * Postcode + huisnummer → straat + plaats via de PDOK Locatieserver
 * (Kadaster open data, gratis, geen API-sleutel). Server-side zodat de
 * browser-CSP niet in de weg zit.
 */
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const postcode = (req.nextUrl.searchParams.get("postcode") ?? "").replace(/\s+/g, "").toUpperCase();
  const huisnummer = (req.nextUrl.searchParams.get("huisnummer") ?? "").trim();

  if (!/^\d{4}[A-Z]{2}$/.test(postcode)) {
    return NextResponse.json({ error: "Ongeldige postcode" }, { status: 400 });
  }
  if (!huisnummer) {
    return NextResponse.json({ error: "Huisnummer verplicht" }, { status: 400 });
  }

  // Alleen het cijferdeel van het huisnummer voor de query (12A → 12)
  const huisnummerNr = huisnummer.match(/\d+/)?.[0] ?? huisnummer;
  const q = encodeURIComponent(`${postcode} ${huisnummerNr}`);
  const url = `https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=${q}&fq=type:adres&rows=1`;

  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return NextResponse.json({ error: "Zoekdienst niet bereikbaar" }, { status: 502 });
    const data = await res.json();
    const doc = data?.response?.docs?.[0];
    if (!doc) return NextResponse.json({ error: "Geen adres gevonden" }, { status: 404 });

    return NextResponse.json({
      street: doc.straatnaam ?? "",
      city: doc.woonplaatsnaam ?? "",
      postcode: doc.postcode ?? postcode,
    });
  } catch {
    return NextResponse.json({ error: "Zoekdienst niet bereikbaar" }, { status: 502 });
  }
}
