import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { nextRmaNumber } from "@/lib/sequences";

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
    } = body;

    if (!submittedName || !submittedEmail || !productDescription || !reason || !description) {
      return NextResponse.json({ error: "Verplichte velden ontbreken" }, { status: 400 });
    }

    // Genereer uniek RMA-nummer
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

    return NextResponse.json({ success: true, id: rma.id, rmaNumber: rma.rmaNumber });
  } catch (error) {
    console.error("RMA create error:", error);
    return NextResponse.json({ error: "Interne fout" }, { status: 500 });
  }
}
