-- Phase 6: document metadata and review workflow.
-- Document bytes are not stored in Postgres; storage_key points to private object storage once upload plumbing lands.

CREATE TYPE "DocumentStatus" AS ENUM ('UPLOADED', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'EXPIRED');
CREATE TYPE "DocumentVisibility" AS ENUM ('INTERNAL_ONLY', 'LANDLORD_SAFE');
CREATE TYPE "DocumentStorageStatus" AS ENUM ('METADATA_ONLY', 'STORED_QUARANTINED', 'STORED_AVAILABLE', 'DELETED');

CREATE TABLE "documents" (
  "id" TEXT NOT NULL,
  "org_id" TEXT NOT NULL,
  "client_id" TEXT NOT NULL,
  "case_id" TEXT,
  "checklist_item_id" TEXT,
  "uploaded_by_id" TEXT NOT NULL,
  "reviewed_by_id" TEXT,
  "file_name" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "size_bytes" INTEGER NOT NULL,
  "sha256" TEXT NOT NULL,
  "storage_key" TEXT,
  "storage_status" "DocumentStorageStatus" NOT NULL DEFAULT 'METADATA_ONLY',
  "status" "DocumentStatus" NOT NULL DEFAULT 'UPLOADED',
  "visibility" "DocumentVisibility" NOT NULL DEFAULT 'INTERNAL_ONLY',
  "review_note" TEXT,
  "reviewed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "document_events" (
  "id" TEXT NOT NULL,
  "document_id" TEXT NOT NULL,
  "actor_user_id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "from_status" TEXT,
  "to_status" TEXT,
  "note" TEXT,
  "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "document_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "documents_org_id_sha256_key" ON "documents"("org_id", "sha256");
CREATE INDEX "documents_org_id_status_created_at_idx" ON "documents"("org_id", "status", "created_at");
CREATE INDEX "documents_client_id_created_at_idx" ON "documents"("client_id", "created_at");
CREATE INDEX "documents_case_id_created_at_idx" ON "documents"("case_id", "created_at");
CREATE INDEX "documents_checklist_item_id_idx" ON "documents"("checklist_item_id");
CREATE INDEX "document_events_document_id_occurred_at_idx" ON "document_events"("document_id", "occurred_at");

ALTER TABLE "documents" ADD CONSTRAINT "documents_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "documents" ADD CONSTRAINT "documents_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "documents" ADD CONSTRAINT "documents_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "documents" ADD CONSTRAINT "documents_checklist_item_id_fkey" FOREIGN KEY ("checklist_item_id") REFERENCES "checklist_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "documents" ADD CONSTRAINT "documents_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "document_events" ADD CONSTRAINT "document_events_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "document_events" ADD CONSTRAINT "document_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
