import React, { useState, useMemo } from 'react';
import { useBacktest } from '@/hooks/useBacktest';
import { BacktestConfig, DEFAULT_BACKTEST_CONFIG, BacktestTrade } from '@/types/backtestTypes';
import { DEFAULT_OPTIMIZATION_PARAMS } from '@/utils/backtestOptimizer';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, ScatterChart, Scatter, Cell, Area, AreaChart, ComposedChart,
} from 'recharts';
import { collectFromBacktest } from '@/services/ml/trainingDataCollector';
import {
    Play, Settings, TrendingUp, BarChart3, Table, Zap, AlertTriangle,
    Download, Trash2, Clock, Target, Shield, Activity, ChevronDown,
    ChevronUp, Search, Filter, ArrowUpRight, ArrowDownRight, Database,
} from 'lucide-react';

// ═══════════════════════════ MAIN PAGE ═══════════════════════════

const Backtesting: React.FC = () => {
    const {
        isRunning, progress, result, optimizationResult, walkForwardResult,
        error, alerts, startBacktest, startQuickBacktest, startOptimization,
        startWalkForward, exportCSV, dismissAlert, savedResults,
        latestResult, loadResult, clearHistory, defaultConfig,
    } = useBacktest();

    const [activeTab, setActiveTab] = useState<'config' | 'results' | 'trades' | 'optimization' | 'walkforward'>('config');
    const [config, setConfig] = useState<BacktestConfig>(defaultConfig);
    const [isCollecting, setIsCollecting] = useState(false);

    const tabs = [
        { id: 'config' as const, label: 'Configuração', icon: Settings },
        { id: 'results' as const, label: 'Resultados', icon: TrendingUp },
        { id: 'trades' as const, label: 'Operações', icon: Table },
        { id: 'optimization' as const, label: 'Otimização', icon: Zap },
        { id: 'walkforward' as const, label: 'Walk Forward', icon: Shield },
    ];

    const handleRun = async () => {
        await startBacktest(config);
        setActiveTab('results');
    };

    const handleCollectData = async () => {
        if (!result) return;
        setIsCollecting(true);
        try {
            const count = await collectFromBacktest(result);
            alert(`Sucesso! ${count} amostras de treino coletadas e enviadas para o Supabase.`);
        } catch (e) {
            console.error(e);
            alert('Erro ao coletar dados. Veja o console.');
        } finally {
            setIsCollecting(false);
        }
    };

    return (
        <div style={{ minHeight: '100vh', background: 'var(--background, #0a0a0f)', color: 'var(--foreground, #e5e7eb)', padding: '1.5rem' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
                <div>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 700, background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                        Backtesting
                    </h1>
                    <p style={{ color: '#9ca3af', fontSize: '0.875rem', marginTop: '0.25rem' }}>
                        Simule e valide sua estratégia em dados históricos
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    {result && (
                        <button
                            onClick={handleCollectData}
                            disabled={isCollecting}
                            style={{
                                padding: '0.5rem 1rem', borderRadius: '0.5rem', border: '1px solid #374151',
                                background: '#1f2937', color: '#10b981', cursor: isCollecting ? 'not-allowed' : 'pointer',
                                display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem',
                            }}
                        >
                            <Database size={16} /> {isCollecting ? 'Enviando...' : 'Coletar Dataset ML'}
                        </button>
                    )}
                    <button
                        onClick={() => startQuickBacktest()}
                        disabled={isRunning}
                        style={{
                            padding: '0.5rem 1rem', borderRadius: '0.5rem', border: '1px solid #374151',
                            background: '#1f2937', color: '#d1d5db', cursor: isRunning ? 'not-allowed' : 'pointer',
                            display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem',
                        }}
                    >
                        <Zap size={16} /> Backtest Rápido (30d)
                    </button>
                    <button
                        onClick={handleRun}
                        disabled={isRunning}
                        style={{
                            padding: '0.5rem 1.25rem', borderRadius: '0.5rem', border: 'none',
                            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', color: '#fff',
                            cursor: isRunning ? 'not-allowed' : 'pointer', display: 'flex',
                            alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.875rem',
                        }}
                    >
                        <Play size={16} /> {isRunning ? 'Executando...' : 'Rodar Backtest'}
                    </button>
                </div>
            </div>

            {/* Progress Bar */}
            {isRunning && progress && (
                <div style={{ marginBottom: '1rem', background: '#1f2937', borderRadius: '0.75rem', padding: '1rem', border: '1px solid #374151' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.875rem', color: '#d1d5db' }}>{progress.message}</span>
                        <span style={{ fontSize: '0.875rem', color: '#3b82f6' }}>{progress.percentComplete}%</span>
                    </div>
                    <div style={{ width: '100%', height: '6px', background: '#374151', borderRadius: '3px' }}>
                        <div style={{ width: `${progress.percentComplete}%`, height: '100%', background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)', borderRadius: '3px', transition: 'width 0.3s' }} />
                    </div>
                </div>
            )}

            {/* Error */}
            {error && (
                <div style={{ marginBottom: '1rem', background: '#7f1d1d33', border: '1px solid #991b1b', borderRadius: '0.5rem', padding: '0.75rem', color: '#fca5a5', fontSize: '0.875rem' }}>
                    <AlertTriangle size={16} style={{ display: 'inline', marginRight: '0.5rem' }} /> {error}
                </div>
            )}

            {/* Alerts */}
            {alerts.length > 0 && (
                <div style={{ marginBottom: '1rem' }}>
                    {alerts.slice(0, 3).map(alert => (
                        <div key={alert.id} style={{
                            marginBottom: '0.5rem', padding: '0.75rem', borderRadius: '0.5rem',
                            background: alert.severity === 'critical' ? '#7f1d1d33' : alert.severity === 'warning' ? '#78350f33' : '#1e3a5f33',
                            border: `1px solid ${alert.severity === 'critical' ? '#991b1b' : alert.severity === 'warning' ? '#92400e' : '#1e40af'}`,
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        }}>
                            <span style={{ fontSize: '0.8rem', color: '#d1d5db' }}>{alert.message}</span>
                            <button onClick={() => dismissAlert(alert.id)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '0.75rem' }}>Dispensar</button>
                        </div>
                    ))}
                </div>
            )}

            {/* Tab Navigation */}
            <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1.5rem', borderBottom: '1px solid #374151', paddingBottom: '0.5rem', overflowX: 'auto' }}>
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        style={{
                            padding: '0.5rem 1rem', borderRadius: '0.5rem 0.5rem 0 0', border: 'none',
                            background: activeTab === tab.id ? '#1f293799' : 'transparent',
                            color: activeTab === tab.id ? '#3b82f6' : '#9ca3af',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem',
                            fontSize: '0.875rem', fontWeight: activeTab === tab.id ? 600 : 400,
                            borderBottom: activeTab === tab.id ? '2px solid #3b82f6' : '2px solid transparent',
                            whiteSpace: 'nowrap',
                        }}
                    >
                        <tab.icon size={16} /> {tab.label}
                    </button>
                ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'config' && <ConfigPanel config={config} setConfig={setConfig} />}
            {activeTab === 'results' && result && <ResultsPanel result={result} />}
            {activeTab === 'results' && !result && <EmptyState message="Execute um backtest para ver resultados" />}
            {activeTab === 'trades' && result && <TradesPanel trades={result.trades} onExport={exportCSV} />}
            {activeTab === 'trades' && !result && <EmptyState message="Execute um backtest para ver operações" />}
            {activeTab === 'optimization' && <OptimizationPanel config={config} startOptimization={startOptimization} result={optimizationResult} isRunning={isRunning} />}
            {activeTab === 'walkforward' && <WalkForwardPanel config={config} startWalkForward={startWalkForward} result={walkForwardResult} isRunning={isRunning} startOptimization={startOptimization} />}

            {/* Saved Results */}
            {savedResults.length > 0 && (
                <div style={{ marginTop: '2rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#d1d5db' }}>Histórico de Backtests</h3>
                        <button onClick={clearHistory} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            <Trash2 size={14} /> Limpar
                        </button>
                    </div>
                    <div style={{ display: 'grid', gap: '0.5rem' }}>
                        {savedResults.slice(0, 5).map(saved => (
                            <div key={saved.id} onClick={() => { loadResult(saved); setActiveTab('results'); }}
                                style={{
                                    padding: '0.75rem', background: '#1f2937', borderRadius: '0.5rem', border: '1px solid #374151',
                                    cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                }}>
                                <div>
                                    <span style={{ fontSize: '0.8rem', color: '#9ca3af' }}>{new Date(saved.timestamp).toLocaleString()}</span>
                                    <span style={{ fontSize: '0.8rem', color: '#6b7280', marginLeft: '0.5rem' }}>{saved.config.symbols.join(', ')}</span>
                                </div>
                                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.875rem', color: saved.metrics.main.totalPnL >= 0 ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                                        {saved.metrics.main.totalPnL >= 0 ? '+' : ''}{saved.metrics.main.totalPnLPercent.toFixed(2)}%
                                    </span>
                                    <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>WR: {saved.metrics.main.winRate.toFixed(1)}%</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// ═══════════════════════════ CONFIG PANEL ═══════════════════════════

const ConfigPanel: React.FC<{ config: BacktestConfig; setConfig: (c: BacktestConfig) => void }> = ({ config, setConfig }) => {
    const update = (path: string, value: any) => {
        const newConfig = JSON.parse(JSON.stringify(config));
        const parts = path.split('.');
        let obj = newConfig;
        for (let i = 0; i < parts.length - 1; i++) obj = obj[parts[i]];
        obj[parts[parts.length - 1]] = value;
        setConfig(newConfig);
    };

    const inputStyle: React.CSSProperties = {
        width: '100%', padding: '0.5rem', borderRadius: '0.375rem', border: '1px solid #374151',
        background: '#111827', color: '#e5e7eb', fontSize: '0.875rem', outline: 'none',
    };
    const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.25rem' };
    const sectionStyle: React.CSSProperties = { background: '#1f2937', borderRadius: '0.75rem', padding: '1.25rem', border: '1px solid #374151' };
    const gridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' };

    return (
        <div style={{ display: 'grid', gap: '1.25rem' }}>
            {/* Período */}
            <div style={sectionStyle}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#d1d5db', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Clock size={16} /> Período & Ativos
                </h3>
                <div style={gridStyle}>
                    <div>
                        <label style={labelStyle}>Data Início</label>
                        <input type="date" value={config.startDate} onChange={e => update('startDate', e.target.value)} style={inputStyle} />
                    </div>
                    <div>
                        <label style={labelStyle}>Data Fim</label>
                        <input type="date" value={config.endDate} onChange={e => update('endDate', e.target.value)} style={inputStyle} />
                    </div>
                    <div>
                        <label style={labelStyle}>Timeframe</label>
                        <select value={config.timeframe} onChange={e => update('timeframe', e.target.value)} style={inputStyle}>
                            <option value="1m">1 Minuto</option>
                            <option value="5m">5 Minutos</option>
                            <option value="15m">15 Minutos</option>
                            <option value="1h">1 Hora</option>
                            <option value="4h">4 Horas</option>
                            <option value="1d">1 Dia</option>
                        </select>
                    </div>
                    <div>
                        <label style={labelStyle}>Capital Inicial (USDT)</label>
                        <input type="number" value={config.initialCapital} onChange={e => update('initialCapital', Number(e.target.value))} style={inputStyle} />
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                        <label style={labelStyle}>Símbolos (separados por vírgula)</label>
                        <input value={config.symbols.join(', ')} onChange={e => update('symbols', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} style={inputStyle} placeholder="BTCUSDT, ETHUSDT" />
                    </div>
                </div>
            </div>

            {/* Execução */}
            <div style={sectionStyle}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#d1d5db', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Activity size={16} /> Configurações de Execução
                </h3>
                <div style={gridStyle}>
                    <div>
                        <label style={labelStyle}>Spread (%)</label>
                        <input type="number" step="0.01" value={config.execution.spread} onChange={e => update('execution.spread', Number(e.target.value))} style={inputStyle} />
                    </div>
                    <div>
                        <label style={labelStyle}>Slippage (%)</label>
                        <input type="number" step="0.01" value={config.execution.slippage} onChange={e => update('execution.slippage', Number(e.target.value))} style={inputStyle} />
                    </div>
                    <div>
                        <label style={labelStyle}>Taxa Maker (%)</label>
                        <input type="number" step="0.01" value={config.execution.makerFee} onChange={e => update('execution.makerFee', Number(e.target.value))} style={inputStyle} />
                    </div>
                    <div>
                        <label style={labelStyle}>Taxa Taker (%)</label>
                        <input type="number" step="0.01" value={config.execution.takerFee} onChange={e => update('execution.takerFee', Number(e.target.value))} style={inputStyle} />
                    </div>
                </div>
            </div>

            {/* Filtros de Sinal */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                <div style={sectionStyle}>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#d1d5db', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Target size={16} /> Filtros de Sinal
                    </h3>
                    <div style={{ display: 'grid', gap: '0.75rem' }}>
                        <div>
                            <label style={labelStyle}>Score Mínimo</label>
                            <input type="number" value={config.signal.minScore} onChange={e => update('signal.minScore', Number(e.target.value))} style={inputStyle} />
                        </div>
                        <div>
                            <label style={labelStyle}>Max Posições Simultâneas</label>
                            <input type="number" value={config.signal.maxSimultaneousPositions} onChange={e => update('signal.maxSimultaneousPositions', Number(e.target.value))} style={inputStyle} />
                        </div>
                        <div>
                            <label style={labelStyle}>Max Capital por Posição (%)</label>
                            <input type="number" value={config.signal.maxCapitalPerPosition} onChange={e => update('signal.maxCapitalPerPosition', Number(e.target.value))} style={inputStyle} />
                        </div>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#d1d5db' }}>
                                <input type="checkbox" checked={config.signal.allowLong} onChange={e => update('signal.allowLong', e.target.checked)} /> Long
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#d1d5db' }}>
                                <input type="checkbox" checked={config.signal.allowShort} onChange={e => update('signal.allowShort', e.target.checked)} /> Short
                            </label>
                        </div>
                    </div>
                </div>

                <div style={sectionStyle}>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#d1d5db', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Shield size={16} /> Gestão de Risco
                    </h3>
                    <div style={{ display: 'grid', gap: '0.75rem' }}>
                        <div>
                            <label style={labelStyle}>Max Drawdown Diário (%)</label>
                            <input type="number" value={config.risk.maxDailyDrawdown} onChange={e => update('risk.maxDailyDrawdown', Number(e.target.value))} style={inputStyle} />
                        </div>
                        <div>
                            <label style={labelStyle}>Max Drawdown Total (%)</label>
                            <input type="number" value={config.risk.maxTotalDrawdown} onChange={e => update('risk.maxTotalDrawdown', Number(e.target.value))} style={inputStyle} />
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#d1d5db' }}>
                            <input type="checkbox" checked={config.risk.useProfilePerSymbol} onChange={e => update('risk.useProfilePerSymbol', e.target.checked)} /> Usar perfil individual por moeda
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: '#d1d5db' }}>
                            <input type="checkbox" checked={config.risk.stopTradingOnMaxDrawdown} onChange={e => update('risk.stopTradingOnMaxDrawdown', e.target.checked)} /> Parar ao atingir max drawdown
                        </label>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ═══════════════════════════ RESULTS PANEL ═══════════════════════════

const ResultsPanel: React.FC<{ result: any }> = ({ result }) => {
    const { metrics, equityCurve, buyAndHoldComparison } = result;
    const m = metrics.main;
    const r = metrics.risk;
    const t = metrics.time;

    const metricCards = [
        { label: 'Capital Final', value: `$${m.finalCapital.toFixed(2)}`, color: m.totalPnL >= 0 ? '#22c55e' : '#ef4444' },
        { label: 'PnL Total', value: `${m.totalPnL >= 0 ? '+' : ''}$${m.totalPnL.toFixed(2)} (${m.totalPnLPercent.toFixed(2)}%)`, color: m.totalPnL >= 0 ? '#22c55e' : '#ef4444' },
        { label: 'Win Rate', value: `${m.winRate.toFixed(1)}%`, color: m.winRate >= 50 ? '#22c55e' : '#ef4444' },
        { label: 'Total Trades', value: m.totalTrades, color: '#3b82f6' },
        { label: 'Profit Factor', value: r.profitFactor === Infinity ? '∞' : r.profitFactor.toFixed(2), color: r.profitFactor >= 1.5 ? '#22c55e' : '#f59e0b' },
        { label: 'Max Drawdown', value: `-${r.maxDrawdownPercent.toFixed(2)}%`, color: r.maxDrawdownPercent > 15 ? '#ef4444' : '#f59e0b' },
        { label: 'Sharpe Ratio', value: r.sharpeRatio.toFixed(2), color: r.sharpeRatio >= 1 ? '#22c55e' : '#f59e0b' },
        { label: 'Sortino Ratio', value: r.sortinoRatio.toFixed(2), color: r.sortinoRatio >= 1.5 ? '#22c55e' : '#f59e0b' },
        { label: 'Expectância', value: `$${m.expectancy.toFixed(2)}`, color: m.expectancy >= 0 ? '#22c55e' : '#ef4444' },
        { label: 'Avg Win', value: `+$${m.avgWin.toFixed(2)}`, color: '#22c55e' },
        { label: 'Avg Loss', value: `-$${m.avgLoss.toFixed(2)}`, color: '#ef4444' },
        { label: 'Recovery Factor', value: r.recoveryFactor.toFixed(2), color: '#3b82f6' },
    ];

    // Prepare chart data (downsample)
    const chartData = useMemo(() => {
        const step = Math.max(1, Math.floor(equityCurve.length / 300));
        return equityCurve.filter((_: any, i: number) => i % step === 0).map((p: any) => ({
            time: new Date(p.timestamp).toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' }),
            equity: parseFloat(p.equity.toFixed(2)),
            drawdown: parseFloat((-p.drawdown).toFixed(2)),
            bh: buyAndHoldComparison?.equityCurve?.find((b: any) => Math.abs(b.timestamp - p.timestamp) < 3600000)?.equity || null,
        }));
    }, [equityCurve, buyAndHoldComparison]);

    // Monthly heatmap data
    const monthlyData = t.monthlyPerformance.map((mp: any) => ({
        label: `${mp.year}-${String(mp.month + 1).padStart(2, '0')}`,
        pnl: mp.pnlPercent,
        trades: mp.trades,
    }));

    return (
        <div style={{ display: 'grid', gap: '1.25rem' }}>
            {/* Metric Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem' }}>
                {metricCards.map(card => (
                    <div key={card.label} style={{ background: '#1f2937', borderRadius: '0.75rem', padding: '1rem', border: '1px solid #374151' }}>
                        <div style={{ fontSize: '0.7rem', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{card.label}</div>
                        <div style={{ fontSize: '1.15rem', fontWeight: 700, color: card.color, marginTop: '0.25rem' }}>{card.value}</div>
                    </div>
                ))}
            </div>

            {/* Equity Curve */}
            <div style={{ background: '#1f2937', borderRadius: '0.75rem', padding: '1.25rem', border: '1px solid #374151' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#d1d5db', marginBottom: '1rem' }}>
                    📈 Equity Curve {buyAndHoldComparison && '(vs Buy & Hold)'}
                </h3>
                <div style={{ height: '320px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis dataKey="time" tick={{ fontSize: 10, fill: '#6b7280' }} interval="preserveStartEnd" />
                            <YAxis tick={{ fontSize: 10, fill: '#6b7280' }} domain={['auto', 'auto']} />
                            <Tooltip contentStyle={{ background: '#111827', border: '1px solid #374151', borderRadius: '0.5rem', fontSize: '0.8rem' }} />
                            <Area type="monotone" dataKey="drawdown" fill="#ef444420" stroke="none" yAxisId={0} />
                            <Line type="monotone" dataKey="equity" stroke="#3b82f6" strokeWidth={2} dot={false} name="Estratégia" />
                            {buyAndHoldComparison && <Line type="monotone" dataKey="bh" stroke="#f59e0b50" strokeWidth={1} dot={false} name="Buy & Hold" strokeDasharray="5 5" />}
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Monthly Performance & More */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.25rem' }}>
                {/* Monthly Heatmap */}
                <div style={{ background: '#1f2937', borderRadius: '0.75rem', padding: '1.25rem', border: '1px solid #374151' }}>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#d1d5db', marginBottom: '1rem' }}>📊 Performance Mensal</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '0.5rem' }}>
                        {monthlyData.map((mp: any) => (
                            <div key={mp.label} style={{
                                padding: '0.5rem', borderRadius: '0.375rem', textAlign: 'center',
                                background: mp.pnl > 0 ? `rgba(34, 197, 94, ${Math.min(Math.abs(mp.pnl) / 10, 0.4)})` : `rgba(239, 68, 68, ${Math.min(Math.abs(mp.pnl) / 10, 0.4)})`,
                                border: `1px solid ${mp.pnl > 0 ? '#22c55e40' : '#ef444440'}`,
                            }}>
                                <div style={{ fontSize: '0.65rem', color: '#9ca3af' }}>{mp.label}</div>
                                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: mp.pnl > 0 ? '#22c55e' : '#ef4444' }}>
                                    {mp.pnl > 0 ? '+' : ''}{mp.pnl.toFixed(1)}%
                                </div>
                                <div style={{ fontSize: '0.6rem', color: '#6b7280' }}>{mp.trades} trades</div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Extra Stats */}
                <div style={{ background: '#1f2937', borderRadius: '0.75rem', padding: '1.25rem', border: '1px solid #374151' }}>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#d1d5db', marginBottom: '1rem' }}>📋 Detalhes</h3>
                    <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.8rem' }}>
                        <StatRow label="Win Rate Long" value={`${m.winRateLong.toFixed(1)}% (${m.totalLongTrades} trades)`} />
                        <StatRow label="Win Rate Short" value={`${m.winRateShort.toFixed(1)}% (${m.totalShortTrades} trades)`} />
                        <StatRow label="Maior Ganho" value={`+$${m.largestWin.toFixed(2)}`} color="#22c55e" />
                        <StatRow label="Maior Perda" value={`$${m.largestLoss.toFixed(2)}`} color="#ef4444" />
                        <StatRow label="Seq. Ganhos" value={`${t.maxConsecutiveWins}`} />
                        <StatRow label="Seq. Perdas" value={`${t.maxConsecutiveLosses}`} />
                        <StatRow label="Calmar Ratio" value={r.calmarRatio.toFixed(2)} />
                        <StatRow label="Taxas Totais" value={`$${m.totalFees.toFixed(2)}`} />
                        <StatRow label="Funding Pago" value={`$${m.totalFundingPaid.toFixed(2)}`} />
                        {buyAndHoldComparison && <StatRow label="Buy & Hold" value={`${buyAndHoldComparison.returnPercent.toFixed(2)}%`} color={buyAndHoldComparison.returnPercent >= 0 ? '#22c55e' : '#ef4444'} />}
                    </div>
                </div>
            </div>
        </div>
    );
};

const StatRow: React.FC<{ label: string; value: string; color?: string }> = ({ label, value, color }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0', borderBottom: '1px solid #37415150' }}>
        <span style={{ color: '#9ca3af' }}>{label}</span>
        <span style={{ fontWeight: 600, color: color || '#d1d5db' }}>{value}</span>
    </div>
);

// ═══════════════════════════ TRADES PANEL ═══════════════════════════

const TradesPanel: React.FC<{ trades: BacktestTrade[]; onExport: () => void }> = ({ trades, onExport }) => {
    const [filter, setFilter] = useState<'all' | 'wins' | 'losses'>('all');
    const [symbolFilter, setSymbolFilter] = useState('');
    const [sortField, setSortField] = useState<'entryTime' | 'netPnl' | 'pnlPercent'>('entryTime');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

    const filtered = useMemo(() => {
        let result = [...trades];
        if (filter === 'wins') result = result.filter(t => t.netPnl > 0);
        if (filter === 'losses') result = result.filter(t => t.netPnl <= 0);
        if (symbolFilter) result = result.filter(t => t.symbol.includes(symbolFilter.toUpperCase()));
        result.sort((a, b) => sortDir === 'asc' ? (a as any)[sortField] - (b as any)[sortField] : (b as any)[sortField] - (a as any)[sortField]);
        return result;
    }, [trades, filter, symbolFilter, sortField, sortDir]);

    const toggleSort = (field: typeof sortField) => {
        if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortField(field); setSortDir('desc'); }
    };

    return (
        <div>
            {/* Filters */}
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                {(['all', 'wins', 'losses'] as const).map(f => (
                    <button key={f} onClick={() => setFilter(f)} style={{
                        padding: '0.375rem 0.75rem', borderRadius: '0.375rem',
                        border: filter === f ? '1px solid #3b82f6' : '1px solid #374151',
                        background: filter === f ? '#1e3a5f' : '#1f2937',
                        color: filter === f ? '#3b82f6' : '#9ca3af',
                        cursor: 'pointer', fontSize: '0.8rem',
                    }}>
                        {f === 'all' ? `Todos (${trades.length})` : f === 'wins' ? `Ganhos (${trades.filter(t => t.netPnl > 0).length})` : `Perdas (${trades.filter(t => t.netPnl <= 0).length})`}
                    </button>
                ))}
                <input
                    value={symbolFilter} onChange={e => setSymbolFilter(e.target.value)}
                    placeholder="Filtrar símbolo..."
                    style={{ padding: '0.375rem 0.75rem', borderRadius: '0.375rem', border: '1px solid #374151', background: '#111827', color: '#e5e7eb', fontSize: '0.8rem' }}
                />
                <button onClick={onExport} style={{ marginLeft: 'auto', padding: '0.375rem 0.75rem', borderRadius: '0.375rem', border: '1px solid #374151', background: '#1f2937', color: '#d1d5db', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Download size={14} /> Exportar CSV
                </button>
            </div>

            {/* Table */}
            <div style={{ overflowX: 'auto', borderRadius: '0.75rem', border: '1px solid #374151' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                    <thead>
                        <tr style={{ background: '#1f2937' }}>
                            {[
                                { key: 'entryTime', label: 'Entrada' },
                                { key: null, label: 'Símbolo' },
                                { key: null, label: 'Direção' },
                                { key: null, label: 'Preço Entrada' },
                                { key: null, label: 'Preço Saída' },
                                { key: 'netPnl', label: 'PnL' },
                                { key: 'pnlPercent', label: 'PnL %' },
                                { key: null, label: 'Saída' },
                                { key: null, label: 'Score' },
                                { key: null, label: 'Duração' },
                            ].map((col, i) => (
                                <th key={i} onClick={() => col.key && toggleSort(col.key as any)} style={{
                                    padding: '0.5rem 0.75rem', textAlign: 'left', color: '#9ca3af', fontWeight: 500,
                                    cursor: col.key ? 'pointer' : 'default', borderBottom: '1px solid #374151', whiteSpace: 'nowrap',
                                }}>
                                    {col.label} {col.key === sortField && (sortDir === 'asc' ? '↑' : '↓')}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {filtered.slice(0, 100).map(trade => (
                            <tr key={trade.id} style={{ borderBottom: '1px solid #37415150' }}>
                                <td style={{ padding: '0.5rem 0.75rem', whiteSpace: 'nowrap', color: '#9ca3af' }}>{new Date(trade.entryTime).toLocaleDateString('pt-BR')}</td>
                                <td style={{ padding: '0.5rem 0.75rem', fontWeight: 600 }}>{trade.symbol}</td>
                                <td style={{ padding: '0.5rem 0.75rem' }}>
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: trade.type === 'long' ? '#22c55e' : '#ef4444' }}>
                                        {trade.type === 'long' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                                        {trade.type.toUpperCase()}
                                    </span>
                                </td>
                                <td style={{ padding: '0.5rem 0.75rem' }}>${trade.entryPrice.toFixed(2)}</td>
                                <td style={{ padding: '0.5rem 0.75rem' }}>${trade.exitPrice.toFixed(2)}</td>
                                <td style={{ padding: '0.5rem 0.75rem', color: trade.netPnl >= 0 ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                                    {trade.netPnl >= 0 ? '+' : ''}${trade.netPnl.toFixed(2)}
                                </td>
                                <td style={{ padding: '0.5rem 0.75rem', color: trade.pnlPercent >= 0 ? '#22c55e' : '#ef4444' }}>
                                    {trade.pnlPercent >= 0 ? '+' : ''}{trade.pnlPercent.toFixed(2)}%
                                </td>
                                <td style={{ padding: '0.5rem 0.75rem' }}>
                                    <span style={{
                                        padding: '0.125rem 0.375rem', borderRadius: '0.25rem', fontSize: '0.7rem',
                                        background: trade.exitReason.includes('tp') ? '#22c55e20' : trade.exitReason === 'sl' ? '#ef444420' : '#f59e0b20',
                                        color: trade.exitReason.includes('tp') ? '#22c55e' : trade.exitReason === 'sl' ? '#ef4444' : '#f59e0b',
                                    }}>
                                        {trade.exitReason.toUpperCase()}
                                    </span>
                                </td>
                                <td style={{ padding: '0.5rem 0.75rem', color: '#9ca3af' }}>{trade.signalScore}</td>
                                <td style={{ padding: '0.5rem 0.75rem', color: '#6b7280', whiteSpace: 'nowrap' }}>
                                    {(trade.duration / (60 * 60 * 1000)).toFixed(1)}h
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {filtered.length > 100 && (
                    <div style={{ padding: '0.75rem', textAlign: 'center', color: '#6b7280', fontSize: '0.8rem' }}>
                        Mostrando 100 de {filtered.length} operações
                    </div>
                )}
            </div>
        </div>
    );
};

// ═══════════════════════════ OPTIMIZATION PANEL ═══════════════════════════

const OptimizationPanel: React.FC<{ config: BacktestConfig; startOptimization: any; result: any; isRunning: boolean }> = ({ config, startOptimization, result, isRunning }) => {
    const handleRun = () => {
        startOptimization({
            baseConfig: config,
            parameters: DEFAULT_OPTIMIZATION_PARAMS,
            rankBy: 'riskAdjusted' as const,
            maxCombinations: 200,
        });
    };

    return (
        <div style={{ display: 'grid', gap: '1.25rem' }}>
            <div style={{ background: '#1f2937', borderRadius: '0.75rem', padding: '1.25rem', border: '1px solid #374151' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#d1d5db', marginBottom: '0.5rem' }}>Grid Search — Otimização de Parâmetros</h3>
                <p style={{ fontSize: '0.8rem', color: '#9ca3af', marginBottom: '1rem' }}>
                    Testa automaticamente combinações de Score Mínimo, Capital por Posição e Max Posições para encontrar os melhores parâmetros.
                </p>
                <button onClick={handleRun} disabled={isRunning} style={{
                    padding: '0.5rem 1rem', borderRadius: '0.5rem', border: 'none',
                    background: isRunning ? '#374151' : 'linear-gradient(135deg, #f59e0b, #d97706)',
                    color: '#fff', cursor: isRunning ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.875rem',
                }}>
                    {isRunning ? 'Otimizando...' : '⚡ Rodar Otimização'}
                </button>
            </div>

            {result && (
                <>
                    {/* Warnings */}
                    {result.overfittingWarnings.length > 0 && (
                        <div style={{ background: '#78350f33', border: '1px solid #92400e', borderRadius: '0.5rem', padding: '0.75rem' }}>
                            {result.overfittingWarnings.map((w: string, i: number) => (
                                <p key={i} style={{ fontSize: '0.8rem', color: '#fbbf24', marginBottom: '0.25rem' }}>{w}</p>
                            ))}
                        </div>
                    )}

                    {/* Best Results */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem' }}>
                        {[
                            { label: '🏆 Maior Lucro', entry: result.bestByProfit },
                            { label: '📊 Melhor Sharpe', entry: result.bestBySharpe },
                            { label: '🛡️ Menor Drawdown', entry: result.bestByDrawdown },
                            { label: '⚖️ Melhor Risco/Retorno', entry: result.bestByRiskAdjusted },
                        ].map(({ label, entry }) => entry && (
                            <div key={label} style={{ background: '#1f2937', borderRadius: '0.75rem', padding: '1rem', border: '1px solid #374151' }}>
                                <div style={{ fontSize: '0.75rem', color: '#9ca3af', marginBottom: '0.5rem' }}>{label}</div>
                                <div style={{ fontSize: '1.1rem', fontWeight: 700, color: entry.totalPnL >= 0 ? '#22c55e' : '#ef4444' }}>
                                    {entry.totalPnL >= 0 ? '+' : ''}{entry.totalPnLPercent.toFixed(2)}%
                                </div>
                                <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: '0.5rem' }}>
                                    {Object.entries(entry.params).map(([k, v]) => `${k.split('.').pop()}: ${v}`).join(' | ')}
                                </div>
                                <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                                    WR: {entry.winRate.toFixed(1)}% | PF: {entry.profitFactor.toFixed(2)} | DD: {entry.maxDrawdownPercent.toFixed(1)}%
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Full Ranking Table */}
                    <div style={{ background: '#1f2937', borderRadius: '0.75rem', padding: '1rem', border: '1px solid #374151', overflowX: 'auto' }}>
                        <h4 style={{ fontSize: '0.85rem', color: '#d1d5db', marginBottom: '0.75rem' }}>Ranking Completo ({result.completedCombinations} combinações)</h4>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid #374151' }}>
                                    <th style={{ padding: '0.5rem', textAlign: 'left', color: '#9ca3af' }}>#</th>
                                    <th style={{ padding: '0.5rem', textAlign: 'left', color: '#9ca3af' }}>Parâmetros</th>
                                    <th style={{ padding: '0.5rem', textAlign: 'right', color: '#9ca3af' }}>PnL %</th>
                                    <th style={{ padding: '0.5rem', textAlign: 'right', color: '#9ca3af' }}>WR</th>
                                    <th style={{ padding: '0.5rem', textAlign: 'right', color: '#9ca3af' }}>Sharpe</th>
                                    <th style={{ padding: '0.5rem', textAlign: 'right', color: '#9ca3af' }}>DD Max</th>
                                    <th style={{ padding: '0.5rem', textAlign: 'right', color: '#9ca3af' }}>PF</th>
                                    <th style={{ padding: '0.5rem', textAlign: 'right', color: '#9ca3af' }}>Trades</th>
                                </tr>
                            </thead>
                            <tbody>
                                {result.results.slice(0, 20).map((entry: any) => (
                                    <tr key={entry.rank} style={{ borderBottom: '1px solid #37415150' }}>
                                        <td style={{ padding: '0.5rem', color: entry.rank <= 3 ? '#f59e0b' : '#6b7280' }}>{entry.rank}</td>
                                        <td style={{ padding: '0.5rem', color: '#9ca3af' }}>
                                            {Object.entries(entry.params).map(([k, v]) => `${k.split('.').pop()}=${v}`).join(', ')}
                                        </td>
                                        <td style={{ padding: '0.5rem', textAlign: 'right', color: entry.totalPnLPercent >= 0 ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                                            {entry.totalPnLPercent.toFixed(2)}%
                                        </td>
                                        <td style={{ padding: '0.5rem', textAlign: 'right' }}>{entry.winRate.toFixed(1)}%</td>
                                        <td style={{ padding: '0.5rem', textAlign: 'right' }}>{entry.sharpeRatio.toFixed(2)}</td>
                                        <td style={{ padding: '0.5rem', textAlign: 'right', color: '#ef4444' }}>{entry.maxDrawdownPercent.toFixed(1)}%</td>
                                        <td style={{ padding: '0.5rem', textAlign: 'right' }}>{entry.profitFactor.toFixed(2)}</td>
                                        <td style={{ padding: '0.5rem', textAlign: 'right' }}>{entry.totalTrades}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
};

// ═══════════════════════════ WALK FORWARD PANEL ═══════════════════════════

const WalkForwardPanel: React.FC<{ config: BacktestConfig; startWalkForward: any; result: any; isRunning: boolean; startOptimization: any }> = ({ config, startWalkForward, result, isRunning }) => {
    const handleRun = () => {
        startWalkForward({
            baseConfig: config,
            optimizationConfig: {
                baseConfig: config,
                parameters: DEFAULT_OPTIMIZATION_PARAMS.slice(0, 2),
                rankBy: 'riskAdjusted' as const,
                maxCombinations: 50,
            },
            windowMonths: 6,
            inSampleRatio: 0.6,
        });
    };

    return (
        <div style={{ display: 'grid', gap: '1.25rem' }}>
            <div style={{ background: '#1f2937', borderRadius: '0.75rem', padding: '1.25rem', border: '1px solid #374151' }}>
                <h3 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#d1d5db', marginBottom: '0.5rem' }}>Walk Forward Analysis</h3>
                <p style={{ fontSize: '0.8rem', color: '#9ca3af', marginBottom: '1rem' }}>
                    Divide o período em janelas, otimiza parâmetros no passado e valida no futuro. Detecta se a estratégia é robusta ou se há overfitting.
                </p>
                <button onClick={handleRun} disabled={isRunning} style={{
                    padding: '0.5rem 1rem', borderRadius: '0.5rem', border: 'none',
                    background: isRunning ? '#374151' : 'linear-gradient(135deg, #8b5cf6, #6d28d9)',
                    color: '#fff', cursor: isRunning ? 'not-allowed' : 'pointer', fontWeight: 600, fontSize: '0.875rem',
                }}>
                    {isRunning ? 'Analisando...' : '🔬 Rodar Walk Forward'}
                </button>
            </div>

            {result && (
                <>
                    {/* Summary */}
                    <div style={{
                        background: result.isConsistent ? '#052e1640' : '#7f1d1d33',
                        border: `1px solid ${result.isConsistent ? '#059669' : '#991b1b'}`,
                        borderRadius: '0.75rem', padding: '1rem',
                    }}>
                        <p style={{ fontSize: '0.9rem', fontWeight: 600, color: result.isConsistent ? '#22c55e' : '#ef4444' }}>
                            {result.summary}
                        </p>
                        <p style={{ fontSize: '0.8rem', color: '#9ca3af', marginTop: '0.25rem' }}>
                            Eficiência geral: {(result.overallEfficiency * 100).toFixed(0)}% | {result.windows.length} janelas analisadas
                        </p>
                    </div>

                    {/* Windows */}
                    <div style={{ display: 'grid', gap: '0.75rem' }}>
                        {result.windows.map((w: any) => (
                            <div key={w.windowIndex} style={{ background: '#1f2937', borderRadius: '0.5rem', padding: '1rem', border: '1px solid #374151', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', alignItems: 'center' }}>
                                <div>
                                    <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>Janela {w.windowIndex + 1}</div>
                                    <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                                        {new Date(w.inSampleStart).toLocaleDateString('pt-BR')} → {new Date(w.outOfSampleEnd).toLocaleDateString('pt-BR')}
                                    </div>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', textAlign: 'center' }}>
                                    <div>
                                        <div style={{ fontSize: '0.65rem', color: '#6b7280' }}>In-Sample</div>
                                        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: w.inSamplePnLPercent >= 0 ? '#22c55e' : '#ef4444' }}>
                                            {w.inSamplePnLPercent >= 0 ? '+' : ''}{w.inSamplePnLPercent.toFixed(1)}%
                                        </div>
                                        <div style={{ fontSize: '0.65rem', color: '#9ca3af' }}>WR: {w.inSampleWinRate.toFixed(0)}%</div>
                                    </div>
                                    <div>
                                        <div style={{ fontSize: '0.65rem', color: '#6b7280' }}>Out-of-Sample</div>
                                        <div style={{ fontSize: '0.9rem', fontWeight: 600, color: w.outOfSamplePnLPercent >= 0 ? '#22c55e' : '#ef4444' }}>
                                            {w.outOfSamplePnLPercent >= 0 ? '+' : ''}{w.outOfSamplePnLPercent.toFixed(1)}%
                                        </div>
                                        <div style={{ fontSize: '0.65rem', color: '#9ca3af' }}>WR: {w.outOfSampleWinRate.toFixed(0)}%</div>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '0.65rem', color: '#6b7280' }}>Eficiência</div>
                                    <div style={{ fontSize: '1rem', fontWeight: 700, color: w.efficiency > 0.5 ? '#22c55e' : w.efficiency > 0 ? '#f59e0b' : '#ef4444' }}>
                                        {(w.efficiency * 100).toFixed(0)}%
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

// ═══════════════════════════ EMPTY STATE ═══════════════════════════

const EmptyState: React.FC<{ message: string }> = ({ message }) => (
    <div style={{ textAlign: 'center', padding: '4rem 2rem', color: '#6b7280' }}>
        <BarChart3 size={48} style={{ margin: '0 auto 1rem', opacity: 0.3 }} />
        <p style={{ fontSize: '0.9rem' }}>{message}</p>
    </div>
);

export default Backtesting;
