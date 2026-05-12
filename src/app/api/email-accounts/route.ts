import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encryptPassword } from "@/lib/crypto";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const accounts = await prisma.emailAccount.findMany({
    select: {
      id: true, label: true, host: true, port: true,
      secure: true, username: true, isActive: true, lastSyncAt: true,
      _count: { select: { emails: true } },
    },
    orderBy: { label: "asc" },
  });
  return NextResponse.json(accounts);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });

  const body = await req.json() as {
    label: string; host: string; port: number; secure: boolean;
    username: string; password: string;
  };

  if (!body.host || !body.username || !body.password) {
    return NextResponse.json({ error: "host, username en password zijn verplicht" }, { status: 400 });
  }

  const account = await prisma.emailAccount.create({
    data: {
      label: body.label || body.username,
      host: body.host,
      port: body.port ?? 993,
      secure: body.secure ?? true,
      username: body.username,
      password: encryptPassword(body.password),
    },
  });

  return NextResponse.json({ id: account.id, label: account.label });
}
