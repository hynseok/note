-- CreateTable
CREATE TABLE "DocumentComment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "documentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "parentCommentId" TEXT,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DocumentComment_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DocumentComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DocumentComment_parentCommentId_fkey" FOREIGN KEY ("parentCommentId") REFERENCES "DocumentComment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "DocumentComment_documentId_createdAt_idx" ON "DocumentComment"("documentId", "createdAt");

-- CreateIndex
CREATE INDEX "DocumentComment_parentCommentId_idx" ON "DocumentComment"("parentCommentId");
