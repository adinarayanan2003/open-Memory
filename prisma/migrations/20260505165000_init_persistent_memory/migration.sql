-- CreateEnum
CREATE TYPE "SourceConnectionType" AS ENUM ('manual', 'file_upload', 'notes');

-- CreateEnum
CREATE TYPE "SyncMode" AS ENUM ('one_time', 'scheduled', 'webhook', 'continuous');

-- CreateEnum
CREATE TYPE "ConnectionStatus" AS ENUM ('active', 'paused', 'error', 'revoked');

-- CreateEnum
CREATE TYPE "MemoryState" AS ENUM ('observed', 'inferred', 'confirmed', 'sensitive', 'stale', 'forgotten');

-- CreateEnum
CREATE TYPE "MemoryScope" AS ENUM ('available_to_assistant', 'search_only', 'only_when_explicitly_asked', 'private_do_not_use', 'time_limited', 'forgotten');

-- CreateEnum
CREATE TYPE "PatchStatus" AS ENUM ('pending', 'accepted', 'rejected', 'needs_review');

-- CreateEnum
CREATE TYPE "AssertionStatus" AS ENUM ('proposed', 'accepted', 'rejected', 'superseded', 'contradicted');

-- CreateEnum
CREATE TYPE "AgentRunStatus" AS ENUM ('queued', 'running', 'succeeded', 'failed', 'partial', 'blocked');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceConnection" (
    "id" TEXT NOT NULL,
    "type" "SourceConnectionType" NOT NULL,
    "displayName" TEXT NOT NULL,
    "ownerUserId" TEXT NOT NULL,
    "syncMode" "SyncMode" NOT NULL,
    "memoryScopePolicyId" TEXT NOT NULL,
    "retentionPolicyId" TEXT NOT NULL,
    "status" "ConnectionStatus" NOT NULL,
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceRecord" (
    "id" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "sourceType" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT,
    "author" TEXT,
    "participants" TEXT[],
    "contentType" TEXT NOT NULL,
    "rawObjectRef" TEXT,
    "text" TEXT NOT NULL,
    "memoryScopeTags" TEXT[],
    "sensitivityTags" TEXT[],
    "metadata" JSONB NOT NULL,
    "createdAtSource" TIMESTAMP(3),
    "updatedAtSource" TIMESTAMP(3),
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chunk" (
    "id" TEXT NOT NULL,
    "sourceRecordId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Chunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Node" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "summary" TEXT,
    "attributes" JSONB NOT NULL,
    "memoryState" "MemoryState" NOT NULL,
    "memoryScope" "MemoryScope" NOT NULL,
    "currentVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Node_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evidence" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "locator" TEXT NOT NULL,
    "quote" TEXT,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Assertion" (
    "id" TEXT NOT NULL,
    "subjectNodeId" TEXT NOT NULL,
    "predicate" TEXT NOT NULL,
    "objectNodeId" TEXT,
    "literalValue" JSONB,
    "qualifiers" JSONB NOT NULL,
    "evidenceIds" TEXT[],
    "confidence" DOUBLE PRECISION NOT NULL,
    "status" "AssertionStatus" NOT NULL,
    "memoryState" "MemoryState" NOT NULL,
    "memoryScope" "MemoryScope" NOT NULL,
    "createdBy" TEXT NOT NULL,
    "acceptedBy" TEXT,
    "currentVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assertion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GraphPatch" (
    "id" TEXT NOT NULL,
    "proposedBy" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "operations" JSONB NOT NULL,
    "evidenceIds" TEXT[],
    "confidence" DOUBLE PRECISION NOT NULL,
    "sensitivity" TEXT NOT NULL,
    "suggestedScope" "MemoryScope" NOT NULL,
    "validationResults" JSONB NOT NULL,
    "status" "PatchStatus" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "GraphPatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "questionKind" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "relatedNodeIds" TEXT[],
    "evidenceIds" TEXT[],
    "priority" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "patchId" TEXT,
    "targetIds" TEXT[],
    "reason" TEXT,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentRun" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    "inputRefs" TEXT[],
    "outputPatchIds" TEXT[],
    "questionIds" TEXT[],
    "toolsUsed" TEXT[],
    "modelVersion" TEXT,
    "promptVersion" TEXT,
    "policyVersion" TEXT NOT NULL,
    "status" "AgentRunStatus" NOT NULL,
    "errorSummary" TEXT,
    "evaluatorFeedback" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "AgentRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentMemoryRecord" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "memoryKind" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "sourceRunIds" TEXT[],
    "relatedPolicyIds" TEXT[],
    "scope" TEXT NOT NULL,
    "sensitivity" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentMemoryRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SourceConnection_ownerUserId_idx" ON "SourceConnection"("ownerUserId");

-- CreateIndex
CREATE INDEX "SourceConnection_status_idx" ON "SourceConnection"("status");

-- CreateIndex
CREATE INDEX "SourceRecord_connectionId_idx" ON "SourceRecord"("connectionId");

-- CreateIndex
CREATE INDEX "SourceRecord_sourceType_idx" ON "SourceRecord"("sourceType");

-- CreateIndex
CREATE INDEX "Chunk_sourceRecordId_idx" ON "Chunk"("sourceRecordId");

-- CreateIndex
CREATE INDEX "Node_type_label_idx" ON "Node"("type", "label");

-- CreateIndex
CREATE INDEX "Node_memoryState_idx" ON "Node"("memoryState");

-- CreateIndex
CREATE INDEX "Node_memoryScope_idx" ON "Node"("memoryScope");

-- CreateIndex
CREATE INDEX "Evidence_sourceId_idx" ON "Evidence"("sourceId");

-- CreateIndex
CREATE INDEX "Evidence_type_idx" ON "Evidence"("type");

-- CreateIndex
CREATE INDEX "Assertion_subjectNodeId_idx" ON "Assertion"("subjectNodeId");

-- CreateIndex
CREATE INDEX "Assertion_objectNodeId_idx" ON "Assertion"("objectNodeId");

-- CreateIndex
CREATE INDEX "Assertion_status_idx" ON "Assertion"("status");

-- CreateIndex
CREATE INDEX "Assertion_memoryState_idx" ON "Assertion"("memoryState");

-- CreateIndex
CREATE INDEX "Assertion_memoryScope_idx" ON "Assertion"("memoryScope");

-- CreateIndex
CREATE INDEX "GraphPatch_status_idx" ON "GraphPatch"("status");

-- CreateIndex
CREATE INDEX "GraphPatch_createdAt_idx" ON "GraphPatch"("createdAt");

-- CreateIndex
CREATE INDEX "Question_status_idx" ON "Question"("status");

-- CreateIndex
CREATE INDEX "Question_questionKind_idx" ON "Question"("questionKind");

-- CreateIndex
CREATE INDEX "AuditEvent_patchId_idx" ON "AuditEvent"("patchId");

-- CreateIndex
CREATE INDEX "AuditEvent_eventType_idx" ON "AuditEvent"("eventType");

-- CreateIndex
CREATE INDEX "AuditEvent_createdAt_idx" ON "AuditEvent"("createdAt");

-- CreateIndex
CREATE INDEX "AgentRun_userId_idx" ON "AgentRun"("userId");

-- CreateIndex
CREATE INDEX "AgentRun_taskType_idx" ON "AgentRun"("taskType");

-- CreateIndex
CREATE INDEX "AgentRun_status_idx" ON "AgentRun"("status");

-- CreateIndex
CREATE INDEX "AgentMemoryRecord_userId_idx" ON "AgentMemoryRecord"("userId");

-- CreateIndex
CREATE INDEX "AgentMemoryRecord_agentId_idx" ON "AgentMemoryRecord"("agentId");

-- CreateIndex
CREATE INDEX "AgentMemoryRecord_memoryKind_idx" ON "AgentMemoryRecord"("memoryKind");

