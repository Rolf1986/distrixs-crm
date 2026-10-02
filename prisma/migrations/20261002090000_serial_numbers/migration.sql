-- Serienummers per factuurregel (PDF: onder het artikel of als bijlagepagina)
ALTER TABLE "invoice_lines" ADD COLUMN "serial_numbers" TEXT;
