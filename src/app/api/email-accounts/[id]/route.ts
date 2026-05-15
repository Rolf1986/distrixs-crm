import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { encryptPassword } from "@/lib/crypto";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(req);
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { id } = await params;

  // Verwijder eerst alle gekoppelde e-mails
  await prisma.email.deleteMany({ where: { accountId: id } });
  await prisma.emailAccount.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(req);
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const { id } = await params;
  const body = await req.json() as {
    label?: string; host?: string; port?: number;
    secure?: boolean; username?: string; password?: string;
  };

  const data: Record<string, unknown> = {};
  if (body.label !== undefined) data.label = body.label;
  if (body.host !== undefined) data.host = body.host;
  if (body.port !== undefined) data.port = body.port;
  if (body.secure !== undefined) data.secure = body.secure;
  if (body.username !== undefined) data.username = body.username;
  if (body.password) data.password = encryptPassword(body.password);

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Geen velden om bij te werken" }, { status: 400 });
  }

  const account = await prisma.emailAccount.update({ where: { id }, data });
  return NextResponse.json({ id: account.id });
}
