import { NextRequest, NextResponse } from "next/server";
import { verifyPassword, createAndSendOtp } from "@/lib/otp";

export async function POST(req: NextRequest) {
  const { email, password } = await req.json();

  if (!email || !password) {
    return NextResponse.json({ error: "Verplichte velden ontbreken" }, { status: 400 });
  }

  const valid = await verifyPassword(email, password);
  if (!valid) {
    // Zelfde foutmelding om user enumeration te voorkomen
    return NextResponse.json({ error: "Ongeldige inloggegevens" }, { status: 401 });
  }

  const result = await createAndSendOtp(email);
  if (!result.success) {
    return NextResponse.json({ error: "Versturen mislukt, probeer opnieuw" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
