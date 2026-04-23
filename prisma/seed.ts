import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import * as dotenv from "dotenv";

dotenv.config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  // ── Gebruiker ────────────────────────────────────────────────────────────────
  const password = await bcrypt.hash("Distrixs2024!", 10);
  const user = await prisma.user.upsert({
    where: { email: "rolf@distrixs.nl" },
    update: {},
    create: { name: "Rolf Schild", email: "rolf@distrixs.nl", passwordHash: password, role: "ADMIN", isActive: true },
  });

  // ── Klanten ──────────────────────────────────────────────────────────────────
  const klant1 = await prisma.customer.upsert({
    where: { customerNumber: "K-2024-001" },
    update: {},
    create: {
      customerNumber: "K-2024-001",
      companyName: "Eventbureau De Linden BV",
      kvkNumber: "12345678",
      vatNumber: "NL123456789B01",
      vatCountry: "NL",
      defaultPaymentTerm: "DAYS_30",
      status: "ACTIVE",
      addresses: {
        create: {
          type: "BILLING", isDefault: true,
          street: "Hoofdstraat", houseNumber: "42",
          postalCode: "1234 AB", city: "Amsterdam", country: "NL",
        },
      },
      contacts: {
        create: {
          firstName: "Sophie", lastName: "van den Berg",
          email: "sophie@delinden.nl", phone: "0612345678",
          roleOrFunction: "Inkoper", isPrimary: true, isActive: true,
        },
      },
    },
  });

  const klant2 = await prisma.customer.upsert({
    where: { customerNumber: "K-2024-002" },
    update: {},
    create: {
      customerNumber: "K-2024-002",
      companyName: "Promotions Plus BV",
      kvkNumber: "87654321",
      vatNumber: "NL987654321B01",
      vatCountry: "NL",
      defaultPaymentTerm: "DAYS_14",
      status: "ACTIVE",
      addresses: {
        create: {
          type: "BILLING", isDefault: true,
          street: "Industrieweg", houseNumber: "8",
          postalCode: "5678 CD", city: "Rotterdam", country: "NL",
        },
      },
      contacts: {
        create: {
          firstName: "Mark", lastName: "Jansen",
          email: "mark@promotionsplus.nl", phone: "0698765432",
          roleOrFunction: "Directeur", isPrimary: true, isActive: true,
        },
      },
    },
  });

  // ── Leveranciers ─────────────────────────────────────────────────────────────
  const supplierEU = await prisma.supplier.upsert({
    where: { id: "supplier-eu-001" },
    update: {},
    create: {
      id: "supplier-eu-001",
      name: "PrintPro Nederland", supplierType: "EU",
      defaultCurrency: "EUR", email: "info@printpro.nl", isActive: true,
    },
  });

  const supplierCN = await prisma.supplier.upsert({
    where: { id: "supplier-cn-001" },
    update: {},
    create: {
      id: "supplier-cn-001",
      name: "Guangzhou Promo Factory", supplierType: "CHINA",
      defaultCurrency: "USD", email: "sales@gpfactory.cn", isActive: true,
    },
  });

  // ── Producten ────────────────────────────────────────────────────────────────
  const gobo = await prisma.product.upsert({
    where: { sku: "GOBO-GLAS-001" },
    update: {},
    create: {
      sku: "GOBO-GLAS-001", title: "Gobo glas standaard 86mm",
      supplierId: supplierEU.id, productType: "gobo",
      isStaffelProduct: true, staffelGroupCode: "GOBO-GLAS",
      advisorySellPrice: 45.00, baseCostPrice: 18.00, unit: "stuk", isActive: true,
      priceTiers: {
        create: [
          { minQty: 1, maxQty: 9, unitPrice: 45.00 },
          { minQty: 10, maxQty: 49, unitPrice: 39.00 },
          { minQty: 50, maxQty: null, unitPrice: 33.00 },
        ],
      },
    },
  });

  const banner = await prisma.product.upsert({
    where: { sku: "BANNER-ROLL-001" },
    update: {},
    create: {
      sku: "BANNER-ROLL-001", title: "Roll-up banner 85x200cm",
      supplierId: supplierCN.id, productType: "banner",
      isStaffelProduct: false,
      advisorySellPrice: 89.00, baseCostPrice: 22.00, unit: "stuk", isActive: true,
    },
  });

  const tas = await prisma.product.upsert({
    where: { sku: "TAS-COTTON-001" },
    update: {},
    create: {
      sku: "TAS-COTTON-001", title: "Katoenen draagtas met opdruk",
      supplierId: supplierCN.id, productType: "tas",
      isStaffelProduct: true, staffelGroupCode: "TAS-COTTON",
      advisorySellPrice: 4.50, baseCostPrice: 0.95, unit: "stuk", isActive: true,
      priceTiers: {
        create: [
          { minQty: 1, maxQty: 99, unitPrice: 4.50 },
          { minQty: 100, maxQty: 499, unitPrice: 3.75 },
          { minQty: 500, maxQty: null, unitPrice: 2.95 },
        ],
      },
    },
  });

  // ── Deals ────────────────────────────────────────────────────────────────────
  const contact1 = await prisma.customerContact.findFirst({ where: { customerId: klant1.id } });
  const contact2 = await prisma.customerContact.findFirst({ where: { customerId: klant2.id } });

  const deal1 = await prisma.deal.upsert({
    where: { dealNumber: "D-2024-001" },
    update: {},
    create: {
      dealNumber: "D-2024-001",
      title: "Gobo-pakket Festival Linden 2024",
      customerId: klant1.id,
      primaryContactId: contact1?.id,
      status: "QUOTE_SENT",
      expectedCloseDate: new Date("2024-06-15"),
      notes: "Klant wil levering voor 1 juni. Glasgobo's met logo.",
      createdBy: user.id,
      lines: {
        create: [
          {
            productId: gobo.id,
            skuSnapshot: gobo.sku, titleSnapshot: gobo.title,
            supplierIdSnapshot: supplierEU.id, supplierTypeSnapshot: "EU",
            qty: 25, grossUnitPrice: 39.00, discountPercent: 5,
            netLineTotal: 25 * 39.00 * 0.95,
            baseCostSnapshot: 18.00,
            expectedCostTotal: 25 * 18.00,
            expectedMarginTotal: (25 * 39.00 * 0.95) - (25 * 18.00),
          },
        ],
      },
    },
  });

  const deal2 = await prisma.deal.upsert({
    where: { dealNumber: "D-2024-002" },
    update: {},
    create: {
      dealNumber: "D-2024-002",
      title: "Promopakket beurs 2024 – 500 tassen + 10 banners",
      customerId: klant2.id,
      primaryContactId: contact2?.id,
      status: "NEW",
      expectedCloseDate: new Date("2024-08-01"),
      notes: "Grote order voor beurs in september. China-levering vereist.",
      createdBy: user.id,
      lines: {
        create: [
          {
            productId: tas.id,
            skuSnapshot: tas.sku, titleSnapshot: tas.title,
            supplierIdSnapshot: supplierCN.id, supplierTypeSnapshot: "CHINA",
            qty: 500, grossUnitPrice: 2.95, discountPercent: 0,
            netLineTotal: 500 * 2.95,
            baseCostSnapshot: 0.95,
            expectedCostTotal: 500 * 0.95 * (1 + 0.08 + 0.06),
            expectedMarginTotal: (500 * 2.95) - (500 * 0.95 * 1.14),
          },
          {
            productId: banner.id,
            skuSnapshot: banner.sku, titleSnapshot: banner.title,
            supplierIdSnapshot: supplierCN.id, supplierTypeSnapshot: "CHINA",
            qty: 10, grossUnitPrice: 89.00, discountPercent: 10,
            netLineTotal: 10 * 89.00 * 0.90,
            baseCostSnapshot: 22.00,
            expectedCostTotal: 10 * 22.00 * 1.14,
            expectedMarginTotal: (10 * 89.00 * 0.90) - (10 * 22.00 * 1.14),
          },
        ],
      },
    },
  });

  await prisma.deal.upsert({
    where: { dealNumber: "D-2024-003" },
    update: {},
    create: {
      dealNumber: "D-2024-003",
      title: "Jaarcontract drukwerk Q3-Q4",
      customerId: klant1.id,
      primaryContactId: contact1?.id,
      status: "WON",
      expectedCloseDate: new Date("2024-04-01"),
      createdBy: user.id,
      lines: {
        create: [
          {
            productId: gobo.id,
            skuSnapshot: gobo.sku, titleSnapshot: gobo.title,
            supplierIdSnapshot: supplierEU.id, supplierTypeSnapshot: "EU",
            qty: 60, grossUnitPrice: 33.00, discountPercent: 0,
            netLineTotal: 60 * 33.00,
            baseCostSnapshot: 18.00,
            expectedCostTotal: 60 * 18.00,
            expectedMarginTotal: (60 * 33.00) - (60 * 18.00),
          },
        ],
      },
    },
  });

  console.log("Seed compleet.");
  console.log(`Deals aangemaakt: D-2024-001, D-2024-002, D-2024-003`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
