-- AlterTable
ALTER TABLE "NewsArticle" ADD COLUMN "titleTranslations" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Alert" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "symbol" TEXT,
    "condition" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Alert_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Alert" ("condition", "createdAt", "enabled", "id", "name", "symbol", "type", "updatedAt") SELECT "condition", "createdAt", "enabled", "id", "name", "symbol", "type", "updatedAt" FROM "Alert";
DROP TABLE "Alert";
ALTER TABLE "new_Alert" RENAME TO "Alert";
CREATE INDEX "Alert_type_idx" ON "Alert"("type");
CREATE INDEX "Alert_symbol_idx" ON "Alert"("symbol");
CREATE INDEX "Alert_enabled_idx" ON "Alert"("enabled");
CREATE INDEX "Alert_userId_idx" ON "Alert"("userId");
CREATE TABLE "new_StockRecommendation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "articleId" INTEGER,
    "symbol" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "confidence" REAL NOT NULL,
    "reason" TEXT,
    "reasonTranslations" TEXT,
    "articleTitle" TEXT,
    "titleTranslations" TEXT,
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StockRecommendation_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "NewsArticle" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_StockRecommendation" ("action", "articleId", "confidence", "createdAt", "id", "reason", "symbol") SELECT "action", "articleId", "confidence", "createdAt", "id", "reason", "symbol" FROM "StockRecommendation";
DROP TABLE "StockRecommendation";
ALTER TABLE "new_StockRecommendation" RENAME TO "StockRecommendation";
CREATE INDEX "StockRecommendation_symbol_idx" ON "StockRecommendation"("symbol");
CREATE INDEX "StockRecommendation_articleId_idx" ON "StockRecommendation"("articleId");
CREATE INDEX "StockRecommendation_createdAt_idx" ON "StockRecommendation"("createdAt");
CREATE INDEX "StockRecommendation_symbol_createdAt_idx" ON "StockRecommendation"("symbol", "createdAt");
CREATE TABLE "new_TradeOrder" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER,
    "walletAddress" TEXT NOT NULL,
    "coin" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "orderType" TEXT NOT NULL,
    "size" REAL NOT NULL,
    "price" REAL,
    "leverage" INTEGER NOT NULL DEFAULT 1,
    "midPrice" REAL,
    "notionalValue" REAL,
    "marginRequired" REAL,
    "status" TEXT NOT NULL DEFAULT 'demo',
    "sourceArticleId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TradeOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_TradeOrder" ("coin", "createdAt", "id", "leverage", "marginRequired", "midPrice", "notionalValue", "orderType", "price", "side", "size", "sourceArticleId", "status", "walletAddress") SELECT "coin", "createdAt", "id", "leverage", "marginRequired", "midPrice", "notionalValue", "orderType", "price", "side", "size", "sourceArticleId", "status", "walletAddress" FROM "TradeOrder";
DROP TABLE "TradeOrder";
ALTER TABLE "new_TradeOrder" RENAME TO "TradeOrder";
CREATE INDEX "TradeOrder_walletAddress_idx" ON "TradeOrder"("walletAddress");
CREATE INDEX "TradeOrder_createdAt_idx" ON "TradeOrder"("createdAt");
CREATE INDEX "TradeOrder_userId_idx" ON "TradeOrder"("userId");
CREATE TABLE "new_User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT,
    "mt5Login" TEXT,
    "name" TEXT,
    "avatarUrl" TEXT,
    "googleId" TEXT,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "planExpiresAt" DATETIME,
    "alpacaApiKey" TEXT,
    "alpacaSecretKey" TEXT,
    "alpacaPaper" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("alpacaApiKey", "alpacaPaper", "alpacaSecretKey", "avatarUrl", "createdAt", "email", "googleId", "id", "name", "plan", "planExpiresAt", "stripeCustomerId", "stripeSubscriptionId", "updatedAt") SELECT "alpacaApiKey", "alpacaPaper", "alpacaSecretKey", "avatarUrl", "createdAt", "email", "googleId", "id", "name", "plan", "planExpiresAt", "stripeCustomerId", "stripeSubscriptionId", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_mt5Login_key" ON "User"("mt5Login");
CREATE UNIQUE INDEX "User_googleId_key" ON "User"("googleId");
CREATE UNIQUE INDEX "User_stripeCustomerId_key" ON "User"("stripeCustomerId");
CREATE TABLE "new_UserSession" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "userId" INTEGER,
    "walletAddress" TEXT NOT NULL,
    "chainId" INTEGER,
    "eventType" TEXT NOT NULL,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_UserSession" ("chainId", "createdAt", "eventType", "id", "userAgent", "walletAddress") SELECT "chainId", "createdAt", "eventType", "id", "userAgent", "walletAddress" FROM "UserSession";
DROP TABLE "UserSession";
ALTER TABLE "new_UserSession" RENAME TO "UserSession";
CREATE INDEX "UserSession_walletAddress_idx" ON "UserSession"("walletAddress");
CREATE INDEX "UserSession_userId_idx" ON "UserSession"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "InsiderTrade_symbol_filingDate_idx" ON "InsiderTrade"("symbol", "filingDate");
