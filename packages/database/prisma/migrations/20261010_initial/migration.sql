-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "OrgType" AS ENUM ('BROKER', 'NONPROFIT', 'AGENCY', 'PLATFORM');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'BROKER', 'ASSISTANT', 'LANDLORD', 'TENANT', 'AUDITOR');

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('LOGIN', 'LOGOUT', 'LOGIN_FAILED', 'MFA_ENROLLED', 'MFA_VERIFIED', 'PASSWORD_CHANGED', 'PASSWORD_RESET_REQUESTED', 'CREATE', 'READ', 'UPDATE', 'DELETE', 'DOCUMENT_UPLOAD', 'DOCUMENT_VIEW', 'DOCUMENT_DOWNLOAD', 'SIGNED_URL_MINTED', 'STAGE_TRANSITION', 'OVERRIDE', 'OWNER_CHANGE', 'STALL_FLAGGED', 'SHOWING_CREATED', 'SHOWING_UPDATED', 'INVITE_SENT', 'INVITE_RESPONDED', 'STATUS_CHANGED', 'MATCH_SCORED', 'SHORTLIST_UPDATED', 'PRIORITY_CHANGED', 'NOT_A_FIT_MARKED', 'USER_CREATED', 'USER_UPDATED', 'USER_DEACTIVATED', 'ROLE_CHANGED', 'PERMISSION_GRANTED', 'PERMISSION_REVOKED', 'EXPORT', 'BULK_READ', 'SESSION_CREATED', 'SESSION_REVOKED', 'SYSTEM_ERROR');

-- CreateEnum
CREATE TYPE "AuditSeverity" AS ENUM ('LOW', 'NORMAL', 'ELEVATED', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "ClientPipelineStage" AS ENUM ('NEW_LEAD', 'INTAKE_INCOMPLETE', 'DOCUMENTS_NEEDED', 'READY_TO_MATCH', 'MATCHED_TO_PROPERTY', 'SHOWING_SCHEDULED', 'INTERESTED', 'APPLICATION_SUBMITTED', 'APPROVED_LEASED', 'INACTIVE_LOST');

-- CreateEnum
CREATE TYPE "VoucherProgram" AS ENUM ('CITYFHEPS', 'FHEPS', 'SECTION8', 'HASA', 'OTHER');

-- CreateEnum
CREATE TYPE "IssuanceType" AS ENUM ('NEW', 'TRANSFER');

-- CreateEnum
CREATE TYPE "VoucherStatus" AS ENUM ('PENDING', 'ACTIVE', 'EXPIRED', 'SUSPENDED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "VoucherVerificationState" AS ENUM ('UNVERIFIED', 'SELF_REPORTED', 'DOC_VERIFIED', 'AGENCY_CONFIRMED');

-- CreateEnum
CREATE TYPE "UnitStatus" AS ENUM ('DRAFT', 'AVAILABLE', 'UNDER_APPLICATION', 'LEASED', 'OFF_MARKET');

-- CreateEnum
CREATE TYPE "CaseStage" AS ENUM ('INQUIRY', 'INTAKE', 'VOUCHER_REVIEW', 'DOCUMENT_COLLECT', 'READY', 'MATCHED', 'APPLICATION', 'PRECLEARANCE', 'LEASE_PREP', 'LEASE_REVIEW', 'INSPECTION', 'MOVE_IN_PREP', 'PLACED', 'INELIGIBLE', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "FitResult" AS ENUM ('ELIGIBLE', 'INELIGIBLE', 'NEEDS_REVIEW');

-- CreateEnum
CREATE TYPE "ChecklistState" AS ENUM ('MISSING', 'UPLOADED', 'UNDER_REVIEW', 'VERIFIED', 'REJECTED', 'EXPIRED', 'WAIVED');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "OrgType" NOT NULL DEFAULT 'BROKER',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "email_verified" TIMESTAMP(3),
    "phone" TEXT,
    "name" TEXT NOT NULL,
    "password_hash" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'TENANT',
    "status" "UserStatus" NOT NULL DEFAULT 'PENDING',
    "mfa_enrolled" BOOLEAN NOT NULL DEFAULT false,
    "mfa_secret" TEXT,
    "last_login_at" TIMESTAMP(3),
    "last_login_ip" TEXT,
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "deactivated_at" TIMESTAMP(3),
    "deactivated_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "revoked_reason" TEXT,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "actor_ip" TEXT,
    "actor_user_agent" TEXT,
    "action" "AuditAction" NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT,
    "before_state" JSONB,
    "after_state" JSONB,
    "reason" TEXT,
    "severity" "AuditSeverity" NOT NULL DEFAULT 'NORMAL',
    "prev_hash" TEXT,
    "hash" TEXT NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "primary_user_id" TEXT,
    "legal_name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "preferred_language" TEXT,
    "current_housing_status" TEXT,
    "pipeline_stage" "ClientPipelineStage" NOT NULL DEFAULT 'NEW_LEAD',
    "notes" TEXT,
    "assigned_broker_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "household_members" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "dob" TIMESTAMP(3),
    "relationship" TEXT NOT NULL,
    "is_minor" BOOLEAN NOT NULL DEFAULT false,
    "income_contributor" BOOLEAN NOT NULL DEFAULT false,
    "added_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "removed_at" TIMESTAMP(3),

    CONSTRAINT "household_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vouchers" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "program" "VoucherProgram" NOT NULL,
    "issuance_type" "IssuanceType" NOT NULL DEFAULT 'NEW',
    "status" "VoucherStatus" NOT NULL DEFAULT 'PENDING',
    "verification_state" "VoucherVerificationState" NOT NULL DEFAULT 'UNVERIFIED',
    "verified_by" TEXT,
    "verified_at" TIMESTAMP(3),
    "bedrooms_approved" INTEGER NOT NULL,
    "max_rent_cents" INTEGER NOT NULL,
    "tenant_portion_cents" INTEGER,
    "utility_responsibility" JSONB,
    "issue_date" TIMESTAMP(3),
    "expiry_date" TIMESTAMP(3),
    "recertification_due_date" TIMESTAMP(3),
    "agency_case_ref" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vouchers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "landlords" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "legal_entity_name" TEXT NOT NULL,
    "contact_name" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "program_experience_level" TEXT,
    "onboarding_state" TEXT,
    "banking_verified" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "landlords_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "properties" (
    "id" TEXT NOT NULL,
    "landlord_id" TEXT NOT NULL,
    "address_line_1" TEXT NOT NULL,
    "city" TEXT NOT NULL DEFAULT 'New York',
    "state" TEXT NOT NULL DEFAULT 'NY',
    "zip" TEXT NOT NULL,
    "borough" TEXT,
    "hpd_registration_id" TEXT,
    "hpd_verified_at" TIMESTAMP(3),
    "year_built" INTEGER,
    "total_units" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "properties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "units" (
    "id" TEXT NOT NULL,
    "property_id" TEXT NOT NULL,
    "unit_number" TEXT,
    "bedrooms" INTEGER NOT NULL,
    "bathrooms" DOUBLE PRECISION,
    "square_feet" INTEGER,
    "asking_rent_cents" INTEGER NOT NULL,
    "utilities_included" JSONB,
    "status" "UnitStatus" NOT NULL DEFAULT 'DRAFT',
    "available_date" TIMESTAMP(3),
    "accessibility_features" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "utility_allowance_schedules" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL,
    "effective_to" TIMESTAMP(3),
    "jurisdiction" TEXT NOT NULL DEFAULT 'NYC',
    "table_json" JSONB NOT NULL,
    "source_document_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "utility_allowance_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cases" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "owner_user_id" TEXT NOT NULL,
    "voucher_id" TEXT,
    "unit_id" TEXT,
    "stage" "CaseStage" NOT NULL DEFAULT 'INQUIRY',
    "stage_entered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stalled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "case_stage_history" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "from_stage" "CaseStage" NOT NULL,
    "to_stage" "CaseStage" NOT NULL,
    "action" TEXT NOT NULL,
    "actor_user_id" TEXT NOT NULL,
    "from_owner_id" TEXT NOT NULL,
    "to_owner_id" TEXT NOT NULL,
    "reason" TEXT,
    "override" BOOLEAN NOT NULL DEFAULT false,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "duration_in_prev_stage_seconds" INTEGER NOT NULL,

    CONSTRAINT "case_stage_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fit_evaluations" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "unit_id" TEXT NOT NULL,
    "voucher_id" TEXT NOT NULL,
    "result" "FitResult" NOT NULL,
    "reasons" JSONB NOT NULL,
    "rule_version" TEXT NOT NULL,
    "allowance_schedule_id" TEXT,
    "snapshot" JSONB NOT NULL,
    "computed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "computed_by" TEXT NOT NULL,

    CONSTRAINT "fit_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checklist_items" (
    "id" TEXT NOT NULL,
    "case_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "blocking_stage" "CaseStage" NOT NULL,
    "state" "ChecklistState" NOT NULL DEFAULT 'MISSING',
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_org_id_idx" ON "users"("org_id");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_token_idx" ON "sessions"("token");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE INDEX "audit_logs_org_id_idx" ON "audit_logs"("org_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_user_id_idx" ON "audit_logs"("actor_user_id");

-- CreateIndex
CREATE INDEX "audit_logs_resource_type_resource_id_idx" ON "audit_logs"("resource_type", "resource_id");

-- CreateIndex
CREATE INDEX "audit_logs_occurred_at_idx" ON "audit_logs"("occurred_at");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "clients_org_id_idx" ON "clients"("org_id");

-- CreateIndex
CREATE INDEX "clients_pipeline_stage_idx" ON "clients"("pipeline_stage");

-- CreateIndex
CREATE INDEX "clients_assigned_broker_id_idx" ON "clients"("assigned_broker_id");

-- CreateIndex
CREATE INDEX "household_members_client_id_idx" ON "household_members"("client_id");

-- CreateIndex
CREATE INDEX "vouchers_client_id_idx" ON "vouchers"("client_id");

-- CreateIndex
CREATE INDEX "vouchers_program_idx" ON "vouchers"("program");

-- CreateIndex
CREATE INDEX "vouchers_status_idx" ON "vouchers"("status");

-- CreateIndex
CREATE INDEX "vouchers_expiry_date_idx" ON "vouchers"("expiry_date");

-- CreateIndex
CREATE INDEX "landlords_org_id_idx" ON "landlords"("org_id");

-- CreateIndex
CREATE INDEX "properties_landlord_id_idx" ON "properties"("landlord_id");

-- CreateIndex
CREATE INDEX "properties_borough_idx" ON "properties"("borough");

-- CreateIndex
CREATE INDEX "units_property_id_idx" ON "units"("property_id");

-- CreateIndex
CREATE INDEX "units_bedrooms_idx" ON "units"("bedrooms");

-- CreateIndex
CREATE INDEX "units_status_idx" ON "units"("status");

-- CreateIndex
CREATE INDEX "units_asking_rent_cents_idx" ON "units"("asking_rent_cents");

-- CreateIndex
CREATE INDEX "utility_allowance_schedules_org_id_idx" ON "utility_allowance_schedules"("org_id");

-- CreateIndex
CREATE INDEX "utility_allowance_schedules_effective_from_idx" ON "utility_allowance_schedules"("effective_from");

-- CreateIndex
CREATE INDEX "cases_org_id_stage_idx" ON "cases"("org_id", "stage");

-- CreateIndex
CREATE INDEX "cases_org_id_client_id_idx" ON "cases"("org_id", "client_id");

-- CreateIndex
CREATE INDEX "cases_owner_user_id_idx" ON "cases"("owner_user_id");

-- CreateIndex
CREATE INDEX "case_stage_history_case_id_occurred_at_idx" ON "case_stage_history"("case_id", "occurred_at");

-- CreateIndex
CREATE INDEX "fit_evaluations_case_id_computed_at_idx" ON "fit_evaluations"("case_id", "computed_at");

-- CreateIndex
CREATE UNIQUE INDEX "checklist_items_case_id_code_key" ON "checklist_items"("case_id", "code");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "clients" ADD CONSTRAINT "clients_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "household_members" ADD CONSTRAINT "household_members_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "landlords" ADD CONSTRAINT "landlords_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "properties" ADD CONSTRAINT "properties_landlord_id_fkey" FOREIGN KEY ("landlord_id") REFERENCES "landlords"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "units" ADD CONSTRAINT "units_property_id_fkey" FOREIGN KEY ("property_id") REFERENCES "properties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "utility_allowance_schedules" ADD CONSTRAINT "utility_allowance_schedules_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_voucher_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "vouchers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cases" ADD CONSTRAINT "cases_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_stage_history" ADD CONSTRAINT "case_stage_history_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "case_stage_history" ADD CONSTRAINT "case_stage_history_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fit_evaluations" ADD CONSTRAINT "fit_evaluations_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fit_evaluations" ADD CONSTRAINT "fit_evaluations_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fit_evaluations" ADD CONSTRAINT "fit_evaluations_voucher_id_fkey" FOREIGN KEY ("voucher_id") REFERENCES "vouchers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
