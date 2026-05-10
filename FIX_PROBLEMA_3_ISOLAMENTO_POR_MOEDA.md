# 🔧 FIX PROBLEMA 3: Isolamento de Aprendizado por Moeda

## 🎯 OBJETIVO
Criar modelos ML separados para cada símbolo, evitando que o aprendizado de uma moeda contamine outra.

**Problema atual**: 1 modelo global para 81 moedas → Correlação win_rate vs confidence = -0,21

**Solução**: 1 modelo por símbolo → Cada moeda aprende seus próprios padrões

---

## 🏗️ ARQUITETURA DA SOLUÇÃO

### Estrutura de Arquivos

```
backend/
├── ml_models/
│   ├── BTCUSDT/
│   │   ├── swing_model.onnx
│   │   ├── scalping_model.onnx
│   │   ├── metadata.json
│   │   └── backups/
│   ├── ETHUSDT/
│   │   ├── swing_model.onnx
│   │   ├── scalping_model.onnx
│   │   └── ...
│   └── _global/
│       ├── fallback_model.onnx  # Para símbolos novos
│       └── metadata.json
```

---

## 📝 CORREÇÃO 1: Serviço de Predição com Modelos por Símbolo

### ❌ ANTES (`backend/src/ml/mlPredictionService.ts`)

```typescript
// UM modelo global para todas as moedas
let inferenceSession: ort.InferenceSession | null = null;

export async function predictSignal(features: MLFeatureVector): Promise<MLPrediction | null> {
    if (!inferenceSession) {
        await loadModel();
    }
    // ... usa o mesmo modelo para todas as moedas
}
```

### ✅ DEPOIS (`backend/src/ml/mlPredictionService.ts`)

```typescript
import * as ort from 'onnxruntime-node';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { logger } from '../lib/logger.js';
import { config } from '../lib/config.js';
import type { MLFeatureVector, MLPrediction } from '../types/mlTypes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ✅ NOVO: Cache de modelos por símbolo e tipo de robô
interface ModelCache {
    session: ort.InferenceSession;
    loadedAt: number;
    metadata: {
        accuracy: number;
        sampleSize: number;
        trainedAt: string;
    };
}

const modelCache = new Map<string, ModelCache>(); // Key: "BTCUSDT_swing" ou "ETHUSDT_scalping"
let fallbackModel: ort.InferenceSession | null = null;

const FEATURE_COLUMNS = [
    'symbol_id',
    'rsi', 'adx', 'atr_rel', 'dist_ema20', 'dist_ema50', 'dist_ema200', 'dist_vwap',
    'volatility_24h', 'volume_rel', 'funding_rate', 'open_interest_var', 'long_short_ratio',
    'is_long', 'confidence', 'quality_score', 'confluence_count', 'stop_loss_pct',
    'take_profit_pct', 'risk_reward', 'hour_of_day', 'day_of_week',
    'btc_trend', 'dominance_btc', 'fear_greed'
];

/**
 * Carrega o modelo específico para um símbolo e tipo de robô
 */
async function loadSymbolModel(symbol: string, tradeType: 'swing' | 'scalping'): Promise<ort.InferenceSession | null> {
    const cacheKey = `${symbol}_${tradeType}`;
    
    // Verificar cache (recarregar se > 24h)
    const cached = modelCache.get(cacheKey);
    if (cached && (Date.now() - cached.loadedAt) < 24 * 60 * 60 * 1000) {
        return cached.session;
    }
    
    const backendDir = path.resolve(__dirname, '../../');
    const symbolDir = path.join(backendDir, 'ml_models', symbol);
    const modelPath = path.join(symbolDir, `${tradeType}_model.onnx`);
    const metadataPath = path.join(symbolDir, 'metadata.json');
    
    // Se não existe modelo para este símbolo, usar fallback global
    if (!fs.existsSync(modelPath)) {
        logger.debug(`[ML] Modelo não encontrado para ${symbol} ${tradeType}, usando fallback global`);
        return await loadFallbackModel();
    }
    
    try {
        logger.info(`[ML] Carregando modelo: ${symbol} ${tradeType}`);
        const session = await ort.InferenceSession.create(modelPath);
        
        // Carregar metadata
        let metadata = {
            accuracy: 0,
            sampleSize: 0,
            trainedAt: new Date().toISOString()
        };
        
        if (fs.existsSync(metadataPath)) {
            try {
                const metaContent = fs.readFileSync(metadataPath, 'utf-8');
                const parsed = JSON.parse(metaContent);
                metadata = parsed[tradeType] || metadata;
            } catch (metaError) {
                logger.warn(`[ML] Falha ao ler metadata de ${symbol}`, { error: metaError });
            }
        }
        
        // Armazenar em cache
        modelCache.set(cacheKey, {
            session,
            loadedAt: Date.now(),
            metadata
        });
        
        logger.info(`[ML] ✅ Modelo carregado: ${symbol} ${tradeType} (accuracy=${(metadata.accuracy*100).toFixed(1)}%, samples=${metadata.sampleSize})`);
        return session;
        
    } catch (error) {
        logger.error(`[ML] Falha ao carregar modelo de ${symbol} ${tradeType}`, { error });
        return await loadFallbackModel();
    }
}

/**
 * Carrega o modelo fallback global (para símbolos novos sem histórico)
 */
async function loadFallbackModel(): Promise<ort.InferenceSession | null> {
    if (fallbackModel) return fallbackModel;
    
    const backendDir = path.resolve(__dirname, '../../');
    const fallbackPath = path.join(backendDir, 'ml_models', '_global', 'fallback_model.onnx');
    
    // Se não existe fallback, usar o modelo legado
    if (!fs.existsSync(fallbackPath)) {
        const legacyPath = path.join(backendDir, 'current_model.onnx');
        if (fs.existsSync(legacyPath)) {
            logger.info('[ML] Usando modelo legado como fallback');
            fallbackModel = await ort.InferenceSession.create(legacyPath);
            return fallbackModel;
        }
        
        logger.warn('[ML] Nenhum modelo disponível (nem específico nem fallback)');
        return null;
    }
    
    try {
        logger.info('[ML] Carregando modelo fallback global');
        fallbackModel = await ort.InferenceSession.create(fallbackPath);
        return fallbackModel;
    } catch (error) {
        logger.error('[ML] Falha ao carregar modelo fallback', { error });
        return null;
    }
}

/**
 * Predição usando modelo específico do símbolo
 */
export async function predictSignal(
    features: MLFeatureVector,
    symbol: string,
    tradeType: 'swing' | 'scalping'
): Promise<MLPrediction | null> {
    if (!config.ml.enabled) return null;
    
    const session = await loadSymbolModel(symbol, tradeType);
    if (!session) return null;
    
    try {
        const inputData = new Float32Array(FEATURE_COLUMNS.length);
        FEATURE_COLUMNS.forEach((col, idx) => {
            inputData[idx] = features[col] || 0;
        });
        
        const tensor = new ort.Tensor('float32', inputData, [1, FEATURE_COLUMNS.length]);
        const feeds: Record<string, ort.Tensor> = {};
        const inputName = session.inputNames[0];
        feeds[inputName] = tensor;
        
        const results = await session.run(feeds);
        
        const labelTensor = results[session.outputNames[0]];
        const probTensor = results[session.outputNames[1]];
        
        const predictedClass = Number(labelTensor.data[0]);
        
        let probability = 0;
        if (probTensor && probTensor.data.length >= 2) {
            probability = Number(probTensor.data[1]);
        }
        
        return {
            predictedClass: predictedClass as 0 | 1,
            probability,
            confidence: probability > 0.5 ? probability : 1 - probability,
            modelSource: modelCache.has(`${symbol}_${tradeType}`) ? 'symbol_specific' : 'fallback'
        };
    } catch (error) {
        logger.error(`[ML] Inferência falhou para ${symbol} ${tradeType}`, { error });
        return null;
    }
}

/**
 * Limpa cache de modelos (útil após retreinamento)
 */
export function clearModelCache(): void {
    modelCache.clear();
    fallbackModel = null;
    logger.info('[ML] Cache de modelos limpo');
}

/**
 * Retorna estatísticas dos modelos carregados
 */
export function getModelStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    
    for (const [key, cache] of modelCache.entries()) {
        stats[key] = {
            loadedAt: new Date(cache.loadedAt).toISOString(),
            accuracy: cache.metadata.accuracy,
            sampleSize: cache.metadata.sampleSize,
            trainedAt: cache.metadata.trainedAt
        };
    }
    
    return {
        loaded_models: stats,
        total_models: modelCache.size,
        fallback_loaded: fallbackModel !== null
    };
}

export function isModelLoaded(): boolean {
    return modelCache.size > 0 || fallbackModel !== null;
}

// ✅ NOVO: Função legada para compatibilidade (será removida)
export function getSymbolId(symbol: string): number {
    let hash = 0;
    for (let i = 0; i < symbol.length; i++) {
        hash = symbol.charCodeAt(i) + ((hash << 5) - hash);
        hash = hash & hash;
    }
    return Math.abs(hash);
}
```

---

## 📝 CORREÇÃO 2: Atualizar Chamadas de Predição nos Robôs

### ✅ Swing Robot (`backend/src/engine/signalEngine.ts`)

```typescript
// Linha 1050 (aproximadamente)
// ❌ ANTES:
if (isModelLoaded()) {
    try {
        const prediction = await predictSignal(features);
        // ...
    }
}

// ✅ DEPOIS:
if (isModelLoaded()) {
    try {
        const prediction = await predictSignal(features, symbol, 'swing');
        if (prediction) {
            signal.mlData = {
                ...signal.mlData,
                probability: prediction.probability,
                predictedClass: prediction.predictedClass,
                confidence: prediction.confidence,
                isFiltered: prediction.probability < 0.65,
                modelSource: prediction.modelSource  // ✅ NOVO: Rastrear qual modelo foi usado
            };
            
            // Filter out signals rejected by ML
            if (prediction.probability < 0.65) {
                logger.debug(`Signal ${symbol} filtered by ML (prob: ${prediction.probability.toFixed(3)} < 0.65, source: ${prediction.modelSource})`);
                continue;
            }
        }
    } catch (mlError) {
        logger.warn(`ML enrichment failed for ${symbol}`, { error: mlError });
    }
}
```

### ✅ Scalping Robot (`backend/src/engine/scalpingEngine.ts`)

```typescript
// Linha 527 (aproximadamente)
// ❌ ANTES:
const prediction = await predictSignal(signal.mlData as unknown as Parameters<typeof predictSignal>[0]);

// ✅ DEPOIS:
const prediction = await predictSignal(
    signal.mlData as unknown as Parameters<typeof predictSignal>[0],
    symbol,
    'scalping'
);

if (prediction) {
    signal.mlData = {
        ...signal.mlData,
        probability: prediction.probability,
        predictedClass: prediction.predictedClass,
        modelSource: prediction.modelSource
    };
    
    if (prediction.probability < config.scalpingBot.mlMinProb) {
        logger.debug(`[Scalping] ${symbol} filtrado pelo ML (prob: ${prediction.probability.toFixed(3)} < ${config.scalpingBot.mlMinProb}, source: ${prediction.modelSource})`);
        continue;
    }
}
```

---

## 📝 CORREÇÃO 3: Script Python de Treinamento por Símbolo

### ✅ NOVO ARQUIVO: `ml_engine/train_per_symbol.py`

```python
#!/usr/bin/env python3
"""
train_per_symbol.py — Treina modelos ML separados para cada símbolo

Usage:
    python train_per_symbol.py [--min-samples N] [--symbols BTC,ETH,...]
"""

import os
import sys
import json
import argparse
from pathlib import Path
from datetime import datetime

import pandas as pd
import numpy as np
import xgboost as xgb
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score

# ONNX imports (com monkeypatch)
if 'pkg_resources' not in sys.modules:
    import types
    try:
        from packaging.version import parse as parse_version
    except ImportError:
        parse_version = lambda x: x
    _pkg = types.ModuleType('pkg_resources')
    class MockDist:
        version = '1.15.0'
        parsed_version = parse_version('1.15.0')
    _pkg.get_distribution = lambda x: MockDist()
    _pkg.parse_version = parse_version
    sys.modules['pkg_resources'] = _pkg

import onnx
if not hasattr(onnx, 'mapping'):
    onnx.mapping = getattr(onnx, '_mapping', None)
if not hasattr(onnx.helper, 'split_complex_to_pairs'):
    onnx.helper.split_complex_to_pairs = lambda x: ([], [])

import onnxmltools
from onnxmltools.convert.common.data_types import FloatTensorType

FEATURE_COLUMNS = [
    'symbol_id',
    'rsi', 'adx', 'atr_rel', 'dist_ema20', 'dist_ema50', 'dist_ema200', 'dist_vwap',
    'volatility_24h', 'volume_rel', 'funding_rate', 'open_interest_var', 'long_short_ratio',
    'is_long', 'confidence', 'quality_score', 'confluence_count', 'stop_loss_pct',
    'take_profit_pct', 'risk_reward', 'hour_of_day', 'day_of_week',
    'btc_trend', 'dominance_btc', 'fear_greed'
]

def load_training_data():
    """Carrega dados do JSONL local"""
    data_path = Path(__file__).parent / 'data' / 'historical_ml_data.jsonl'
    
    if not data_path.exists():
        print(f"❌ Arquivo não encontrado: {data_path}")
        return pd.DataFrame()
    
    records = []
    with open(data_path, 'r') as f:
        for line in f:
            try:
                records.append(json.loads(line))
            except:
                continue
    
    if not records:
        return pd.DataFrame()
    
    df = pd.DataFrame(records)
    
    # Extrair features do JSON
    features_list = []
    for _, row in df.iterrows():
        feats = row.get('features', {})
        if isinstance(feats, str):
            try:
                feats = json.loads(feats)
            except:
                feats = {}
        
        vec = {col: float(feats.get(col, 0) or 0) for col in FEATURE_COLUMNS}
        vec['label'] = int(row.get('outcome_label', 0))
        vec['symbol'] = row.get('symbol', 'UNKNOWN')
        vec['trade_type'] = row.get('trade_type', 'Swing Trade')
        features_list.append(vec)
    
    return pd.DataFrame(features_list)

def train_symbol_model(symbol: str, trade_type: str, df: pd.DataFrame, output_dir: Path, min_samples: int = 30):
    """Treina modelo para um símbolo específico"""
    
    # Filtrar dados deste símbolo e tipo
    symbol_data = df[(df['symbol'] == symbol) & (df['trade_type'].str.contains(trade_type, case=False, na=False))]
    
    if len(symbol_data) < min_samples:
        print(f"   ⚠️  {symbol} {trade_type}: Apenas {len(symbol_data)} samples < {min_samples} (pulando)")
        return None
    
    X = symbol_data[FEATURE_COLUMNS]
    y = symbol_data['label']
    
    # Validar balanceamento
    win_rate = y.mean()
    if win_rate < 0.05 or win_rate > 0.95:
        print(f"   ⚠️  {symbol} {trade_type}: Classes desbalanceadas ({win_rate*100:.1f}% wins, pulando)")
        return None
    
    # Split
    try:
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )
    except ValueError:
        print(f"   ⚠️  {symbol} {trade_type}: Impossível estratificar (pulando)")
        return None
    
    # Treinar
    model = xgb.XGBClassifier(
        n_estimators=100,
        max_depth=5,
        learning_rate=0.1,
        objective='binary:logistic',
        scale_pos_weight=(1-win_rate)/win_rate,
        n_jobs=-1
    )
    
    model.fit(X_train.values, y_train.values)
    
    # Avaliar
    y_pred = model.predict(X_test)
    y_proba = model.predict_proba(X_test)[:, 1]
    
    accuracy = accuracy_score(y_test, y_pred)
    precision = precision_score(y_test, y_pred, zero_division=0)
    recall = recall_score(y_test, y_pred, zero_division=0)
    f1 = f1_score(y_test, y_pred, zero_division=0)
    auc = roc_auc_score(y_test, y_proba) if len(set(y_test)) > 1 else 0.5
    
    # Validar qualidade mínima
    if accuracy < 0.55:
        print(f"   ⚠️  {symbol} {trade_type}: Accuracy {accuracy*100:.1f}% < 55% (rejeitado)")
        return None
    
    # Criar diretório do símbolo
    symbol_dir = output_dir / symbol
    symbol_dir.mkdir(parents=True, exist_ok=True)
    
    # Exportar para ONNX
    model_type = 'swing' if 'swing' in trade_type.lower() else 'scalping'
    model_path = symbol_dir / f'{model_type}_model.onnx'
    
    initial_type = [('float_input', FloatTensorType([None, len(FEATURE_COLUMNS)]))]
    onnx_model = onnxmltools.convert_xgboost(model, initial_types=initial_type, target_opset=12)
    onnx.save_model(onnx_model, str(model_path))
    
    # Salvar metadata
    metadata = {
        model_type: {
            'accuracy': float(accuracy),
            'precision': float(precision),
            'recall': float(recall),
            'f1': float(f1),
            'auc': float(auc),
            'sampleSize': len(symbol_data),
            'trainSize': len(X_train),
            'testSize': len(X_test),
            'winRate': float(win_rate),
            'trainedAt': datetime.utcnow().isoformat() + 'Z'
        }
    }
    
    metadata_path = symbol_dir / 'metadata.json'
    if metadata_path.exists():
        with open(metadata_path, 'r') as f:
            existing = json.load(f)
        existing.update(metadata)
        metadata = existing
    
    with open(metadata_path, 'w') as f:
        json.dump(metadata, f, indent=2)
    
    print(f"   ✅ {symbol} {model_type}: acc={accuracy*100:.1f}%, samples={len(symbol_data)}, saved to {model_path.name}")
    
    return {
        'symbol': symbol,
        'trade_type': model_type,
        'accuracy': accuracy,
        'samples': len(symbol_data)
    }

def main():
    parser = argparse.ArgumentParser(description='Train per-symbol ML models')
    parser.add_argument('--min-samples', type=int, default=30, help='Minimum samples per symbol')
    parser.add_argument('--symbols', type=str, default=None, help='Comma-separated list of symbols (default: all)')
    args = parser.parse_args()
    
    print("=" * 60)
    print("  🤖 Per-Symbol ML Model Trainer")
    print(f"  {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    
    # Carregar dados
    print("\n📡 Loading training data...")
    df = load_training_data()
    
    if df.empty:
        print("❌ No training data found.")
        return
    
    print(f"   ✅ Loaded {len(df)} total samples")
    
    # Determinar símbolos para treinar
    if args.symbols:
        symbols = [s.strip() for s in args.symbols.split(',')]
    else:
        symbols = df['symbol'].unique().tolist()
    
    print(f"\n🎯 Training models for {len(symbols)} symbols...")
    
    # Diretório de saída
    output_dir = Path(__file__).parent.parent / 'backend' / 'ml_models'
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Treinar modelos
    results = []
    for symbol in symbols:
        print(f"\n📊 {symbol}:")
        
        # Swing
        result_swing = train_symbol_model(symbol, 'Swing', df, output_dir, args.min_samples)
        if result_swing:
            results.append(result_swing)
        
        # Scalping
        result_scalp = train_symbol_model(symbol, 'Scalping', df, output_dir, args.min_samples)
        if result_scalp:
            results.append(result_scalp)
    
    # Resumo
    print("\n" + "=" * 60)
    print(f"✅ Training complete: {len(results)} models trained")
    print("=" * 60)
    
    if results:
        avg_acc = sum(r['accuracy'] for r in results) / len(results)
        print(f"\n📊 Average accuracy: {avg_acc*100:.1f}%")
        print(f"📁 Models saved to: {output_dir}")
    
    print("\n🔄 Restart backend to load new models:")
    print("   pm2 restart tuturos-backend\n")

if __name__ == '__main__':
    main()
```

---

## 📝 CORREÇÃO 4: Atualizar Job de Retreinamento

### ✅ MODIFICAR: `backend/src/jobs/mlRetrainJob.ts`

```typescript
export function executeRetrain(): Promise<boolean> {
    return new Promise((resolve) => {
        const backendDir = path.resolve(__dirname, '../../../');
        const scriptsDir = path.join(backendDir, 'ml_engine');
        
        // ✅ NOVO: Usar script de treinamento por símbolo
        const trainScript = path.join(scriptsDir, 'train_per_symbol.py');
        
        if (!fs.existsSync(trainScript)) {
            logger.warn(`Script de treino não encontrado: ${trainScript}`);
            return resolve(false);
        }
        
        const venvPython = path.join(backendDir, '.venv_ml', 'bin', 'python3');
        const pythonCmd = fs.existsSync(venvPython) ? venvPython
            : process.platform === 'win32' ? 'python' : 'python3';
        
        const cmd = `"${pythonCmd}" "${trainScript}" --min-samples 30`;
        
        logger.info(`[MLRetrain] Executando treinamento por símbolo: ${cmd}`);
        
        exec(cmd, { cwd: backendDir, maxBuffer: 10 * 1024 * 1024 }, async (error, stdout, stderr) => {
            if (stdout) logger.info('[MLRetrain] stdout:\n' + stdout);
            if (stderr) logger.warn('[MLRetrain] stderr:\n' + stderr);
            
            if (error) {
                logger.error('[MLRetrain] Falha no retreinamento', { code: error.code, message: error.message });
                return resolve(false);
            }
            
            logger.info('[MLRetrain] ✅ Retreinamento por símbolo concluído. Limpando cache...');
            
            // Limpar cache de modelos para forçar recarga
            try {
                const { clearModelCache } = await import('../ml/mlPredictionService.js');
                clearModelCache();
                logger.info('[MLRetrain] ✅ Cache de modelos limpo. Novos modelos serão carregados sob demanda.');
            } catch (cacheError) {
                logger.error('[MLRetrain] Erro ao limpar cache', { error: cacheError });
            }
            
            resolve(true);
        });
    });
}
```

---

## 🧪 TESTE DAS CORREÇÕES

### 1. Testar Treinamento por Símbolo

```bash
cd ml_engine
python3 train_per_symbol.py --min-samples 20 --symbols BTCUSDT,ETHUSDT,SOLUSDT
```

Verificar estrutura criada:
```bash
ls -R backend/ml_models/
```

### 2. Testar Predição com Modelo Específico

```typescript
// No console do Node.js
const { predictSignal } = await import('./backend/src/ml/mlPredictionService.js');

const features = {
    symbol_id: 123456,
    rsi: 55,
    adx: 25,
    // ... outros features
};

const prediction = await predictSignal(features, 'BTCUSDT', 'swing');
console.log(prediction);
// Deve mostrar: { ..., modelSource: 'symbol_specific' }
```

### 3. Verificar Estatísticas dos Modelos

```bash
curl http://localhost:3001/api/ml/stats
```

Deve retornar:
```json
{
  "loaded_models": {
    "BTCUSDT_swing": {
      "accuracy": 0.68,
      "sampleSize": 150,
      "trainedAt": "2026-05-09T..."
    },
    "ETHUSDT_scalping": {
      "accuracy": 0.62,
      "sampleSize": 89,
      "trainedAt": "2026-05-09T..."
    }
  },
  "total_models": 12,
  "fallback_loaded": true
}
```

---

## 📊 LOGS DE MONITORAMENTO

Adicionar endpoint de API para monitorar modelos:

```typescript
// backend/src/server/api.ts

router.get('/ml/models', async (_req: Request, res: Response) => {
    try {
        const { getModelStats } = await import('../ml/mlPredictionService.js');
        const stats = getModelStats();
        res.json(stats);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});
```

---

## ✅ RESULTADO ESPERADO

Após estas correções:

1. ✅ **Cada moeda tem seu próprio modelo** (BTCUSDT não influencia ETHUSDT)
2. ✅ **Swing e Scalping separados** por símbolo
3. ✅ **Fallback automático** para símbolos novos
4. ✅ **Cache inteligente** (recarrega modelos a cada 24h)
5. ✅ **Rastreabilidade** (saber qual modelo foi usado em cada predição)

**Isso resolve o Problema 3**: A correlação negativa (-0,21) deve desaparecer, pois cada moeda aprenderá seus próprios padrões.

**Impacto esperado nos dados:**
- Moedas com muitos sinais (STXUSDT): confidence vai subir
- Moedas com poucos sinais: usarão fallback até ter dados suficientes
- Win rate por moeda: deve melhorar significativamente
