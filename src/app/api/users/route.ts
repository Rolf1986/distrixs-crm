import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser, requireRole } from "@/lib/authz";
import bcrypt from "bcryptjs";
import crypto from "crypto";

const VALID_ROLES = ["ADMIN", "SALES", "FINANCE", "VIEWER"] as const;

export async function GET(req: NextRequest) {
  const auth = await requireUser(req);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, isActive: true, lastLoginAt: true, createdAt: true },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });

  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  // Alleen beheerders mogen gebruikers aanmaken
  const auth = await requireRole(req, "ADMIN");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json();
  const { name, email, role = "SALES", password } = body;

  if (!name?.trim() || !email?.trim()) {
    return NextResponse.json({ error: "Naam en e-mail zijn verplicht" }, { status: 400 });
  }
  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: "Ongeldige rol" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (existing) {
    return NextResponse.json({ error: "Dit e-mailadres is al in gebruik" }, { status: 409 });
  }

  // Geen wachtwoord opgegeven → onbruikbaar CSPRNG-secret (account moet reset)
  const passwordHash = password
    ? await bcrypt.hash(password, 12)
    : await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 12);

  const user = await prisma.user.create({
    data: {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role,
      passwordHash,
      isActive: true,
    },
    select: { id: true, name: true, email: true, role: true, isActive: true, lastLoginAt: true, createdAt: true },
  });

  return NextResponse.json(user, { status: 201 });
}
