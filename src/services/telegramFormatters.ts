// Telegram Message Formatters
// Each function produces a formatted string using emojis for Telegram messages

import {
    SignalNotificationData,
    TakeProfitNotificationData,
    StopLossNotificationData,
    RiskAlertNotificationData,
    DailySummaryData,
    MarketAlertData,
    FundingRateAlertData,
} from '@/types/telegram';

// ──────────── Helpers ────────────

const formatPrice = (price: number): string => {
    if (price >= 1000) return `$${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (price >= 1) return `$${price.toFixed(2)}`;
    if (price >= 0.01) return `$${price.toFixed(4)}`;
    return `$${price.toFixed(6)}`;
};

const formatPercent = (value: number): string => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
};

const getScoreLabel = (score: number): string => {
    if (score >= 85) return 'FORTE';
    if (score >= 70) return 'MODERADO';
    if (score >= 50) return 'FRACO';
    return 'MUITO FRACO';
};

// ──────────── New Signal ────────────

export const formatNewSignal = (data: SignalNotificationData): string => {
    const dirEmoji = data.type === 'long' ? '🟢' : '🔴';
    const dirLabel = data.type.toUpperCase();

    let msg = `${dirEmoji} SINAL ${dirLabel} — ${data.symbol}\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `💯 Score: ${data.score}/100 (${data.scoreLabel || getScoreLabel(data.score)})\n`;
    msg += `⏱ Timeframe: ${data.timeframe}\n`;
    msg += `📊 Preço Atual: ${formatPrice(data.currentPrice)}\n\n`;

    msg += `📈 ENTRADA\n`;
    msg += `Zona: ${formatPrice(data.entryZone.min)} — ${formatPrice(data.entryZone.max)}\n\n`;

    msg += `🛑 STOP LOSS\n`;
    msg += `Preço: ${formatPrice(data.stopLoss.price)}\n`;
    msg += `Distância: ${formatPercent(-Math.abs(data.stopLoss.percent))}\n\n`;

    msg += `🎯 TAKE PROFITS\n`;
    for (const tp of data.takeProfits) {
        msg += `TP${tp.level}: ${formatPrice(tp.price)} (${formatPercent(tp.percent)}) — fechar ${tp.closePercent}%\n`;
    }
    msg += `\n`;

    msg += `⚖️ RISCO/RETORNO: 1:${data.riskReward.toFixed(1)}\n\n`;

    if (data.confluences.length > 0) {
        msg += `📊 CONFLUÊNCIAS ATIVAS\n`;
        for (const c of data.confluences) {
            const icon = c.confirmed ? '✅' : '⬜';
            msg += `${icon} ${c.name}\n`;
        }
        msg += `\n`;
    }

    msg += `💰 GESTÃO DE RISCO\n`;
    msg += `Alavancagem sugerida: ${data.leverage}x\n`;
    msg += `Tamanho sugerido: ${data.positionSizePercent}% do capital\n`;
    msg += `Risco: ${data.riskPercent}% do capital\n\n`;

    msg += `🕐 ${data.timestamp}`;

    return msg;
};

// ──────────── Take Profit Hit ────────────

export const formatTakeProfit = (data: TakeProfitNotificationData): string => {
    let msg = `✅ TAKE PROFIT ATINGIDO — ${data.symbol}\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `📍 TP${data.tpLevel} atingido: ${formatPrice(data.price)} (${formatPercent(data.percent)})\n`;
    msg += `⏱ Duração: ${data.duration}\n`;
    msg += `💵 Resultado parcial: ${formatPercent(data.percent)}\n`;
    msg += `📊 Posição restante: ${data.remainingPercent}% ainda aberta\n`;
    if (data.nextTarget) {
        msg += `🎯 Próximo alvo: TP${data.nextTarget.level} ${formatPrice(data.nextTarget.price)}`;
    }
    return msg;
};

// ──────────── Stop Loss Hit ────────────

export const formatStopLoss = (data: StopLossNotificationData): string => {
    let msg = `❌ STOP LOSS ATINGIDO — ${data.symbol}\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `📍 Stop: ${formatPrice(data.price)} (${formatPercent(-Math.abs(data.percent))})\n`;
    msg += `⏱ Duração: ${data.duration}\n`;
    msg += `💵 Resultado: ${formatPercent(-Math.abs(data.percent))}\n`;
    msg += `📉 Win Rate hoje: ${data.dailyWinRate.toFixed(0)}% (${data.dailyWins}W / ${data.dailyLosses}L)`;
    return msg;
};

// ──────────── Risk Alert ────────────

export const formatRiskAlert = (data: RiskAlertNotificationData): string => {
    let msg = `⚠️ ALERTA DE RISCO\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `🔴 Tipo: ${data.alertType}\n`;
    msg += `📊 Valor atual: ${data.currentValue.toFixed(1)}% (limite: ${data.limit.toFixed(0)}%)\n`;
    msg += `💡 Ação: ${data.recommendation}\n`;
    msg += `🕐 ${data.timestamp}`;
    return msg;
};

// ──────────── Daily Summary ────────────

export const formatDailySummary = (data: DailySummaryData): string => {
    const winRate = data.signalsGenerated > 0
        ? ((data.winners / data.signalsGenerated) * 100).toFixed(1)
        : '0.0';

    let msg = `📊 RESUMO DO DIA — ${data.date}\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `📈 Sinais gerados: ${data.signalsGenerated}\n`;
    msg += `✅ Vencedores: ${data.winners} (${winRate}%)\n`;
    msg += `❌ Perdedores: ${data.losers} (${(100 - parseFloat(winRate)).toFixed(1)}%)\n\n`;

    msg += `💰 PERFORMANCE\n`;
    msg += `PnL do dia: ${formatPercent(data.pnlPercent)}\n`;
    if (data.bestTrade) {
        msg += `Melhor operação: ${data.bestTrade.symbol} ${formatPercent(data.bestTrade.pnlPercent)}\n`;
    }
    if (data.worstTrade) {
        msg += `Pior operação: ${data.worstTrade.symbol} ${formatPercent(data.worstTrade.pnlPercent)}\n`;
    }
    msg += `\n`;

    if (data.topSignals.length > 0) {
        msg += `🏆 TOP SINAIS DO DIA\n`;
        data.topSignals.forEach((s, i) => {
            msg += `${i + 1}. ${s.symbol} ${s.type.toUpperCase()} — Score ${s.score}\n`;
        });
        msg += `\n`;
    }

    if (data.alerts.length > 0) {
        msg += `⚠️ ALERTAS DO DIA\n`;
        data.alerts.forEach(a => {
            msg += `- ${a}\n`;
        });
        msg += `\n`;
    }

    msg += `🕐 Próximo resumo: amanhã 00:00 UTC`;
    return msg;
};

// ──────────── Market Alert ────────────

export const formatMarketAlert = (data: MarketAlertData): string => {
    let msg = `🚨 ALERTA DE MERCADO\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `📊 ${data.symbol} — ${data.description}\n`;
    msg += `📉 Variação de ${formatPercent(data.changePercent)} nos últimos ${data.period}\n`;
    if (data.liquidations) {
        msg += `💧 Liquidações: $${(data.liquidations / 1_000_000).toFixed(0)}M em 1 hora\n`;
    }
    msg += `⚠️ ${data.recommendation}\n`;
    msg += `🕐 ${new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC`;
    return msg;
};

// ──────────── Funding Rate Alert ────────────

export const formatFundingRateAlert = (data: FundingRateAlertData): string => {
    const label = Math.abs(data.fundingRate) > 0.1 ? 'muito alto' : 'alto';
    const biasLabel = data.bias === 'long' ? 'QUEDA' : 'ALTA';

    let msg = `⚡ FUNDING RATE EXTREMO\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `📊 ${data.symbol}\n`;
    msg += `💹 Funding: ${data.fundingRate >= 0 ? '+' : ''}${data.fundingRate.toFixed(2)}% (${label})\n`;
    msg += `📌 Sinal contrário: viés de ${biasLabel}\n`;
    msg += `⚠️ ${data.recommendation}\n`;
    msg += `🕐 ${new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC`;
    return msg;
};

// ──────────── Test Message ────────────

export const formatTestMessage = (): string => {
    return `🤖 Bot conectado com sucesso!\n━━━━━━━━━━━━━━━━━━━━\n✅ Conexão ativa\n📡 Notificações habilitadas\n🕐 ${new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC`;
};
