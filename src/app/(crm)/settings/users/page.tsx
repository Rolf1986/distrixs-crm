import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { UsersClient } from "./UsersClient";

async function getUsers() {
  return prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      lastLoginAt: true,
      createdAt: true,
    },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });
}

export default async function UsersPage() {
  // Alleen beheerders mogen gebruikersbeheer zien (backend dwingt dit ook af)
  const session = await getSession();
  const me = session?.user?.id
    ? await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } })
    : null;

  if (me?.role !== "ADMIN") {
    return (
      <div className="max-w-lg bg-white rounded-xl border border-slate-200 p-8 text-center">
        <p className="text-slate-700 font-medium">Geen toegang</p>
        <p className="text-sm text-slate-500 mt-1">
          Alleen beheerders kunnen gebruikers beheren.
        </p>
      </div>
    );
  }

  const users = await getUsers();

  return (
    <UsersClient
      initialUsers={users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        isActive: u.isActive,
        lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
        createdAt: u.createdAt.toISOString(),
      }))}
    />
  );
}
