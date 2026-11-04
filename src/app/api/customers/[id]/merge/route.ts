import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { logAudit, clientIpFromRequest } from "@/lib/audit";
import type { Prisma } from "@/generated/prisma";

/**
 * Voegt een dubbele klant samen in deze klant: alle gekoppelde records
 * (deals, documenten, contacten, adressen, óók server-only tabellen zoals
 * firmware-registraties) verhuizen hierheen, daarna wordt het duplicaat
 * verwijderd. De verwijzende tabellen worden dynamisch uit de database
 * gelezen, zodat niets kan achterblijven als het schema groeit.
 */

type FkRow = { table_name: string; column_name: string };

async function fkColumns(
  tx: Prisma.TransactionClient,
  referencedTable: string
): Promise<FkRow[]> {
  return tx.$queryRaw<FkRow[]>`
    SELECT tc.table_name::text, kcu.column_name::text
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON kcu.constraint_name = tc.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = ${referencedTable}
  `;
}

// Identifiers komen uit information_schema (geen gebruikersinvoer), maar we
// staan voor de zekerheid alleen gewone tabel-/kolomnamen toe
const SAFE_IDENT = /^[a-z0-9_]+$/;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession(req);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Niet ingelogd" }, { status: 401 });
  }

  const { id: targetId } = await params;
  const { duplicateId } = (await req.json()) as { duplicateId?: string };

  if (!duplicateId || typeof duplicateId !== "string") {
    return NextResponse.json({ error: "Geen klant gekozen" }, { status: 400 });
  }
  if (duplicateId === targetId) {
    return NextResponse.json({ error: "Kies een andere klant dan deze" }, { status: 400 });
  }

  const [target, duplicate] = await Promise.all([
    prisma.customer.findUnique({ where: { id: targetId } }),
    prisma.customer.findUnique({ where: { id: duplicateId } }),
  ]);
  if (!target || !duplicate) {
    return NextResponse.json({ error: "Klant niet gevonden" }, { status: 404 });
  }

  try {
    await prisma.$transaction(async (tx) => {
      // 1. Contacten: dubbele (zelfde e-mail of zelfde naam) laten opgaan in
      //    het bestaande contact; de rest verhuist mee
      const [targetContacts, dupContacts, contactFks] = await Promise.all([
        tx.customerContact.findMany({ where: { customerId: targetId } }),
        tx.customerContact.findMany({ where: { customerId: duplicateId } }),
        fkColumns(tx, "customer_contacts"),
      ]);
      const targetHasPrimary = targetContacts.some((c) => c.isPrimary);

      for (const dc of dupContacts) {
        const match = targetContacts.find(
          (tc2) =>
            (dc.email && tc2.email && dc.email.toLowerCase() === tc2.email.toLowerCase()) ||
            `${dc.firstName} ${dc.lastName}`.trim().toLowerCase() ===
              `${tc2.firstName} ${tc2.lastName}`.trim().toLowerCase()
        );
        if (match) {
          for (const fk of contactFks) {
            if (!SAFE_IDENT.test(fk.table_name) || !SAFE_IDENT.test(fk.column_name)) continue;
            await tx.$executeRawUnsafe(
              `UPDATE "${fk.table_name}" SET "${fk.column_name}" = $1 WHERE "${fk.column_name}" = $2`,
              match.id,
              dc.id
            );
          }
          await tx.customerContact.delete({ where: { id: dc.id } });
        } else {
          await tx.customerContact.update({
            where: { id: dc.id },
            data: {
              customerId: targetId,
              isPrimary: dc.isPrimary && !targetHasPrimary,
            },
          });
        }
      }

      // 2. Adressen: identieke overslaan (verwijderen), rest verhuist zonder
      //    de bestaande standaardadressen te verdringen
      const [targetAddrs, dupAddrs] = await Promise.all([
        tx.customerAddress.findMany({ where: { customerId: targetId } }),
        tx.customerAddress.findMany({ where: { customerId: duplicateId } }),
      ]);
      for (const da of dupAddrs) {
        const identical = targetAddrs.find(
          (ta) =>
            ta.street.trim().toLowerCase() === da.street.trim().toLowerCase() &&
            ta.houseNumber.trim().toLowerCase() === da.houseNumber.trim().toLowerCase() &&
            ta.postalCode.replace(/\s/g, "").toLowerCase() === da.postalCode.replace(/\s/g, "").toLowerCase()
        );
        if (identical) {
          await tx.customerAddress.delete({ where: { id: da.id } });
        } else {
          const targetHasDefault = targetAddrs.some((ta) => ta.type === da.type && ta.isDefault);
          await tx.customerAddress.update({
            where: { id: da.id },
            data: { customerId: targetId, isDefault: da.isDefault && !targetHasDefault },
          });
        }
      }

      // 3. Prijslijsten: regels voor producten die de doelklant al heeft vervallen
      const targetPl = await tx.customerPricelist.findMany({
        where: { customerId: targetId },
        select: { productId: true },
      });
      const targetProductIds = targetPl.map((p) => p.productId);
      if (targetProductIds.length > 0) {
        await tx.customerPricelist.deleteMany({
          where: { customerId: duplicateId, productId: { in: targetProductIds } },
        });
      }

      // 4. Alle overige verwijzingen (deals, offertes, facturen, zendingen,
      //    RMA's, mails, webshop-accounts, firmware, …) dynamisch omhangen
      const customerFks = await fkColumns(tx, "customers");
      for (const fk of customerFks) {
        if (fk.table_name === "customer_contacts" || fk.table_name === "customer_addresses") continue;
        if (!SAFE_IDENT.test(fk.table_name) || !SAFE_IDENT.test(fk.column_name)) continue;
        await tx.$executeRawUnsafe(
          `UPDATE "${fk.table_name}" SET "${fk.column_name}" = $1 WHERE "${fk.column_name}" = $2`,
          targetId,
          duplicateId
        );
      }

      // 5. Ontbrekende bedrijfsgegevens van het duplicaat overnemen
      await tx.customer.update({
        where: { id: targetId },
        data: {
          email: target.email ?? duplicate.email,
          kvkNumber: target.kvkNumber ?? duplicate.kvkNumber,
          vatNumber: target.vatNumber ?? duplicate.vatNumber,
          vatCountry: target.vatCountry ?? duplicate.vatCountry,
          notes:
            target.notes && duplicate.notes && target.notes !== duplicate.notes
              ? `${target.notes}\n\n[Samengevoegd van ${duplicate.customerNumber}] ${duplicate.notes}`
              : target.notes ?? duplicate.notes,
        },
      });

      // 6. Duplicaat verwijderen
      await tx.customer.delete({ where: { id: duplicateId } });
    }, { timeout: 30000 });
  } catch (err) {
    console.error("[customer merge]", err);
    return NextResponse.json({ error: "Samenvoegen mislukt" }, { status: 500 });
  }

  await logAudit({
    userId: session.user.id,
    action: "customer.merge",
    entityType: "customer",
    entityId: targetId,
    oldValue: { duplicateId, duplicateNumber: duplicate.customerNumber, duplicateName: duplicate.companyName },
    newValue: { customerNumber: target.customerNumber },
    ip: clientIpFromRequest(req),
  });

  return NextResponse.json({ ok: true });
}
