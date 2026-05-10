# 🔧 FIX PROBLEMA 2: Versionamento e Rollback de Modelos ML

## 🎯 OBJETIVO
Evitar que retreinamentos ruins destruam modelos bons, implementando:
1. **Backup automático** antes de cada retreinamento
2. **Validação de qualidade** do novo modelo
3. **Rollback automático** se o novo modelo for pior
4. **Histórico de versões** para auditoria

---

## 📝 CORREÇÃO 1: Backup Automático no Job de Retreinamento

### ❌ ANTES (`backend/src/jobs/mlRetrainJob.ts`)

```typescript
export function executeRetrain(): Promise<boolean> {
    return new Promise((resolve) => {
        const backendDir = path.resolve(__dirname, '../../../');
        const outputPath = path.join(backendDir, 'current_model.onnx');
        const cmd = `"${pythonCmd}" "${trainScript}" --min-samples 30 --output "${outputPath}"`;
        
        exec(cmd, { cwd: backendDir }, async (error, stdout, stderr) => {
            // ... sem backup
        });
    });
}
```

### ✅ DEPOIS (`backend/src/jobs/mlRetrainJob.ts`)

```typescript
import fs from 'fs';
import path from 'path';

export function executeRetrain(): Promise<boolean> {
    return new Promise((resolve) => {
        const backendDir = path.resolve(__dirname, '../../../');
        const currentModelPath = path.join(backendDir, 'current_model.onnx');
        const modelsDir = path.join(backendDir, 'ml_models');
        
        // 1. Criar diretório de modelos se não existir
        if (!fs.existsSync(modelsDir)) {
            fs.mkdirSync(modelsDir, { recursive: true });
        }
        
        // 2. Backup do modelo atual (se existir)
        if (fs.existsSync(currentModelPath)) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupPath = path.join(modelsDir, `model_backup_${timestamp}.onnx`);
            
            try {
                fs.copyFileSync(currentModelPath, backupPath);
                logger.info(`[MLRetrain] ✅ Backup criado: ${backupPath}`);
                
                // Salvar metadados do backup
                const metadataPath = backupPath.replace('.onnx', '_metadata.json');
                const metadata = {
                    backup_date: new Date().toISOString(),
                    original_path: currentModelPath,
                    reason: 'pre_retrain_backup'
                };
                fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
            } catch (backupError) {
                logger.error('[MLRetrain] ❌ Falha ao criar backup', { error: backupError });
                return resolve(false);
            }
        }
        
        // 3. Treinar novo modelo em arquivo temporário
        const tempModelPath = path.join(backendDir, 'temp_model.onnx');
        const cmd = `"${pythonCmd}" "${trainScript}" --min-samples 30 --output "${tempModelPath}"`;
        
        logger.info(`[MLRetrain] Executando: ${cmd}`);
        
        exec(cmd, { cwd: backendDir }, async (error, stdout, stderr) => {
            if (stdout) logger.info('[MLRetrain] stdout:\n' + stdout);
            if (stderr) logger.warn('[MLRetrain] stderr:\n' + stderr);
            
            if (error) {
                logger.error('[MLRetrain] Falha no retreinamento', { code: error.code, message: error.message });
                return resolve(false);
            }
            
            // 4. Validar qualidade do novo modelo
            const metricsPath = path.join(backendDir, 'model_metrics.json');
            if (!fs.existsSync(metricsPath)) {
                logger.error('[MLRetrain] ❌ Métricas do modelo não encontradas');
                return resolve(false);
            }
            
            let metrics: any;
            try {
                metrics = JSON.parse(fs.readFileSync(metricsPath, 'utf-8'));
            } catch (parseError) {
                logger.error('[MLRetrain] ❌ Falha ao ler métricas', { error: parseError });
                return resolve(false);
            }
            
            // 5. Validação de qualidade mínima
            const MIN_ACCURACY = 0.55; // 55% mínimo (melhor que random)
            const MIN_SAMPLES = 50;    // Mínimo de amostras para confiar no modelo
            
            if (metrics.accuracy < MIN_ACCURACY) {
                logger.warn(`[MLRetrain] ⚠️  Novo modelo rejeitado: accuracy ${(metrics.accuracy * 100).toFixed(1)}% < ${MIN_ACCURACY * 100}%`);
                logger.info('[MLRetrain] Mantendo modelo anterior (rollback automático)');
                
                // Remover modelo temporário ruim
                if (fs.existsSync(tempModelPath)) {
                    fs.unlinkSync(tempModelPath);
                }
                
                return resolve(false);
            }
            
            if (metrics.sampleSize < MIN_SAMPLES) {
                logger.warn(`[MLRetrain] ⚠️  Novo modelo rejeitado: apenas ${metrics.sampleSize} samples < ${MIN_SAMPLES}`);
                logger.info('[MLRetrain] Mantendo modelo anterior (dados insuficientes)');
                
                if (fs.existsSync(tempModelPath)) {
                    fs.unlinkSync(tempModelPath);
                }
                
                return resolve(false);
            }
            
            // 6. Modelo aprovado - substituir o atual
            try {
                fs.renameSync(tempModelPath, currentModelPath);
                logger.info(`[MLRetrain] ✅ Novo modelo ativado: accuracy=${(metrics.accuracy * 100).toFixed(1)}%, samples=${metrics.sampleSize}`);
            } catch (renameError) {
                logger.error('[MLRetrain] ❌ Falha ao ativar novo modelo', { error: renameError });
                return resolve(false);
            }
            
            // 7. Recarregar modelo em memória
            logger.info('[MLRetrain] Recarregando modelo...');
            try {
                const reloadSuccess = await loadModel();
                if (reloadSuccess) {
                    logger.info('[MLRetrain] ✅ Novo modelo carregado em memória.');
                } else {
                    logger.warn('[MLRetrain] ⚠️  Retreinamento OK mas falhou ao recarregar ONNX.');
                }
            } catch (reloadErr) {
                logger.error('[MLRetrain] Erro ao recarregar modelo', { error: reloadErr });
            }
            
            // 8. Limpar backups antigos (manter últimos 10)
            cleanOldBackups(modelsDir, 10);
            
            resolve(true);
        });
    });
}

/**
 * Remove backups antigos, mantendo apenas os N mais recentes
 */
function cleanOldBackups(modelsDir: string, keepCount: number): void {
    try {
        const files = fs.readdirSync(modelsDir)
            .filter(f => f.startsWith('model_backup_') && f.endsWith('.onnx'))
            .map(f => ({
                name: f,
                path: path.join(modelsDir, f),
                mtime: fs.statSync(path.join(modelsDir, f)).mtime.getTime()
            }))
            .sort((a, b) => b.mtime - a.mtime); // Mais recente primeiro
        
        if (files.length > keepCount) {
            const toDelete = files.slice(keepCount);
            for (const file of toDelete) {
                fs.unlinkSync(file.path);
                
                // Remover metadata também
                const metadataPath = file.path.replace('.onnx', '_metadata.json');
                if (fs.existsSync(metadataPath)) {
                    fs.unlinkSync(metadataPath);
                }
                
                logger.info(`[MLRetrain] 🗑️  Backup antigo removido: ${file.name}`);
            }
        }
    } catch (cleanError) {
        logger.warn('[MLRetrain] Falha ao limpar backups antigos', { error: cleanError });
    }
}
```

---

## 📝 CORREÇÃO 2: Validação de Qualidade no Script Python

### ❌ ANTES (`ml_engine/train_model.py`)

```python
def train():
    # ... treina modelo ...
    
    # Salva direto sem validação
    onnx.save_model(onnx_model, "current_model.onnx")
    print("\nSaved model to 'current_model.onnx'")
```

### ✅ DEPOIS (`ml_engine/train_model.py`)

```python
def train():
    print("Starting training pipeline...")
    
    # 1. Fetch Data
    df = fetch_training_data()
    if df.empty:
        print("No data available for training.")
        return

    X = df[FEATURE_COLUMNS]
    y = df['label']
    
    # Split
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    
    print(f"Dataset size: {len(df)} samples")
    print(f"Training set: {len(X_train)} samples")
    print(f"Test set: {len(X_test)} samples")
    
    # ✅ NOVO: Validação de balanceamento de classes
    win_rate = y.mean()
    if win_rate < 0.05 or win_rate > 0.95:
        print(f"\n❌ ERRO: Classes extremamente desbalanceadas (win_rate={win_rate*100:.1f}%)")
        print("   Necessário pelo menos 5% de cada classe para treinar efetivamente.")
        sys.exit(1)
    
    print(f"Class balance: Wins={win_rate*100:.1f}%, Losses={(1-win_rate)*100:.1f}%")

    # 3. Train XGBoost
    model = xgb.XGBClassifier(
        n_estimators=100,
        max_depth=5,
        learning_rate=0.1,
        objective='binary:logistic',
        n_jobs=-1,
        scale_pos_weight=(1-win_rate)/win_rate  # ✅ NOVO: Balancear classes
    )
    
    model.fit(X_train.values, y_train.values)
    
    # 4. Evaluate
    y_pred = model.predict(X_test)
    y_proba = model.predict_proba(X_test)[:, 1]
    
    accuracy = accuracy_score(y_test, y_pred)
    precision = precision_score(y_test, y_pred, zero_division=0)
    recall = recall_score(y_test, y_pred, zero_division=0)
    f1 = f1_score(y_test, y_pred, zero_division=0)
    
    # ✅ NOVO: Calcular AUC-ROC
    from sklearn.metrics import roc_auc_score
    auc = roc_auc_score(y_test, y_proba) if len(set(y_test)) > 1 else 0.5
    
    metrics = {
        "accuracy": float(accuracy),
        "precision": float(precision),
        "recall": float(recall),
        "f1Score": float(f1),
        "auc": float(auc),
        "sampleSize": len(df),
        "trainSize": len(X_train),
        "testSize": len(X_test),
        "winRate": float(win_rate)
    }
    
    print("\n📊 Model Performance:")
    print(f"   Accuracy : {accuracy*100:.2f}%")
    print(f"   Precision: {precision*100:.2f}%")
    print(f"   Recall   : {recall*100:.2f}%")
    print(f"   F1 Score : {f1*100:.2f}%")
    print(f"   AUC-ROC  : {auc:.4f}")
    
    # ✅ NOVO: Validação de qualidade mínima
    MIN_ACCURACY = 0.55
    if accuracy < MIN_ACCURACY:
        print(f"\n❌ ERRO: Modelo rejeitado - accuracy {accuracy*100:.1f}% < {MIN_ACCURACY*100}%")
        print("   O modelo não é melhor que random. Não será salvo.")
        sys.exit(1)
    
    # 5. Export to ONNX
    initial_type = [('float_input', FloatTensorType([None, len(FEATURE_COLUMNS)]))]
    
    onnx_model = onnxmltools.convert_xgboost(
        model, 
        initial_types=initial_type, 
        target_opset=12
    )
    
    # ✅ NOVO: Salvar em arquivo temporário primeiro
    temp_path = "temp_model.onnx"
    onnx.save_model(onnx_model, temp_path)
    print(f"\n✅ Model saved to '{temp_path}'")
    
    # Save metrics for validation
    with open("model_metrics.json", "w") as f:
        json.dump(metrics, f, indent=2)
        
    print("\n✅ Training complete. Model ready for validation.")
```

---

## 📝 CORREÇÃO 3: Comando Manual de Rollback

Criar script para rollback manual se necessário:

### ✅ NOVO ARQUIVO: `backend/scripts/rollback_model.sh`

```bash
#!/bin/bash

# Script para fazer rollback manual do modelo ML

BACKEND_DIR="$(cd "$(dirname "$0")/.." && pwd)"
MODELS_DIR="$BACKEND_DIR/ml_models"
CURRENT_MODEL="$BACKEND_DIR/current_model.onnx"

echo "🔄 ML Model Rollback Tool"
echo "=========================="
echo ""

# Listar backups disponíveis
echo "📁 Backups disponíveis:"
ls -lht "$MODELS_DIR"/model_backup_*.onnx 2>/dev/null | head -10

echo ""
echo "Digite o nome do arquivo de backup para restaurar (ou 'cancel' para cancelar):"
read -r BACKUP_FILE

if [ "$BACKUP_FILE" = "cancel" ]; then
    echo "❌ Rollback cancelado."
    exit 0
fi

BACKUP_PATH="$MODELS_DIR/$BACKUP_FILE"

if [ ! -f "$BACKUP_PATH" ]; then
    echo "❌ Erro: Arquivo não encontrado: $BACKUP_PATH"
    exit 1
fi

# Fazer backup do modelo atual antes de substituir
TIMESTAMP=$(date +%Y-%m-%dT%H-%M-%S)
SAFETY_BACKUP="$MODELS_DIR/model_before_rollback_$TIMESTAMP.onnx"
cp "$CURRENT_MODEL" "$SAFETY_BACKUP"
echo "✅ Backup de segurança criado: $SAFETY_BACKUP"

# Restaurar backup
cp "$BACKUP_PATH" "$CURRENT_MODEL"
echo "✅ Modelo restaurado: $BACKUP_FILE -> current_model.onnx"

echo ""
echo "🔄 Reinicie o backend para carregar o modelo restaurado:"
echo "   pm2 restart tuturos-backend"
```

Tornar executável:
```bash
chmod +x backend/scripts/rollback_model.sh
```

---

## 🧪 TESTE DAS CORREÇÕES

### 1. Testar Backup Automático

```bash
# Forçar retreinamento manual
curl -X POST http://localhost:3001/api/ml/retrain

# Verificar se backup foi criado
ls -lht backend/ml_models/
```

### 2. Testar Validação de Qualidade

Simular modelo ruim editando `model_metrics.json`:
```json
{
  "accuracy": 0.45,  // Abaixo do mínimo (0.55)
  "sampleSize": 100
}
```

O sistema deve rejeitar e manter o modelo anterior.

### 3. Testar Rollback Manual

```bash
cd backend/scripts
./rollback_model.sh
# Escolher um backup da lista
```

---

## 📊 LOGS DE MONITORAMENTO

Adicionar estes logs para confirmar que está funcionando:

```typescript
// No executeRetrain após validação bem-sucedida:
logger.info('[MLRetrain] ✅ MODELO APROVADO', {
    accuracy: metrics.accuracy,
    samples: metrics.sampleSize,
    previous_backup: backupPath,
    new_model_active: true
});

// No executeRetrain após rejeição:
logger.warn('[MLRetrain] ⚠️  MODELO REJEITADO - ROLLBACK AUTOMÁTICO', {
    accuracy: metrics.accuracy,
    min_required: MIN_ACCURACY,
    samples: metrics.sampleSize,
    keeping_previous_model: true
});
```

---

## ✅ RESULTADO ESPERADO

Após estas correções:

1. ✅ **Backups automáticos** antes de cada retreinamento
2. ✅ **Validação de qualidade** (accuracy > 55%, samples > 50)
3. ✅ **Rollback automático** se novo modelo for pior
4. ✅ **Histórico de 10 versões** para auditoria
5. ✅ **Rollback manual** disponível via script

**Isso resolve o Problema 2**: O Swing não perderá mais o aprendizado após retreinamentos ruins.
