-- CreateTable: IndicatorAlert (replaces old table if exists via DROP first)
DROP TABLE IF EXISTS "IndicatorAlert";
CREATE TABLE "IndicatorAlert" (
    "id"             TEXT NOT NULL PRIMARY KEY,
    "user_id"        TEXT NOT NULL,
    "type"           TEXT NOT NULL,
    "symbol"         TEXT NOT NULL,
    "indicator_name" TEXT NOT NULL,
    "value"          REAL NOT NULL,
    "threshold"      REAL,
    "message"        TEXT NOT NULL,
    "direction"      TEXT NOT NULL,
    "read"           BOOLEAN NOT NULL DEFAULT false,
    "created_at"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable: IndicatorAlertConfig (replaces old table if exists via DROP first)
DROP TABLE IF EXISTS "IndicatorAlertConfig";
CREATE TABLE "IndicatorAlertConfig" (
    "id"                      TEXT NOT NULL PRIMARY KEY,
    "user_id"                 TEXT NOT NULL,
    "enabled"                 BOOLEAN NOT NULL DEFAULT true,
    "browser_notifications"   BOOLEAN NOT NULL DEFAULT false,
    "rsi_oversold"            REAL NOT NULL DEFAULT 30,
    "rsi_overbought"          REAL NOT NULL DEFAULT 70,
    "stoch_oversold"          REAL NOT NULL DEFAULT 20,
    "stoch_overbought"        REAL NOT NULL DEFAULT 80,
    "enable_macd_cross"       BOOLEAN NOT NULL DEFAULT true,
    "enable_ema_cross"        BOOLEAN NOT NULL DEFAULT true,
    "enable_bollinger_touch"  BOOLEAN NOT NULL DEFAULT true,
    "enable_ichimoku_signals" BOOLEAN NOT NULL DEFAULT true,
    "enable_adx_cross"        BOOLEAN NOT NULL DEFAULT true,
    "adx_strong_trend"        REAL NOT NULL DEFAULT 25,
    "enable_atr_alerts"       BOOLEAN NOT NULL DEFAULT true,
    "atr_high_volatility"     REAL NOT NULL DEFAULT 3,
    "atr_low_volatility"      REAL NOT NULL DEFAULT 1,
    "created_at"              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"              DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "IndicatorAlertConfig_user_id_key" ON "IndicatorAlertConfig"("user_id");
