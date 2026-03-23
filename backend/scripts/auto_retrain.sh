#!/bin/bash
# auto_retrain.sh — Automatic weekly model retraining for VPS (Ubuntu 24.04)
#
# Setup (run once on VPS):
#   chmod +x /var/www/signal-dashboard/backend/scripts/auto_retrain.sh
#   crontab -e
#   # Add this line to run every Sunday at 3:00 AM:
#   0 3 * * 0 /var/www/signal-dashboard/backend/scripts/auto_retrain.sh >> /var/www/signal-dashboard/backend/logs/retrain.log 2>&1

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
VENV_DIR="$BACKEND_DIR/.venv_ml"
LOG_PREFIX="[auto_retrain] $(date '+%Y-%m-%d %H:%M:%S')"
ONNX_PATH="$BACKEND_DIR/current_model.onnx"
ONNX_BACKUP="$BACKEND_DIR/model_backup_$(date '+%Y%m%d_%H%M%S').onnx"

echo "$LOG_PREFIX ▶ Starting automatic ML retraining..."

# ── 1. Ensure python3 and venv are available ──────────────────────────────
if ! command -v python3 &>/dev/null; then
    echo "$LOG_PREFIX ❌ python3 not found. Install with: sudo apt install python3 python3-venv"
    exit 1
fi

# ── 2. Create virtual environment if it doesn't exist ────────────────────
if [ ! -d "$VENV_DIR" ]; then
    echo "$LOG_PREFIX 📦 Creating Python virtual environment at $VENV_DIR"
    python3 -m venv "$VENV_DIR"
fi

PYTHON="$VENV_DIR/bin/python3"
PIP="$VENV_DIR/bin/pip"

# ── 3. Install/upgrade dependencies inside venv ───────────────────────────
echo "$LOG_PREFIX 📦 Updating Python dependencies in venv..."
"$PIP" install -q --upgrade \
    numpy pandas scikit-learn skl2onnx onnxruntime supabase 2>&1 | tail -5

# ── 4. Backup current model if it exists ─────────────────────────────────
if [ -f "$ONNX_PATH" ]; then
    cp "$ONNX_PATH" "$ONNX_BACKUP"
    echo "$LOG_PREFIX 💾 Backed up existing model to: $ONNX_BACKUP"
fi

# ── 5. Run the retraining script ──────────────────────────────────────────
echo "$LOG_PREFIX 🏋️  Running retrain_model.py..."
if "$PYTHON" "$SCRIPT_DIR/retrain_model.py" --min-samples 50 --output "$ONNX_PATH"; then
    echo "$LOG_PREFIX ✅ Model trained and saved successfully."

    # ── 6. Reload PM2 to pick up the new model ────────────────────────────
    if command -v pm2 &>/dev/null; then
        echo "$LOG_PREFIX 🔄 Restarting PM2 backend process..."
        pm2 restart tuturos-backend --update-env
        echo "$LOG_PREFIX ✅ Backend restarted with new model."
    else
        echo "$LOG_PREFIX ⚠️  pm2 not found. Restart the backend manually."
    fi

    # ── 7. Cleanup old backups (keep last 5) ──────────────────────────────
    ls -t "$BACKEND_DIR"/model_backup_*.onnx 2>/dev/null | tail -n +6 | xargs -r rm --
    echo "$LOG_PREFIX 🧹 Old model backups cleaned up."
else
    EXIT_CODE=$?
    echo "$LOG_PREFIX ⚠️  Retraining failed (exit $EXIT_CODE). Keeping existing model."

    if [ -f "$ONNX_BACKUP" ]; then
        cp "$ONNX_BACKUP" "$ONNX_PATH"
        echo "$LOG_PREFIX 🔁 Restored previous model from backup."
    fi

    exit $EXIT_CODE
fi

echo "$LOG_PREFIX ✅ Auto-retrain complete."
