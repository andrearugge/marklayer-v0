-- DropIndex
DROP INDEX "content_items_embedding_hnsw_idx";

-- CreateIndex
CREATE INDEX "content_items_project_id_idx" ON "content_items"("project_id");
