import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit, clientIp } from "@/lib/rate-limit";

// ─── Publiek tracking-endpoint ─────────────────────────────────────────────────
// Wordt cross-origin aangeroepen vanaf de webshop (distrixs.nl) door public/track.js.
// Geen sessie-auth: het bezoeker-id (vid) komt uit de first-party localStorage van
// de webshop, dus we zetten hier géén cookie en vertrouwen op de meegestuurde vid.
// Consent wordt aan de webshop-kant afgedwongen (GDPR Cookie Compliance) — bereikt
// een request dit endpoint, dan is er consent.

// Toegestane webshop-origins (komma-gescheiden via env; standaard www + non-www distrixs.nl).
const WEBSHOP_ORIGINS = (process.env.WEBSHOP_ORIGIN ?? "https://www.distrixs.nl,https://distrixs.nl")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const SESSION_GAP_MS = 30 * 60 * 1000; // 30 min inactiviteit ⇒ nieuwe sessie
const MAX_EVENTS_PER_REQUEST = 50;

const ALLOWED_EVENT_TYPES = new Set([
  "pageview",
  "product_view",
  "add_to_cart",
  "login",
  "search",
  "click",
]);

function corsHeaders(origin: string | null): Record<string, string> {
  // Echo de aanvragende origin terug als die is toegestaan; anders de eerste uit de lijst.
  const allow = origin && WEBSHOP_ORIGINS.includes(origin) ? origin : WEBSHOP_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export async function OPTIONS(req: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(req.headers.get("origin")),
  });
}

function str(v: unknown, max = 2048): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

function toDate(ts: unknown): Date {
  if (typeof ts === "number" && Number.isFinite(ts)) {
    const d = new Date(ts);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

export async function POST(req: NextRequest) {
  const headers = corsHeaders(req.headers.get("origin"));

  let body: {
    vid?: unknown;
    ua?: unknown;
    ctx?: Record<string, unknown>;
    user?: { wcId?: unknown; email?: unknown; name?: unknown } | null;
    events?: unknown;
  };
  try {
    // Request.json() parseert de body ongeacht content-type, dus sendBeacon
    // (text/plain) werkt hier ook.
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400, headers });
  }

  const vid = str(body.vid, 64);
  if (!vid) {
    return NextResponse.json({ error: "vid required" }, { status: 400, headers });
  }

  // Anti-flooding: begrens events per bezoeker en per IP
  if (!rateLimit(`track-vid:${vid}`, 600, 60 * 60 * 1000).allowed) {
    return new NextResponse(null, { status: 429, headers });
  }
  if (!rateLimit(`track-ip:${clientIp(req)}`, 2000, 60 * 60 * 1000).allowed) {
    return new NextResponse(null, { status: 429, headers });
  }

  const rawEvents = Array.isArray(body.events) ? body.events : [];
  const events = rawEvents
    .filter((e): e is Record<string, unknown> => !!e && typeof e === "object")
    .filter((e) => typeof e.type === "string" && ALLOWED_EVENT_TYPES.has(e.type))
    .slice(0, MAX_EVENTS_PER_REQUEST);

  if (events.length === 0) {
    return NextResponse.json({ error: "no valid events" }, { status: 400, headers });
  }

  const ctx = (body.ctx ?? {}) as Record<string, unknown>;
  const now = new Date();

  try {
    // 0. Uitgesloten accounts (eigen/interne accounts) niet tracken.
    const wcId =
      body.user && typeof body.user.wcId === "number" && Number.isFinite(body.user.wcId)
        ? Math.trunc(body.user.wcId)
        : null;
    if (wcId && wcId > 0) {
      const existingAccount = await prisma.webshopAccount.findUnique({
        where: { wcUserId: wcId },
        select: { excluded: true },
      });
      if (existingAccount?.excluded) {
        return new NextResponse(null, { status: 204, headers });
      }
    }
    const knownVisitor = await prisma.analyticsVisitor.findUnique({
      where: { vid },
      select: { accountId: true, account: { select: { excluded: true } } },
    });
    if (knownVisitor?.account?.excluded) {
      return new NextResponse(null, { status: 204, headers });
    }

    // 1. Bezoeker vinden of aanmaken (op vid).
    const visitor = await prisma.analyticsVisitor.upsert({
      where: { vid },
      create: { vid, userAgent: str(body.ua, 512), firstSeenAt: now, lastSeenAt: now },
      update: { lastSeenAt: now },
    });

    // 2. Ingelogde klant? Koppel het WooCommerce-account aan de bezoeker (identify).
    let accountId = visitor.accountId;
    if (wcId && wcId > 0) {
      const account = await prisma.webshopAccount.upsert({
        where: { wcUserId: wcId },
        create: {
          wcUserId: wcId,
          email: str(body.user?.email, 320),
          displayName: str(body.user?.name, 256),
          firstSeenAt: now,
          lastSeenAt: now,
        },
        update: {
          lastSeenAt: now,
          email: str(body.user?.email, 320) ?? undefined,
          displayName: str(body.user?.name, 256) ?? undefined,
        },
      });
      accountId = account.id;
      if (visitor.accountId !== account.id) {
        await prisma.analyticsVisitor.update({
          where: { id: visitor.id },
          data: { accountId: account.id },
        });
      }
    }

    // 3. Sessie bepalen: hergebruik de laatste sessie binnen het inactiviteits-venster,
    //    anders een nieuwe sessie (met de campagne/referrer-context van deze landing).
    const recent = await prisma.analyticsSession.findFirst({
      where: { visitorId: visitor.id },
      orderBy: { lastEventAt: "desc" },
    });

    const isFresh = !recent || now.getTime() - recent.lastEventAt.getTime() > SESSION_GAP_MS;
    const session = isFresh
      ? await prisma.analyticsSession.create({
          data: {
            visitorId: visitor.id,
            landingPath: str(ctx.landingPath),
            referrer: str(ctx.referrer),
            utmSource: str(ctx.utmSource, 256),
            utmMedium: str(ctx.utmMedium, 256),
            utmCampaign: str(ctx.utmCampaign, 256),
            utmContent: str(ctx.utmContent, 256),
            utmTerm: str(ctx.utmTerm, 256),
            device: str(ctx.device, 32),
            startedAt: now,
            lastEventAt: now,
          },
        })
      : recent;

    // 4. Events wegschrijven.
    let maxTs = session.lastEventAt;
    await prisma.analyticsEvent.createMany({
      data: events.map((e) => {
        const occurredAt = toDate(e.ts);
        if (occurredAt > maxTs) maxTs = occurredAt;
        return {
          sessionId: session.id,
          visitorId: visitor.id,
          type: e.type as string,
          path: str(e.path),
          title: str(e.title, 512),
          productSku: str(e.productSku, 128),
          metadata:
            e.metadata && typeof e.metadata === "object"
              ? (e.metadata as object)
              : undefined,
          occurredAt,
        };
      }),
    });

    // 5. Tijdstempels bijwerken.
    await prisma.analyticsSession.update({
      where: { id: session.id },
      data: { lastEventAt: maxTs },
    });

    return new NextResponse(null, { status: 204, headers });
  } catch (err) {
    console.error("[track] failed", err);
    return NextResponse.json({ error: "server error" }, { status: 500, headers });
  }
}
