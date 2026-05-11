import { prisma } from "@/lib/prisma";

export interface CompanyInfo {
  companyName: string;
  logoUrl: string | null;
  addressLine1: string | null;
  city: string | null;
  postalCode: string | null;
  country: string;
  kvkNumber: string | null;
  vatNumber: string | null;
  iban: string | null;
  bic: string | null;
  bankName: string | null;
  email: string | null;
  phone: string | null;
  contactPersonName: string | null;
  contactPersonPhone: string | null;
  contactPersonEmail: string | null;
  termsNl: string | null;
  termsEn: string | null;
  quoteTerms: string | null;
  invoiceFooter: string | null;
  quoteEmailSubject: string | null;
  quoteEmailBody: string | null;
  invoiceEmailSubject: string | null;
  invoiceEmailBody: string | null;
  reminderEmailSubject: string | null;
  reminderEmailBody: string | null;
}

const DEFAULTS: CompanyInfo = {
  companyName: "Distrixs",
  logoUrl: "https://www.distrixs.nl/wp-content/uploads/2023/07/distrixs_logo_def.png",
  addressLine1: "Lorentzstraat 89",
  city: "Bleiswijk",
  postalCode: "2665 JG",
  country: "Nederland",
  kvkNumber: null,
  vatNumber: null,
  iban: null,
  bic: null,
  bankName: null,
  email: "info@distrixs.nl",
  phone: "+3110 - 223 01 87",
  contactPersonName: null,
  contactPersonPhone: null,
  contactPersonEmail: null,
  termsNl: null,
  termsEn: null,
  quoteTerms: null,
  invoiceFooter: null,
  quoteEmailSubject: null,
  quoteEmailBody: null,
  invoiceEmailSubject: null,
  invoiceEmailBody: null,
  reminderEmailSubject: null,
  reminderEmailBody: null,
};

export async function getCompanyInfo(): Promise<CompanyInfo> {
  const s = await prisma.companySetting.findUnique({ where: { id: "singleton" } });
  if (!s) return DEFAULTS;
  return {
    companyName: s.companyName,
    logoUrl: s.logoUrl ?? DEFAULTS.logoUrl,
    addressLine1: s.addressLine1 ?? DEFAULTS.addressLine1,
    city: s.city ?? DEFAULTS.city,
    postalCode: s.postalCode ?? DEFAULTS.postalCode,
    country: s.country,
    kvkNumber: s.kvkNumber,
    vatNumber: s.vatNumber,
    iban: s.iban,
    bic: s.bic,
    bankName: s.bankName,
    email: s.email ?? DEFAULTS.email,
    phone: s.phone ?? DEFAULTS.phone,
    contactPersonName: s.contactPersonName,
    contactPersonPhone: s.contactPersonPhone,
    contactPersonEmail: s.contactPersonEmail,
    termsNl: s.termsNl,
    termsEn: s.termsEn,
    quoteTerms: s.quoteTerms,
    invoiceFooter: s.invoiceFooter,
    quoteEmailSubject: s.quoteEmailSubject,
    quoteEmailBody: s.quoteEmailBody,
    invoiceEmailSubject: s.invoiceEmailSubject,
    invoiceEmailBody: s.invoiceEmailBody,
    reminderEmailSubject: s.reminderEmailSubject,
    reminderEmailBody: s.reminderEmailBody,
  };
}
