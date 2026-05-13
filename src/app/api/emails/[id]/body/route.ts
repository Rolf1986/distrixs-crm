import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(req);
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { id } = await params;

  const email = await prisma.email.findUnique({
    where: { id },
    select: { bodyText: true, bodyHtml: true, accountId: true, uid: true },
  });

  if (!email) return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });

  // Body al opgeslagen
  if (email.bodyHtml) return NextResponse.json({ body: email.bodyHtml });
  if (email.bodyText) return NextResponse.json({ body: `<pre class="whitespace-pre-wrap text-sm">${escapeHtml(email.bodyText)}</pre>` });

  // Haal op via IMAP als uid beschikbaar
  if (email.uid) {
    try {
      const { fetchEmailBody } = await import("@/lib/imap");
      const text = await fetchEmailBody(email.accountId, email.uid);
      if (text) {
        await prisma.email.update({ where: { id }, data: { bodyText: text } });
        return NextResponse.json({
          body: `<pre class="whitespace-pre-wrap text-sm">${escapeHtml(text)}</pre>`,
        });
      }
    } catch {
      // IMAP fout — geef null terug
    }
  }

  return NextResponse.json({ body: null });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
