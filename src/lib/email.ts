/**
 * Email helper — gebruikt Resend als RESEND_API_KEY beschikbaar is.
 * Zonder key logt het naar console (development fallback).
 */

interface SendEmailOptions {
  to: string | string[];
  cc?: string[];
  subject: string;
  html: string;
  attachments?: Array<{ filename: string; content: Buffer }>;
}

interface SendResult {
  ok: boolean;
  id?: string;
  error?: string;
  simulated?: boolean;
}

export async function sendEmail(opts: SendEmailOptions): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "Distrixs CRM <noreply@distrixs.nl>";

  if (!apiKey) {
    // Development fallback — logt naar console
    console.log("📧 [EMAIL SIMULATIE — stel RESEND_API_KEY in om echt te versturen]");
    console.log("   Aan:     ", Array.isArray(opts.to) ? opts.to.join(", ") : opts.to);
    console.log("   Onderwerp:", opts.subject);
    if (opts.attachments?.length) {
      console.log("   Bijlagen: ", opts.attachments.map((a) => a.filename).join(", "));
    }
    return { ok: true, id: "simulated-" + Date.now(), simulated: true };
  }

  try {
    const body: Record<string, unknown> = {
      from,
      to: Array.isArray(opts.to) ? opts.to : [opts.to],
      subject: opts.subject,
      html: opts.html,
    };

    if (opts.cc?.length) body.cc = opts.cc;

    if (opts.attachments?.length) {
      body.attachments = opts.attachments.map((a) => ({
        filename: a.filename,
        content: a.content.toString("base64"),
      }));
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await res.json() as { id?: string; message?: string };
    if (!res.ok) {
      return { ok: false, error: data.message ?? "Resend API fout" };
    }
    return { ok: true, id: data.id };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/** Genereer een eenvoudige HTML e-mail met Distrixs-stijl */
export function buildEmailHtml(opts: {
  companyName: string;
  recipientName?: string;
  subject: string;
  bodyLines: string[];
  ctaUrl?: string;
  ctaLabel?: string;
  footerLines?: string[];
}): string {
  const { companyName, recipientName, bodyLines, ctaUrl, ctaLabel, footerLines } = opts;

  const greeting = recipientName ? `Beste ${recipientName},` : "Geachte relatie,";

  const body = bodyLines.map((l) => `<p style="margin:0 0 12px 0;color:#374151;">${l}</p>`).join("");

  const cta = ctaUrl && ctaLabel
    ? `<div style="margin:24px 0;"><a href="${ctaUrl}" style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block;">${ctaLabel}</a></div>`
    : "";

  const footer = footerLines?.length
    ? footerLines.map((l) => `<p style="margin:0 0 4px 0;">${l}</p>`).join("")
    : "";

  return `<!DOCTYPE html>
<html lang="nl">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <!-- Header -->
    <div style="background:#1e40af;padding:24px 32px;">
      <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700;">${companyName}</h1>
    </div>
    <!-- Body -->
    <div style="padding:32px;">
      <p style="margin:0 0 20px 0;color:#374151;">${greeting}</p>
      ${body}
      ${cta}
      <p style="margin:24px 0 0 0;color:#374151;">Met vriendelijke groet,<br><strong>${companyName}</strong></p>
    </div>
    <!-- Footer -->
    ${footer ? `<div style="background:#f1f5f9;padding:16px 32px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;">${footer}</div>` : ""}
  </div>
</body>
</html>`;
}
