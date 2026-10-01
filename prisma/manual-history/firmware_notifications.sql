-- CreateEnum
CREATE TYPE "FirmwareRegistrationSource" AS ENUM ('MANUAL', 'INVOICE', 'SELF');

-- CreateEnum
CREATE TYPE "FirmwareRegistrationStatus" AS ENUM ('PENDING', 'ACTIVE', 'UNSUBSCRIBED');

-- CreateEnum
CREATE TYPE "FirmwareNotificationStatus" AS ENUM ('SENT', 'FAILED');

-- CreateTable
CREATE TABLE "firmware_products" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'acme',
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "model" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "firmware_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "firmware_releases" (
    "id" TEXT NOT NULL,
    "firmware_product_id" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "file_title" TEXT NOT NULL,
    "build" TEXT,
    "release_date" TIMESTAMP(3),
    "download_url" TEXT NOT NULL,
    "release_notes" TEXT,
    "is_baseline" BOOLEAN NOT NULL DEFAULT false,
    "notified_at" TIMESTAMP(3),
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "firmware_releases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_firmware_links" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "firmware_product_id" TEXT NOT NULL,
    "is_suggested" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_firmware_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "firmware_registrations" (
    "id" TEXT NOT NULL,
    "firmware_product_id" TEXT NOT NULL,
    "customer_id" TEXT,
    "contact_id" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "company_name" TEXT,
    "serial_number" TEXT,
    "source" "FirmwareRegistrationSource" NOT NULL DEFAULT 'MANUAL',
    "status" "FirmwareRegistrationStatus" NOT NULL DEFAULT 'ACTIVE',
    "token" TEXT NOT NULL,
    "confirmed_at" TIMESTAMP(3),
    "unsubscribed_at" TIMESTAMP(3),
    "last_notified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "firmware_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "firmware_notifications" (
    "id" TEXT NOT NULL,
    "release_id" TEXT NOT NULL,
    "registration_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" "FirmwareNotificationStatus" NOT NULL DEFAULT 'SENT',
    "error" TEXT,
    "opened_at" TIMESTAMP(3),
    "downloaded_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "firmware_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "firmware_sync_runs" (
    "id" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "pages_fetched" INTEGER NOT NULL DEFAULT 0,
    "releases_seen" INTEGER NOT NULL DEFAULT 0,
    "new_releases" INTEGER NOT NULL DEFAULT 0,
    "notifications_sent" INTEGER NOT NULL DEFAULT 0,
    "ok" BOOLEAN NOT NULL DEFAULT true,
    "error" TEXT,

    CONSTRAINT "firmware_sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "firmware_products_slug_key" ON "firmware_products"("slug");

-- CreateIndex
CREATE INDEX "firmware_products_name_idx" ON "firmware_products"("name");

-- CreateIndex
CREATE INDEX "firmware_releases_firmware_product_id_idx" ON "firmware_releases"("firmware_product_id");

-- CreateIndex
CREATE INDEX "firmware_releases_release_date_idx" ON "firmware_releases"("release_date");

-- CreateIndex
CREATE INDEX "firmware_releases_notified_at_idx" ON "firmware_releases"("notified_at");

-- CreateIndex
CREATE UNIQUE INDEX "firmware_releases_download_url_key" ON "firmware_releases"("download_url");

-- CreateIndex
CREATE INDEX "product_firmware_links_firmware_product_id_idx" ON "product_firmware_links"("firmware_product_id");

-- CreateIndex
CREATE UNIQUE INDEX "product_firmware_links_product_id_firmware_product_id_key" ON "product_firmware_links"("product_id", "firmware_product_id");

-- CreateIndex
CREATE UNIQUE INDEX "firmware_registrations_token_key" ON "firmware_registrations"("token");

-- CreateIndex
CREATE INDEX "firmware_registrations_customer_id_idx" ON "firmware_registrations"("customer_id");

-- CreateIndex
CREATE INDEX "firmware_registrations_status_idx" ON "firmware_registrations"("status");

-- CreateIndex
CREATE UNIQUE INDEX "firmware_registrations_firmware_product_id_email_key" ON "firmware_registrations"("firmware_product_id", "email");

-- CreateIndex
CREATE INDEX "firmware_notifications_registration_id_idx" ON "firmware_notifications"("registration_id");

-- CreateIndex
CREATE UNIQUE INDEX "firmware_notifications_release_id_registration_id_key" ON "firmware_notifications"("release_id", "registration_id");

-- CreateIndex
CREATE INDEX "firmware_sync_runs_started_at_idx" ON "firmware_sync_runs"("started_at");

-- AddForeignKey
ALTER TABLE "firmware_releases" ADD CONSTRAINT "firmware_releases_firmware_product_id_fkey" FOREIGN KEY ("firmware_product_id") REFERENCES "firmware_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_firmware_links" ADD CONSTRAINT "product_firmware_links_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_firmware_links" ADD CONSTRAINT "product_firmware_links_firmware_product_id_fkey" FOREIGN KEY ("firmware_product_id") REFERENCES "firmware_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "firmware_registrations" ADD CONSTRAINT "firmware_registrations_firmware_product_id_fkey" FOREIGN KEY ("firmware_product_id") REFERENCES "firmware_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "firmware_registrations" ADD CONSTRAINT "firmware_registrations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "firmware_registrations" ADD CONSTRAINT "firmware_registrations_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "customer_contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "firmware_notifications" ADD CONSTRAINT "firmware_notifications_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "firmware_releases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "firmware_notifications" ADD CONSTRAINT "firmware_notifications_registration_id_fkey" FOREIGN KEY ("registration_id") REFERENCES "firmware_registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

