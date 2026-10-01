-- MAIL-02: afleverstatus van verzonden mails via de Resend-webhook
ALTER TABLE "sent_emails" ADD COLUMN "resend_id" TEXT;
ALTER TABLE "sent_emails" ADD COLUMN "delivery_status" TEXT;
ALTER TABLE "sent_emails" ADD COLUMN "delivery_detail" TEXT;
ALTER TABLE "sent_emails" ADD COLUMN "delivery_at" TIMESTAMP(3);
CREATE INDEX "sent_emails_resend_id_idx" ON "sent_emails"("resend_id");
