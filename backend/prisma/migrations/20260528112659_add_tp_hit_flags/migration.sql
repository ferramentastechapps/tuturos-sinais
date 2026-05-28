-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ActiveSignal" (
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
    "tp1_hit" BOOLEAN NOT NULL DEFAULT false,
    "tp2_hit" BOOLEAN NOT NULL DEFAULT false,
    "tp3_hit" BOOLEAN NOT NULL DEFAULT false,
    "current_target" REAL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);
INSERT INTO "new_ActiveSignal" ("context", "created_at", "entry_range_high", "entry_range_low", "expected_duration", "id", "initial_stop_loss", "pair", "score", "status", "stop_loss", "take_profits", "telegram_message_id", "trade_type", "type", "updated_at") SELECT "context", "created_at", "entry_range_high", "entry_range_low", "expected_duration", "id", "initial_stop_loss", "pair", "score", "status", "stop_loss", "take_profits", "telegram_message_id", "trade_type", "type", "updated_at" FROM "ActiveSignal";
DROP TABLE "ActiveSignal";
ALTER TABLE "new_ActiveSignal" RENAME TO "ActiveSignal";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
