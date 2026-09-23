-- DropIndex
DROP INDEX "AiAnalysisLog_status_idx";

-- DropIndex
DROP INDEX "AiAnalysisLog_articleId_idx";

-- DropIndex
DROP INDEX "AuthSession_token_idx";

-- DropIndex
DROP INDEX "AuthSession_token_key";

-- DropIndex
DROP INDEX "NewsArticle_isConflict_scrapedAt_idx";

-- DropIndex
DROP INDEX "NewsArticle_latitude_longitude_idx";

-- DropIndex
DROP INDEX "NewsArticle_scrapedAt_idx";

-- DropIndex
DROP INDEX "NewsArticle_analyzed_idx";

-- DropIndex
DROP INDEX "NewsArticle_categorySlug_idx";

-- DropIndex
DROP INDEX "NewsArticle_externalId_key";

-- DropIndex
DROP INDEX "NewsCluster_createdAt_idx";

-- DropIndex
DROP INDEX "NewsCluster_impactScore_idx";

-- DropIndex
DROP INDEX "NewsClusterArticle_clusterId_articleId_key";

-- DropIndex
DROP INDEX "NewsClusterArticle_articleId_idx";

-- DropIndex
DROP INDEX "SentimentArchive_date_scope_scopeValue_key";

-- DropIndex
DROP INDEX "SentimentArchive_scope_scopeValue_idx";

-- DropIndex
DROP INDEX "StockRecommendation_symbol_createdAt_idx";

-- DropIndex
DROP INDEX "StockRecommendation_createdAt_idx";

-- DropIndex
DROP INDEX "StockRecommendation_articleId_idx";

-- DropIndex
DROP INDEX "StockRecommendation_symbol_idx";

-- DropIndex
DROP INDEX "TradeOrder_userId_idx";

-- DropIndex
DROP INDEX "TradeOrder_createdAt_idx";

-- DropIndex
DROP INDEX "TradeOrder_walletAddress_idx";

-- DropIndex
DROP INDEX "UserSession_userId_idx";

-- DropIndex
DROP INDEX "UserSession_walletAddress_idx";

-- DropIndex
DROP INDEX "VerificationCode_email_code_idx";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "AiAnalysisLog";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "AuthSession";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "NewsArticle";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "NewsCategory";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "NewsCluster";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "NewsClusterArticle";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "ScrapeRun";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "SentimentArchive";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "StockRecommendation";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "TradeOrder";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "UserSession";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "VerificationCode";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "mt5Login" TEXT,
    "name" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("createdAt", "id", "mt5Login", "name", "updatedAt") SELECT "createdAt", "id", "mt5Login", "name", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_mt5Login_key" ON "User"("mt5Login");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

