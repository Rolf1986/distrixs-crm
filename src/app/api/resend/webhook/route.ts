import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";

// Resend-webhook (MAIL-02): aflever-/bouncestatus terugkoppelen op SentEmail.
// Instellen in Resend → Webhooks → endpoint https://crm.distrixs.nl/api/resend/webhook
// met events email.delivered / email.bounced / email.complained /
// email.delivery_delayed; de signing secret (whsec_…) hoort in
// RESEND_WEBHOOK_SECRET in .env.production.
//
// Resend ondertekent via svix: HMAC-SHA256(base64-secret, "{id}.{timestamp}.{body}"),
// base64 in de header "svix-signature" als "v1,<sig>" (meerdere mogelijk).

interface ResendEvent {
  type: string;
  created_at?: string;
  data?: {
    email_id?: string;
    bounce?: { message?: string; subType?: string };
  };
}

function verifySignature(req: NextRequest, body: string, secret: string): boolean {
  const id = req.headers.get("svix-id");
  const timestamp = req.headers.get("svix-timestamp");
  const sigHeader = req.headers.get("svix-signature");
  if (!id || !timestamp || !sigHeader) return false;

  // Replay-bescherming: timestamp max 5 minuten oud
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > 300) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key)
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");

  return sigHeader.split(" ").some((part) => {
    const sig = part.split(",")[1];
    if (!sig) return false;
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  });
}

const STATUS_BY_EVENT: Record<string, string> = {
  "email.delivered": "DELIVERED",
  "email.bounced": "BOUNCED",
  "email.complained": "COMPLAINED",
  "email.delivery_delayed": "DELAYED",
};

export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Webhook niet geconfigureerd" }, { status: 503 });
  }

  const body = await req.text();
  if (!verifySignature(req, body, secret)) {
    return NextResponse.json({ error: "Ongeldige handtekening" }, { status: 401 });
  }

  let event: ResendEvent;
  try {
    event = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Ongeldige payload" }, { status: 400 });
  }

  const status = STATUS_BY_EVENT[event.type];
  const emailId = event.data?.email_id;
  if (!status || !emailId) {
    // Onbekend event (bv. email.sent) — bevestigen en negeren
    return NextResponse.json({ ok: true });
  }

  // DELAYED mag een eerdere DELIVERED niet overschrijven
  const detail = event.data?.bounce?.message ?? null;
  const updated = await prisma.sentEmail.updateMany({
    where: {
      resendId: emailId,
      ...(status === "DELAYED" ? { deliveryStatus: { not: "DELIVERED" } } : {}),
    },
    data: { deliveryStatus: status, deliveryDetail: detail, deliveryAt: new Date() },
  });

  if (status === "BOUNCED" || status === "COMPLAINED") {
    console.warn(`[resend-webhook] ${event.type} voor ${emailId} (${updated.count} mail(s) bijgewerkt): ${detail ?? "geen detail"}`);
  }

  return NextResponse.json({ ok: true, updated: updated.count });
}
