-- CreateTable
CREATE TABLE "registry_collaborators" (
    "id" TEXT NOT NULL,
    "registryId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" TEXT NOT NULL DEFAULT 'editor',
    "permissions" JSONB NOT NULL DEFAULT '["read", "write"]',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "invitedBy" TEXT NOT NULL,
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "registry_collaborators_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registry_activities" (
    "id" TEXT NOT NULL,
    "registryId" TEXT NOT NULL,
    "actorEmail" TEXT NOT NULL,
    "actorName" TEXT,
    "action" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "metadata" JSONB,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registry_activities_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "registry_collaborators" ADD CONSTRAINT "registry_collaborators_registryId_fkey" FOREIGN KEY ("registryId") REFERENCES "registries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registry_activities" ADD CONSTRAINT "registry_activities_registryId_fkey" FOREIGN KEY ("registryId") REFERENCES "registries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "registry_collaborators_registryId_idx" ON "registry_collaborators"("registryId");

-- CreateIndex
CREATE INDEX "registry_collaborators_email_idx" ON "registry_collaborators"("email");

-- CreateIndex
CREATE INDEX "registry_collaborators_status_idx" ON "registry_collaborators"("status");

-- CreateIndex
CREATE INDEX "registry_collaborators_registryId_status_idx" ON "registry_collaborators"("registryId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "registry_collaborators_registryId_email_key" ON "registry_collaborators"("registryId", "email");

-- CreateIndex
CREATE INDEX "registry_activities_registryId_idx" ON "registry_activities"("registryId");

-- CreateIndex
CREATE INDEX "registry_activities_actorEmail_idx" ON "registry_activities"("actorEmail");

-- CreateIndex
CREATE INDEX "registry_activities_action_idx" ON "registry_activities"("action");

-- CreateIndex
CREATE INDEX "registry_activities_createdAt_idx" ON "registry_activities"("createdAt");

-- CreateIndex
CREATE INDEX "registry_activities_registryId_createdAt_idx" ON "registry_activities"("registryId", "createdAt");

-- CreateIndex
CREATE INDEX "registry_activities_registryId_action_idx" ON "registry_activities"("registryId", "action");

-- AlterTable
ALTER TABLE "registries" ADD COLUMN "collaborationEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "registries" ADD COLUMN "collaborationSettings" JSONB DEFAULT '{"maxCollaborators": 10, "allowPublicInvites": false, "requireApproval": true}';