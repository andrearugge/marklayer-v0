-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('BRAND', 'PERSON', 'ORGANIZATION', 'TOPIC', 'PRODUCT', 'LOCATION', 'CONCEPT', 'OTHER');

-- CreateEnum
CREATE TYPE "AnalysisJobType" AS ENUM ('FULL_ANALYSIS', 'EXTRACT_ENTITIES', 'GENERATE_EMBEDDINGS', 'CLUSTER_TOPICS', 'COMPUTE_SCORE');

-- AlterTable
ALTER TABLE "content_items" ADD COLUMN     "embedding" vector(384);

-- CreateTable
CREATE TABLE "entities" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "type" "EntityType" NOT NULL,
    "label" VARCHAR(255) NOT NULL,
    "normalized_label" VARCHAR(255) NOT NULL,
    "frequency" INTEGER NOT NULL DEFAULT 1,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_entities" (
    "content_id" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "salience" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "context" TEXT,

    CONSTRAINT "content_entities_pkey" PRIMARY KEY ("content_id","entity_id")
);

-- CreateTable
CREATE TABLE "entity_relations" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "relation_type" VARCHAR(100) NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "entity_relations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_scores" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "overall_score" DOUBLE PRECISION NOT NULL,
    "dimensions" JSONB NOT NULL,
    "suggestions" JSONB,
    "content_count" INTEGER NOT NULL,
    "is_stale" BOOLEAN NOT NULL DEFAULT false,
    "computed_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "analysis_jobs" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "jobType" "AnalysisJobType" NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "result_summary" JSONB,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analysis_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "entities_project_id_type_idx" ON "entities"("project_id", "type");

-- CreateIndex
CREATE UNIQUE INDEX "entities_project_id_normalized_label_type_key" ON "entities"("project_id", "normalized_label", "type");

-- CreateIndex
CREATE INDEX "entity_relations_project_id_idx" ON "entity_relations"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "entity_relations_source_id_target_id_relation_type_key" ON "entity_relations"("source_id", "target_id", "relation_type");

-- CreateIndex
CREATE UNIQUE INDEX "project_scores_project_id_key" ON "project_scores"("project_id");

-- CreateIndex
CREATE INDEX "analysis_jobs_project_id_status_idx" ON "analysis_jobs"("project_id", "status");

-- AddForeignKey
ALTER TABLE "entities" ADD CONSTRAINT "entities_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_entities" ADD CONSTRAINT "content_entities_content_id_fkey" FOREIGN KEY ("content_id") REFERENCES "content_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_entities" ADD CONSTRAINT "content_entities_entity_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_relations" ADD CONSTRAINT "entity_relations_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "entity_relations" ADD CONSTRAINT "entity_relations_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "entities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_scores" ADD CONSTRAINT "project_scores_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "analysis_jobs" ADD CONSTRAINT "analysis_jobs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex (HNSW for approximate nearest-neighbour similarity search)
CREATE INDEX "content_items_embedding_hnsw_idx" ON "content_items" USING hnsw (embedding vector_cosine_ops);
