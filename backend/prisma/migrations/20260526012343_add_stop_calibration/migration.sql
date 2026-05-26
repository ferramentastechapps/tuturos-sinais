-- AlterTable
ALTER TABLE "TradeSignal" ADD COLUMN "entry_time" DATETIME;
ALTER TABLE "TradeSignal" ADD COLUMN "exit_time" DATETIME;
ALTER TABLE "TradeSignal" ADD COLUMN "outcome" TEXT;
ALTER TABLE "TradeSignal" ADD COLUMN "pnl" REAL;

-- CreateTable
CREATE TABLE "UserTrade" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "pair" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "entry_price" REAL NOT NULL,
    "exit_price" REAL,
    "exit_fee" REAL,
    "size" REAL NOT NULL,
    "leverage" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "closed_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PortfolioAsset" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "user_id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "average_buy_price" REAL NOT NULL,
    "total_fees" REAL NOT NULL,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "IndicatorPerformance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pair" TEXT NOT NULL,
    "indicator" TEXT NOT NULL,
    "total_trades" INTEGER NOT NULL,
    "wins" INTEGER NOT NULL,
    "losses" INTEGER NOT NULL,
    "win_rate" REAL NOT NULL,
    "avg_pnl" REAL,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "StopCalibration" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "trade_id" TEXT NOT NULL,
    "pair" TEXT NOT NULL,
    "foi_prematuro" BOOLEAN NOT NULL,
    "tp_atingido" TEXT,
    "tempo_ate_tp_horas" REAL,
    "ajuste_sugerido_stop_pct" REAL NOT NULL DEFAULT 0,
    "analisado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "BotConfigStop" (
    "pair" TEXT NOT NULL PRIMARY KEY,
    "stop_multiplier" REAL NOT NULL DEFAULT 1.0,
    "atualizado_em" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "PortfolioAsset_user_id_symbol_key" ON "PortfolioAsset"("user_id", "symbol");

-- CreateIndex
CREATE UNIQUE INDEX "IndicatorPerformance_pair_indicator_key" ON "IndicatorPerformance"("pair", "indicator");

-- CreateIndex
CREATE INDEX "StopCalibration_pair_idx" ON "StopCalibration"("pair");

-- CreateIndex
CREATE INDEX "StopCalibration_foi_prematuro_idx" ON "StopCalibration"("foi_prematuro");
