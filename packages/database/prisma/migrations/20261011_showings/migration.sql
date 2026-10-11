-- CreateEnum
CREATE TYPE "ShowingStatus" AS ENUM ('SCHEDULED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ParticipantStatus" AS ENUM ('INVITED', 'CONFIRMED', 'DECLINED', 'ATTENDED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "FollowUpTaskStatus" AS ENUM ('OPEN', 'COMPLETED');

-- CreateTable
CREATE TABLE "showing_sessions" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "unit_id" TEXT NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "status" "ShowingStatus" NOT NULL DEFAULT 'SCHEDULED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "showing_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "showing_participants" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "status" "ParticipantStatus" NOT NULL DEFAULT 'INVITED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "showing_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follow_up_tasks" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "session_id" TEXT,
    "case_id" TEXT,
    "owner_user_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "due_at" TIMESTAMP(3) NOT NULL,
    "status" "FollowUpTaskStatus" NOT NULL DEFAULT 'OPEN',
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "follow_up_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "showing_events" (
    "id" TEXT NOT NULL,
    "session_id" TEXT,
    "task_id" TEXT,
    "actor_user_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "client_id" TEXT,
    "from_status" TEXT,
    "to_status" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "showing_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "showing_sessions_org_id_starts_at_idx" ON "showing_sessions"("org_id", "starts_at");

-- CreateIndex
CREATE INDEX "showing_sessions_unit_id_starts_at_ends_at_idx" ON "showing_sessions"("unit_id", "starts_at", "ends_at");

-- CreateIndex
CREATE UNIQUE INDEX "showing_participants_session_id_client_id_key" ON "showing_participants"("session_id", "client_id");

-- CreateIndex
CREATE INDEX "follow_up_tasks_org_id_status_due_at_idx" ON "follow_up_tasks"("org_id", "status", "due_at");

-- CreateIndex
CREATE INDEX "showing_events_session_id_occurred_at_idx" ON "showing_events"("session_id", "occurred_at");

-- CreateIndex
CREATE INDEX "showing_events_task_id_occurred_at_idx" ON "showing_events"("task_id", "occurred_at");

-- AddForeignKey
ALTER TABLE "showing_sessions" ADD CONSTRAINT "showing_sessions_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "showing_sessions" ADD CONSTRAINT "showing_sessions_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "showing_participants" ADD CONSTRAINT "showing_participants_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "showing_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "showing_participants" ADD CONSTRAINT "showing_participants_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_up_tasks" ADD CONSTRAINT "follow_up_tasks_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_up_tasks" ADD CONSTRAINT "follow_up_tasks_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "showing_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_up_tasks" ADD CONSTRAINT "follow_up_tasks_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "cases"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_up_tasks" ADD CONSTRAINT "follow_up_tasks_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_up_tasks" ADD CONSTRAINT "follow_up_tasks_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "showing_events" ADD CONSTRAINT "showing_events_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "showing_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "showing_events" ADD CONSTRAINT "showing_events_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "follow_up_tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "showing_events" ADD CONSTRAINT "showing_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
