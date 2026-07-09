import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/authz";
import bcrypt from "bcryptjs";

const VALID_ROLES = ["ADMIN", "SALES", "FINANCE", "VIEWER"] as const;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Alleen beheerders mogen gebruikers wijzigen
  const auth = await requireRole(req, "ADMIN");
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { id } = await params;
  const body = await req.json();

  // Zelfbescherming: een beheerder kan zichzelf niet degraderen of deactiveren
  // (voorkomt uitsluiting van álle admins uit het systeem)
  const editingSelf = id === auth.user.id;

  const data: Record<string, unknown> = {};
  if ("name" in body && body.name?.trim()) data.name = body.name.trim();
  if ("role" in body) {
    if (!VALID_ROLES.includes(body.role)) {
      return NextResponse.json({ error: "Ongeldige rol" }, { status: 400 });
    }
    if (editingSelf && body.role !== "ADMIN") {
      return NextResponse.json({ error: "Je kunt je eigen beheerdersrol niet wijzigen" }, { status: 400 });
    }
    data.role = body.role;
  }
  if ("isActive" in body) {
    if (editingSelf && body.isActive === false) {
      return NextResponse.json({ error: "Je kunt je eigen account niet deactiveren" }, { status: 400 });
    }
    data.isActive = body.isActive;
  }
  if ("password" in body && body.password?.trim()) {
    data.passwordHash = await bcrypt.hash(body.password, 12);
  }

  const user = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, name: true, email: true, role: true, isActive: true, lastLoginAt: true, createdAt: true },
  });

  return NextResponse.json(user);
}
