-- SEC-04: sessie-intrekking via token-versie
ALTER TABLE "users" ADD COLUMN "token_version" INTEGER NOT NULL DEFAULT 0;

-- PRIV-02: markering voor geanonimiseerde klanten
ALTER TABLE "customers" ADD COLUMN "anonymized_at" TIMESTAMP(3);
