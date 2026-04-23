import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import * as dotenv from "dotenv";

dotenv.config();

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const password = await bcrypt.hash("Distrixs2024!", 10);

  const user = await prisma.user.upsert({
    where: { email: "rolf@distrixs.nl" },
    update: {},
    create: {
      name: "Rolf Schild",
      email: "rolf@distrixs.nl",
      passwordHash: password,
      role: "ADMIN",
      isActive: true,
    },
  });

  console.log(`Gebruiker aangemaakt: ${user.email}`);
  console.log(`Wachtwoord: Distrixs2024!`);
  console.log(`Verander dit wachtwoord na de eerste login!`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
