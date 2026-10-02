-- Serienummers ook op offerteregels (kopiëren mee naar de factuur)
ALTER TABLE "quote_lines" ADD COLUMN "serial_numbers" TEXT;
