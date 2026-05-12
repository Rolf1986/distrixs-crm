import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Distrixs CRM",
  description: "CRM & ERP-light voor Distrixs",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="nl">
      <body>{children}</body>
    </html>
  );
}
