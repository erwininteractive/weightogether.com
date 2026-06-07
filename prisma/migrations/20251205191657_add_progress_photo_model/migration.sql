-- CreateTable
CREATE TABLE "ProgressPhoto" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "visibility" "EntryVisibility" NOT NULL DEFAULT 'PRIVATE',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgressPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProgressPhoto_entryId_idx" ON "ProgressPhoto"("entryId");

-- CreateIndex
CREATE INDEX "ProgressPhoto_visibility_idx" ON "ProgressPhoto"("visibility");

-- AddForeignKey
ALTER TABLE "ProgressPhoto" ADD CONSTRAINT "ProgressPhoto_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "WeightEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
