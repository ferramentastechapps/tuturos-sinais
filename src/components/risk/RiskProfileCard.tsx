import { useState } from 'react';
import { AssetRiskConfig } from '@/types/riskProfiles';
import { RISK_PROFILES } from '@/data/riskProfileDefaults';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import {
    Shield, ShieldAlert, ShieldCheck, Zap,
    TrendingUp, Settings2, ChevronRight,
} from 'lucide-react';

interface RiskProfileCardProps {
    config: AssetRiskConfig;
    onEdit: (symbol: string) => void;
    onToggle: (symbol: string, enabled: boolean) => void;
}

const profileIcons = {
    conservative: ShieldCheck,
    moderate: Shield,
    aggressive: ShieldAlert,
    speculative: Zap,
};

const profileColors = {
    conservative: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
    moderate: 'text-blue-500 bg-blue-500/10 border-blue-500/20',
    aggressive: 'text-orange-500 bg-orange-500/10 border-orange-500/20',
    speculative: 'text-red-500 bg-red-500/10 border-red-500/20',
};

const profileBadgeColors = {
    conservative: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    moderate: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    aggressive: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    speculative: 'bg-red-500/15 text-red-400 border-red-500/30',
};

export const RiskProfileCard = ({ config, onEdit, onToggle }: RiskProfileCardProps) => {
    const profile = RISK_PROFILES[config.riskProfile];
    const Icon = profileIcons[config.riskProfile];

    return (
        <div
            className={cn(
                'group relative rounded-xl border p-4 transition-all duration-200',
                'hover:shadow-lg hover:shadow-primary/5 hover:border-primary/30',
                config.enabled
                    ? 'bg-card border-border'
                    : 'bg-muted/30 border-muted opacity-70'
            )}
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                    <div className={cn('p-2 rounded-lg border', profileColors[config.riskProfile])}>
                        <Icon className="h-4 w-4" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-foreground text-sm">{config.symbol}</h3>
                            <Badge
                                variant="outline"
                                className={cn('text-[10px] px-1.5 py-0', profileBadgeColors[config.riskProfile])}
                            >
                                {profile.label}
                            </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{config.name}</p>
                    </div>
                </div>
                <Switch
                    checked={config.enabled}
                    onCheckedChange={(checked) => onToggle(config.symbol, checked)}
                />
            </div>

            {/* Params */}
            <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="text-center p-2 rounded-lg bg-muted/50">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Leverage</p>
                    <p className="text-sm font-mono font-semibold text-foreground">
                        {config.leverage.suggested}x
                    </p>
                    <p className="text-[10px] text-muted-foreground">max {config.leverage.max}x</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-muted/50">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Stop Loss</p>
                    <p className="text-sm font-mono font-semibold text-destructive">
                        {config.stopLoss.min}%
                    </p>
                    <p className="text-[10px] text-muted-foreground">até {config.stopLoss.max}%</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-muted/50">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Take Profit</p>
                    <p className="text-sm font-mono font-semibold text-emerald-500">
                        {config.takeProfit.tp1.percent}%
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                        {config.takeProfit.tp2.percent}% / {config.takeProfit.tp3.percent}%
                    </p>
                </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-2 border-t border-border/50">
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        Risco: {config.position.maxRiskPercent}%
                    </span>
                    <span>RR: {config.position.minRiskReward}:1</span>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(config.symbol)}
                    className="h-7 text-xs gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                    <Settings2 className="h-3 w-3" />
                    Editar
                    <ChevronRight className="h-3 w-3" />
                </Button>
            </div>
        </div>
    );
};
