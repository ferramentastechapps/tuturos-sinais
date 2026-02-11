// Risk Logger — Sistema de logs e relatórios de risco
// Registra ajustes automáticos, alertas e gera relatórios diários

import { RiskLogEntry, RiskLogType, DailyReport } from '@/types/riskProfiles';
import { telegramService } from '@/services/telegramService';
import { telegramConfigManager } from '@/services/telegramConfigManager';

// ──────────── Constantes ────────────

const STORAGE_KEY_LOGS = 'risk_logs';
const MAX_LOG_DAYS = 7;
const MAX_LOG_ENTRIES = 500;

// ──────────── Helpers ────────────

const generateId = (): string => {
    return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

const loadLogs = (): RiskLogEntry[] => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY_LOGS);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
};

const saveLogs = (logs: RiskLogEntry[]): void => {
    try {
        // Rotaciona: mantém apenas últimos MAX_LOG_DAYS dias e MAX_LOG_ENTRIES entradas
        const cutoff = Date.now() - MAX_LOG_DAYS * 24 * 60 * 60 * 1000;
        const filtered = logs
            .filter(log => log.timestamp >= cutoff)
            .slice(-MAX_LOG_ENTRIES);
        localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(filtered));
    } catch (e) {
        console.error('[RiskLogger] Failed to save logs:', e);
    }
};

// ──────────── Risk Logger ────────────

class RiskLoggerClass {
    private logs: RiskLogEntry[];

    constructor() {
        this.logs = loadLogs();
    }

    /**
     * Registra um ajuste automático de parâmetro.
     */
    logAdjustment(
        symbol: string,
        field: string,
        oldValue: number,
        newValue: number,
        reason: string
    ): RiskLogEntry {
        const entry: RiskLogEntry = {
            id: generateId(),
            timestamp: Date.now(),
            type: 'adjustment',
            symbol,
            message: `${symbol} — ${field}: ${oldValue} → ${newValue} (${reason})`,
            details: { field, oldValue, newValue, reason },
            severity: Math.abs(newValue - oldValue) / oldValue > 0.3 ? 'warning' : 'info',
        };
        return this.addLog(entry);
    }

    /**
     * Registra um alerta de proximidade de limite.
     */
    logAlert(
        symbol: string,
        alertType: string,
        message: string,
        severity: 'info' | 'warning' | 'critical' = 'warning'
    ): RiskLogEntry {
        const entry: RiskLogEntry = {
            id: generateId(),
            timestamp: Date.now(),
            type: 'alert',
            symbol,
            message,
            details: { alertType },
            severity,
        };
        return this.addLog(entry);
    }

    /**
     * Registra bloqueio de operação.
     */
    logBlock(
        symbol: string,
        reason: string,
        details?: Record<string, unknown>
    ): RiskLogEntry {
        const entry: RiskLogEntry = {
            id: generateId(),
            timestamp: Date.now(),
            type: 'block',
            symbol,
            message: `🚫 Operação bloqueada em ${symbol}: ${reason}`,
            details: { reason, ...details },
            severity: 'critical',
        };
        return this.addLog(entry);
    }

    /**
     * Registra uma operação realizada.
     */
    logTrade(
        symbol: string,
        type: 'long' | 'short',
        result: 'win' | 'loss',
        pnl: number,
        details?: Record<string, unknown>
    ): RiskLogEntry {
        const entry: RiskLogEntry = {
            id: generateId(),
            timestamp: Date.now(),
            type: 'trade',
            symbol,
            message: `${symbol} ${type.toUpperCase()} — ${result === 'win' ? '✅' : '❌'} PnL: ${pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} USDT`,
            details: { type, result, pnl, ...details },
            severity: result === 'loss' ? 'warning' : 'info',
        };
        return this.addLog(entry);
    }

    /**
     * Gera relatório diário.
     */
    generateDailyReport(date?: string): DailyReport {
        const reportDate = date || new Date().toISOString().split('T')[0];
        const dayStart = new Date(reportDate).getTime();
        const dayEnd = dayStart + 24 * 60 * 60 * 1000;

        const dayLogs = this.logs.filter(l => l.timestamp >= dayStart && l.timestamp < dayEnd);

        const trades = dayLogs.filter(l => l.type === 'trade');
        const wins = trades.filter(l => l.details?.result === 'win');
        const losses = trades.filter(l => l.details?.result === 'loss');

        // Calcular PnL por ativo
        const assetPnl = new Map<string, { trades: number; pnl: number }>();
        trades.forEach(t => {
            const sym = t.symbol || 'UNKNOWN';
            const existing = assetPnl.get(sym) || { trades: 0, pnl: 0 };
            existing.trades++;
            existing.pnl += (t.details?.pnl as number) || 0;
            assetPnl.set(sym, existing);
        });

        const topTradedAssets = Array.from(assetPnl.entries())
            .map(([symbol, data]) => ({ symbol, ...data }))
            .sort((a, b) => b.trades - a.trades)
            .slice(0, 10);

        const totalPnl = trades.reduce((sum, t) => sum + ((t.details?.pnl as number) || 0), 0);

        const report: DailyReport = {
            date: reportDate,
            totalTrades: trades.length,
            winningTrades: wins.length,
            losingTrades: losses.length,
            winRate: trades.length > 0 ? (wins.length / trades.length) * 100 : 0,
            totalRiskUsed: Math.abs(totalPnl),
            dailyDrawdown: totalPnl < 0 ? Math.abs(totalPnl) : 0,
            weeklyDrawdown: 0, // Calculado separadamente
            topTradedAssets,
            adjustmentsMade: dayLogs.filter(l => l.type === 'adjustment').length,
            alertsTriggered: dayLogs.filter(l => l.type === 'alert').length,
            blockedOperations: dayLogs.filter(l => l.type === 'block').length,
        };

        // Registra o relatório como log
        this.addLog({
            id: generateId(),
            timestamp: Date.now(),
            type: 'report',
            message: `📊 Relatório Diário ${reportDate} — ${trades.length} trades, WR: ${report.winRate.toFixed(1)}%, DD: ${report.dailyDrawdown.toFixed(2)}`,
            details: report as unknown as Record<string, unknown>,
            severity: report.dailyDrawdown > 3 ? 'warning' : 'info',
        });

        return report;
    }

    // ──── Queries ────

    /**
     * Retorna todos os logs, opcionalmente filtrados.
     */
    getLogs(filters?: {
        type?: RiskLogType;
        symbol?: string;
        severity?: RiskLogEntry['severity'];
        since?: number;
        limit?: number;
    }): RiskLogEntry[] {
        let result = [...this.logs];

        if (filters?.type) {
            result = result.filter(l => l.type === filters.type);
        }
        if (filters?.symbol) {
            result = result.filter(l => l.symbol === filters.symbol);
        }
        if (filters?.severity) {
            result = result.filter(l => l.severity === filters.severity);
        }
        if (filters?.since) {
            result = result.filter(l => l.timestamp >= filters.since!);
        }

        // Mais recentes primeiro
        result.sort((a, b) => b.timestamp - a.timestamp);

        if (filters?.limit) {
            result = result.slice(0, filters.limit);
        }

        return result;
    }

    /**
     * Retorna logs do dia atual.
     */
    getTodayLogs(): RiskLogEntry[] {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        return this.getLogs({ since: todayStart.getTime() });
    }

    /**
     * Retorna contagem de trades perdedores consecutivos recentes.
     */
    getConsecutiveLosses(): number {
        const trades = this.getLogs({ type: 'trade' });
        let count = 0;
        for (const trade of trades) {
            if (trade.details?.result === 'loss') {
                count++;
            } else {
                break; // Para no primeiro win
            }
        }
        return count;
    }

    /**
     * Calcula drawdown diário atual (%).
     */
    getDailyDrawdown(portfolioCapital: number): number {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayTrades = this.getLogs({ type: 'trade', since: todayStart.getTime() });
        const totalPnl = todayTrades.reduce((sum, t) => sum + ((t.details?.pnl as number) || 0), 0);
        return portfolioCapital > 0 ? Math.abs(Math.min(totalPnl, 0)) / portfolioCapital * 100 : 0;
    }

    /**
     * Calcula drawdown semanal atual (%).
     */
    getWeeklyDrawdown(portfolioCapital: number): number {
        const weekStart = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const weekTrades = this.getLogs({ type: 'trade', since: weekStart });
        const totalPnl = weekTrades.reduce((sum, t) => sum + ((t.details?.pnl as number) || 0), 0);
        return portfolioCapital > 0 ? Math.abs(Math.min(totalPnl, 0)) / portfolioCapital * 100 : 0;
    }

    /**
     * Limpa todos os logs.
     */
    clearLogs(): void {
        this.logs = [];
        saveLogs(this.logs);
    }

    // ──── Internal ────

    private addLog(entry: RiskLogEntry): RiskLogEntry {
        this.logs.push(entry);
        saveLogs(this.logs);
        console.log(`[RiskLog] [${entry.severity.toUpperCase()}] ${entry.message}`);

        // Send critical alerts to Telegram
        if ((entry.severity === 'critical' || entry.severity === 'warning') && telegramConfigManager.isEnabled()) {
            telegramService.sendRiskAlert({
                alertType: entry.details?.alertType as string || entry.type,
                currentValue: (entry.details?.dailyDD as number) || (entry.details?.weeklyDD as number) || 0,
                limit: (entry.details?.limit as number) || 0,
                recommendation: entry.message,
                timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19) + ' UTC',
            }).catch(err => console.error('[RiskLog] Telegram send error:', err));
        }

        return entry;
    }
}

// Singleton
export const riskLogger = new RiskLoggerClass();
