-- CreateTable
CREATE TABLE "ActiveSignal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pair" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "trade_type" TEXT NOT NULL,
    "entry_range_low" REAL NOT NULL,
    "entry_range_high" REAL NOT NULL,
    "stop_loss" REAL NOT NULL,
    "initial_stop_loss" REAL NOT NULL,
    "take_profits" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "telegram_message_id" TEXT,
    "expected_duration" TEXT,
    "context" TEXT,
    "score" REAL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "TradeSignal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pair" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "trade_type" TEXT NOT NULL,
    "entry_range_low" REAL NOT NULL,
    "entry_range_high" REAL NOT NULL,
    "stop_loss" REAL NOT NULL,
    "initial_stop_loss" REAL NOT NULL,
    "take_profits" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "confidence" REAL,
    "risk_reward" REAL,
    "indicators" TEXT,
    "ml_data" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "SignalEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "signal_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "price_at_event" REAL NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "DailySummary" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "summary_date" TEXT NOT NULL,
    "total_signals" INTEGER NOT NULL,
    "winners" INTEGER NOT NULL,
    "losers" INTEGER NOT NULL,
    "pnl" REAL NOT NULL,
    "full_report_text" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "MLTrainingData" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "signal_id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "outcome_label" INTEGER NOT NULL,
    "outcome_pnl" REAL NOT NULL,
    "entry_time" TEXT NOT NULL,
    "features" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "MLModel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "version" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "metrics" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "data" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "DailySummary_summary_date_key" ON "DailySummary"("summary_date");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");
