import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { sendEmail, buildEmailHtml } from "@/lib/email";
import { logSentEmail } from "@/lib/sent-email";

// Wekelijkse reminder met alle uitstaande demo-items. Aangeroepen door de
// server-cron (x-cron-secret, maandag 08:00) of handmatig door een ingelogde
// gebruiker via de knop op de demo-pagina. Geen uitstaande items → geen mail.
export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const isCron = !!cronSecret && req.headers.get("x-cron-secret") === cronSecret;
  if (!isCron) {
    const session = await getSession(req);
    if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const items = await prisma.demoItem.findMany({
    where: { NOT: { location: { equals: "Kantoor", mode: "insensitive" } } },
    orderBy: [{ outSince: "asc" }, { product: "asc" }],
  });

  if (items.length === 0) {
    return NextResponse.json({ ok: true, sent: false, outstanding: 0 });
  }

  const esc = (v: string | null | undefined) =>
    String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const days = (d: Date | null) =>
    d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : null;

  const rows = items
    .map((i) => {
      const uitDagen = days(i.outSince);
      const wie = [i.contactName, i.phone, i.email].filter(Boolean).join(" · ");
      return `<tr>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${esc(i.product)}${i.qty > 1 ? ` (${i.qty}×)` : ""}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${esc(i.location)}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;">${esc(wie) || "—"}</td>
        <td style="padding:6px 8px;border-bottom:1px solid #e2e8f0;white-space:nowrap;">${uitDagen != null ? `${uitDagen} dagen` : "—"}</td>
      </tr>`;
    })
    .join("");

  const table = `<table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:8px;">
    <tr>
      <th style="text-align:left;padding:6px 8px;border-bottom:2px solid #cbd5e1;">Product</th>
      <th style="text-align:left;padding:6px 8px;border-bottom:2px solid #cbd5e1;">Locatie</th>
      <th style="text-align:left;padding:6px 8px;border-bottom:2px solid #cbd5e1;">Contact</th>
      <th style="text-align:left;padding:6px 8px;border-bottom:2px solid #cbd5e1;">Uit sinds</th>
    </tr>${rows}</table>`;

  const subject = `Demo-overzicht: ${items.length} item${items.length !== 1 ? "s" : ""} uitstaand`;
  const html = buildEmailHtml({
    companyName: "Distrixs CRM",
    subject,
    bodyLines: [
      `Er ${items.length === 1 ? "staat momenteel 1 demo-item" : `staan momenteel ${items.length} demo-items`} uit:`,
      "__DEMO_TABLE__",
      `Beheer in het CRM: ${process.env.NEXT_PUBLIC_BASE_URL ?? "https://crm.distrixs.nl"}/demo-items`,
    ],
    footerLines: ["Automatische wekelijkse reminder (maandag 08:00)."],
  }).replace('<p style="margin:0 0 12px 0;color:#374151;">__DEMO_TABLE__</p>', table);

  const to = process.env.DEMO_REMIND_EMAIL ?? "rolf@distrixs.nl";
  const result = await sendEmail({ to, subject, html });
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? "Versturen mislukt" }, { status: 500 });
  }

  await logSentEmail({
    category: "OTHER",
    to,
    subject,
    bodyHtml: html,
    relatedType: "DemoItem",
    relatedId: null,
    relatedLabel: "Demo-reminder",
    customerName: null,
    createdBy: null,
  }).catch(() => {});

  return NextResponse.json({ ok: true, sent: true, outstanding: items.length });
}
