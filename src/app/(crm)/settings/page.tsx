import { prisma } from "@/lib/prisma";
import { CompanySettingsForm } from "./CompanySettingsForm";

async function getSettings() {
  return prisma.companySetting.findUnique({ where: { id: "singleton" } });
}

export default async function SettingsPage() {
  const settings = await getSettings();

  return <CompanySettingsForm initialSettings={settings} />;
}
