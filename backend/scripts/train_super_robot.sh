#!/bin/bash
# train_super_robot.sh — Treina o modelo ML com dados históricos IMEDIATAMENTE.
#
# Fluxo:
#   1. Cria/ativa venv Python
#   2. Instala dependências
#   3. Migra dados históricos do Supabase → ml_training_data
#   4. Treina o modelo (RandomForest → ONNX)
#   5. Reinicia o backend via PM2
#
# Usage:
#   chmod +x backend/scripts/train_super_robot.sh
#   bash backend/scripts/train_super_robot.sh
#
# Flags opcionais:
#   --dry-run       Analisa dados sem inserir nem treinar
#   --min-samples N Mínimo de amostras para treinar (default: 30)
#   --skip-migrate  Pula a migração (se ml_training_data já está populado)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$(dirname "$SCRIPT_DIR")"
VENV_DIR="$BACKEND_DIR/.venv_ml"
ONNX_PATH="$BACKEND_DIR/current_model.onnx"
LOG_FILE="$BACKEND_DIR/logs/train_super_robot_$(date '+%Y%m%d_%H%M%S').log"
MIN_SAMPLES=30
DRY_RUN=false
SKIP_MIGRATE=false

# ── Parse args ────────────────────────────────────────────────────────────────
for arg in "$@"; do
    case $arg in
        --dry-run)       DRY_RUN=true ;;
        --skip-migrate)  SKIP_MIGRATE=true ;;
        --min-samples=*) MIN_SAMPLES="${arg#*=}" ;;
    esac
done

# ── Logging ───────────────────────────────────────────────────────────────────
mkdir -p "$BACKEND_DIR/logs"
exec > >(tee -a "$LOG_FILE") 2>&1

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║        🤖 SUPER ROBÔ — TREINAMENTO IMEDIATO              ║"
echo "║        $(date '+%Y-%m-%d %H:%M:%S')                      ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# ── 1. Python ─────────────────────────────────────────────────────────────────
if ! command -v python3 &>/dev/null; then
    echo "❌ python3 não encontrado."
    echo "   sudo apt install python3 python3-venv"
    exit 1
fi
echo "✅ Python: $(python3 --version)"

# ── 2. Virtual environment ────────────────────────────────────────────────────
if [ ! -d "$VENV_DIR" ]; then
    echo "📦 Criando virtual environment em $VENV_DIR..."
    python3 -m venv "$VENV_DIR"
fi

PYTHON="$VENV_DIR/bin/python3"
PIP="$VENV_DIR/bin/pip"

echo "📦 Instalando/atualizando dependências Python..."
"$PIP" install -q --upgrade \
    numpy pandas scikit-learn skl2onnx onnxruntime supabase python-dotenv 2>&1 | tail -3
echo "✅ Dependências OK"

# ── 3. Migrar dados históricos ────────────────────────────────────────────────
if [ "$SKIP_MIGRATE" = false ]; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  ETAPA 1/3 — Migrando dados históricos do Supabase"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    MIGRATE_FLAGS=""
    if [ "$DRY_RUN" = true ]; then
        MIGRATE_FLAGS="--dry-run"
    fi

    if "$PYTHON" "$SCRIPT_DIR/migrate_historical_to_training.py" $MIGRATE_FLAGS; then
        echo "✅ Migração concluída"
    else
        EXIT_CODE=$?
        echo "⚠️  Migração retornou código $EXIT_CODE"
        echo "   Continuando com dados já existentes em ml_training_data..."
    fi
else
    echo "⏭️  Migração ignorada (--skip-migrate)"
fi

# ── 4. Treinar modelo ─────────────────────────────────────────────────────────
if [ "$DRY_RUN" = true ]; then
    echo ""
    echo "🔍 DRY RUN — pulando treinamento."
    echo "   Remova --dry-run para treinar de verdade."
    exit 0
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ETAPA 2/3 — Treinando modelo ML"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Backup do modelo atual
if [ -f "$ONNX_PATH" ]; then
    BACKUP="$BACKEND_DIR/model_backup_$(date '+%Y%m%d_%H%M%S').onnx"
    cp "$ONNX_PATH" "$BACKUP"
    echo "💾 Backup do modelo atual: $BACKUP"
fi

if "$PYTHON" "$SCRIPT_DIR/retrain_model.py" \
    --min-samples "$MIN_SAMPLES" \
    --output "$ONNX_PATH"; then
    echo ""
    echo "✅ Modelo treinado e salvo em: $ONNX_PATH"
else
    EXIT_CODE=$?
    echo ""
    echo "⚠️  Treinamento falhou (código $EXIT_CODE)"

    if [ -f "${BACKUP:-}" ]; then
        cp "$BACKUP" "$ONNX_PATH"
        echo "🔁 Modelo anterior restaurado."
    fi

    echo ""
    echo "Possíveis causas:"
    echo "  • Poucos trades finalizados (< $MIN_SAMPLES)"
    echo "  • Desequilíbrio extremo de classes (muito mais wins ou losses)"
    echo "  • Dados sem features ML salvas"
    echo ""
    echo "Tente: python migrate_historical_to_training.py --dry-run"
    exit $EXIT_CODE
fi

# ── 5. Reiniciar backend ──────────────────────────────────────────────────────
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  ETAPA 3/3 — Recarregando backend"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if command -v pm2 &>/dev/null; then
    # Tentar nomes comuns do processo PM2
    for PM2_NAME in tuturos-backend signal-engine backend; do
        if pm2 describe "$PM2_NAME" &>/dev/null 2>&1; then
            echo "🔄 Reiniciando PM2: $PM2_NAME"
            pm2 restart "$PM2_NAME" --update-env
            echo "✅ Backend reiniciado com novo modelo!"
            break
        fi
    done
else
    echo "⚠️  pm2 não encontrado. Reinicie o backend manualmente:"
    echo "   pm2 restart <nome-do-processo>"
fi

# ── Limpeza de backups antigos (manter últimos 5) ─────────────────────────────
ls -t "$BACKEND_DIR"/model_backup_*.onnx 2>/dev/null | tail -n +6 | xargs -r rm --
echo "🧹 Backups antigos removidos (mantidos últimos 5)"

# ── Resumo final ──────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║  ✅ SUPER ROBÔ TREINADO E ATIVO!                         ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
echo "📄 Log completo: $LOG_FILE"
echo "📊 Relatório do modelo: $BACKEND_DIR/model_report.json"
echo ""
echo "Próximos passos:"
echo "  • Monitore os próximos sinais no dashboard"
echo "  • Win Rate deve melhorar em 24-48h"
echo "  • Retreinamento automático: crontab -e → auto_retrain.sh"
echo ""
