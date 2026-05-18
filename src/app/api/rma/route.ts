import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { nextRmaNumber } from "@/lib/sequences";
import { sendEmail } from "@/lib/email";

const REASON_LABELS: Record<string, Record<string, string>> = {
  nl: {
    DEFECTIVE: "Defect product",
    WRONG_PRODUCT: "Verkeerd product geleverd",
    DAMAGED: "Beschadigd bij levering",
    NOT_AS_DESCRIBED: "Niet zoals beschreven",
    CHANGED_MIND: "Van gedachten veranderd",
    OTHER: "Anders",
  },
  en: {
    DEFECTIVE: "Defective product",
    WRONG_PRODUCT: "Wrong product delivered",
    DAMAGED: "Damaged during delivery",
    NOT_AS_DESCRIBED: "Not as described",
    CHANGED_MIND: "Changed my mind",
    OTHER: "Other",
  },
};

function buildConfirmationEmail(opts: {
  lang: string;
  name: string;
  rmaNumber: string;
  productDescription: string;
  reason: string;
  orderReference?: string | null;
}): { subject: string; html: string } {
  const isEn = opts.lang === "en";
  const reasonLabel = REASON_LABELS[isEn ? "en" : "nl"][opts.reason] ?? opts.reason;

  if (isEn) {
    const subject = `Return Request Received — ${opts.rmaNumber}`;
    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <div style="background:#1e40af;padding:24px 32px;">
      <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700;">Distrixs</h1>
    </div>
    <div style="padding:32px;">
      <p style="margin:0 0 20px 0;color:#374151;">Dear ${opts.name},</p>
      <p style="margin:0 0 16px 0;color:#374151;">We have received your return request. Below is a summary of your submission.</p>

      <div style="background:#f1f5f9;border-radius:8px;padding:20px;margin:20px 0;">
        <p style="margin:0 0 8px 0;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Your RMA Number</p>
        <p style="margin:0;font-size:28px;font-weight:700;font-family:monospace;color:#1e293b;letter-spacing:0.1em;">${opts.rmaNumber}</p>
        <p style="margin:6px 0 0 0;font-size:12px;color:#64748b;">Please keep this number for your records.</p>
      </div>

      <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px;">
        <tr style="border-bottom:1px solid #e2e8f0;">
          <td style="padding:10px 0;color:#64748b;width:40%;">Product</td>
          <td style="padding:10px 0;color:#1e293b;font-weight:500;">${opts.productDescription}</td>
        </tr>
        ${opts.orderReference ? `<tr style="border-bottom:1px solid #e2e8f0;">
          <td style="padding:10px 0;color:#64748b;">Order / Invoice</td>
          <td style="padding:10px 0;color:#1e293b;">${opts.orderReference}</td>
        </tr>` : ""}
        <tr>
          <td style="padding:10px 0;color:#64748b;">Reason</td>
          <td style="padding:10px 0;color:#1e293b;">${reasonLabel}</td>
        </tr>
      </table>

      <p style="margin:20px 0 0 0;color:#374151;">Our team will review your request and contact you within 2 business days.</p>
      <p style="margin:12px 0 0 0;color:#374151;">Kind regards,<br><strong>Distrixs</strong></p>
    </div>
    <div style="background:#f1f5f9;padding:16px 32px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;">
      <p style="margin:0;">Questions? Contact us at <a href="mailto:info@distrixs.nl" style="color:#2563eb;">info@distrixs.nl</a></p>
    </div>
  </div>
</body>
</html>`;
    return { subject, html };
  }

  // Dutch
  const subject = `Retourverzoek ontvangen — ${opts.rmaNumber}`;
  const html = `<!DOCTYPE html>
<html lang="nl">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <div style="background:#1e40af;padding:24px 32px;">
      <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700;">Distrixs</h1>
    </div>
    <div style="padding:32px;">
      <p style="margin:0 0 20px 0;color:#374151;">Beste ${opts.name},</p>
      <p style="margin:0 0 16px 0;color:#374151;">We hebben je retourverzoek in goede orde ontvangen. Hieronder vind je een samenvatting van je aanvraag.</p>

      <div style="background:#f1f5f9;border-radius:8px;padding:20px;margin:20px 0;">
        <p style="margin:0 0 8px 0;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Jouw RMA-nummer</p>
        <p style="margin:0;font-size:28px;font-weight:700;font-family:monospace;color:#1e293b;letter-spacing:0.1em;">${opts.rmaNumber}</p>
        <p style="margin:6px 0 0 0;font-size:12px;color:#64748b;">Bewaar dit nummer voor je administratie.</p>
      </div>

      <table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px;">
        <tr style="border-bottom:1px solid #e2e8f0;">
          <td style="padding:10px 0;color:#64748b;width:40%;">Product</td>
          <td style="padding:10px 0;color:#1e293b;font-weight:500;">${opts.productDescription}</td>
        </tr>
        ${opts.orderReference ? `<tr style="border-bottom:1px solid #e2e8f0;">
          <td style="padding:10px 0;color:#64748b;">Ordernummer</td>
          <td style="padding:10px 0;color:#1e293b;">${opts.orderReference}</td>
        </tr>` : ""}
        <tr>
          <td style="padding:10px 0;color:#64748b;">Reden</td>
          <td style="padding:10px 0;color:#1e293b;">${reasonLabel}</td>
        </tr>
      </table>

      <p style="margin:20px 0 0 0;color:#374151;">Ons team bekijkt je verzoek en neemt binnen 2 werkdagen contact met je op.</p>
      <p style="margin:12px 0 0 0;color:#374151;">Met vriendelijke groet,<br><strong>Distrixs</strong></p>
    </div>
    <div style="background:#f1f5f9;padding:16px 32px;border-top:1px solid #e2e8f0;font-size:12px;color:#64748b;">
      <p style="margin:0;">Vragen? Stuur een mail naar <a href="mailto:info@distrixs.nl" style="color:#2563eb;">info@distrixs.nl</a></p>
    </div>
  </div>
</body>
</html>`;
  return { subject, html };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      submittedName,
      submittedEmail,
      submittedPhone,
      submittedCompany,
      orderReference,
      productDescription,
      serialNumber,
      purchaseDate,
      quantity,
      reason,
      description,
      language,
    } = body;

    if (!submittedName || !submittedEmail || !productDescription || !reason || !description) {
      return NextResponse.json({ error: "Verplichte velden ontbreken" }, { status: 400 });
    }

    const year = new Date().getFullYear();
    const rmaNumber = await nextRmaNumber(year);

    const rma = await prisma.rma.create({
      data: {
        rmaNumber,
        submittedName,
        submittedEmail,
        submittedPhone: submittedPhone || null,
        submittedCompany: submittedCompany || null,
        orderReference: orderReference || null,
        productDescription,
        serialNumber: serialNumber || null,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : null,
        quantity: quantity ? Number(quantity) : 1,
        reason,
        description,
      },
    });

    // Stuur bevestigingsmail naar de klant
    const lang = (language === "en" ? "en" : "nl");
    const { subject, html } = buildConfirmationEmail({
      lang,
      name: submittedName,
      rmaNumber,
      productDescription,
      reason,
      orderReference: orderReference || null,
    });

    await sendEmail({ to: submittedEmail, subject, html });

    return NextResponse.json({ success: true, id: rma.id, rmaNumber: rma.rmaNumber });
  } catch (error) {
    console.error("RMA create error:", error);
    return NextResponse.json({ error: "Interne fout" }, { status: 500 });
  }
}
