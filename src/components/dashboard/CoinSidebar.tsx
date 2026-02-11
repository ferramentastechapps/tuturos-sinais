import { useState, useMemo, useCallback } from 'react';
import { Search, SlidersHorizontal, TrendingUp, TrendingDown, ChevronDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuCheckboxItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
    DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { CryptoPair, AssetCategory } from '@/types/trading';
import { CoinSignalScore } from '@/services/dashboardDataService';

interface CoinSidebarProps {
    pairs: CryptoPair[];
    scores: CoinSignalScore[];
    selectedSymbol: string | null;
    onSelectPair: (pair: CryptoPair) => void;
}

type SortKey = 'score' | 'volume' | 'change' | 'name';
type SignalFilter = 'all' | 'buy' | 'sell' | 'neutral';

const CATEGORY_LABELS: Record<string, string> = {
    layer1: 'Layer 1',
    layer2: 'Layer 2',
    defi: 'DeFi',
    exchange: 'Exchange',
    meme: 'Meme',
    gaming: 'Gaming',
    ai: 'AI',
    infra: 'Infra',
    privacy: 'Privacy',
    rwa: 'RWA',
    trending: 'Trending',
    other: 'Outros',
};

const SORT_LABELS: Record<SortKey, string> = {
    score: 'Score',
    volume: 'Volume',
    change: 'Variação 24h',
    name: 'Nome',
};

export const CoinSidebar = ({
    pairs,
    scores,
    selectedSymbol,
    onSelectPair,
}: CoinSidebarProps) => {
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<AssetCategory | 'all'>('all');
    const [signalFilter, setSignalFilter] = useState<SignalFilter>('all');
    const [sortBy, setSortBy] = useState<SortKey>('score');

    // Build a map of scores for fast lookup
    const scoreMap = useMemo(() => {
        const map = new Map<string, CoinSignalScore>();
        scores.forEach(s => map.set(s.symbol, s));
        return map;
    }, [scores]);

    // Filter and sort pairs
    const filteredPairs = useMemo(() => {
        let result = [...pairs];

        // Search filter
        if (search) {
            const q = search.toLowerCase();
            result = result.filter(
                p => p.symbol.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)
            );
        }

        // Category filter
        if (categoryFilter !== 'all') {
            result = result.filter(p => p.category === categoryFilter);
        }

        // Signal filter
        if (signalFilter !== 'all') {
            result = result.filter(p => {
                const score = scoreMap.get(p.symbol);
                if (!score) return signalFilter === 'neutral';
                return score.signalType === signalFilter;
            });
        }

        // Sort
        result.sort((a, b) => {
            switch (sortBy) {
                case 'score': {
                    const sa = scoreMap.get(a.symbol)?.score || 0;
                    const sb = scoreMap.get(b.symbol)?.score || 0;
                    return sb - sa;
                }
                case 'volume':
                    return b.volume24h - a.volume24h;
                case 'change':
                    return Math.abs(b.change24h) - Math.abs(a.change24h);
                case 'name':
                    return a.name.localeCompare(b.name);
                default:
                    return 0;
            }
        });

        return result;
    }, [pairs, search, categoryFilter, signalFilter, sortBy, scoreMap]);

    // Available categories from current pairs
    const availableCategories = useMemo(() => {
        const cats = new Set<string>();
        pairs.forEach(p => {
            if (p.category) cats.add(p.category);
        });
        return Array.from(cats).sort();
    }, [pairs]);

    const getScoreColor = useCallback((score: number) => {
        if (score >= 75) return 'text-signal-buy';
        if (score >= 50) return 'text-signal-alert';
        if (score >= 25) return 'text-signal-sell';
        return 'text-muted-foreground';
    }, []);

    const getScoreBarWidth = useCallback((score: number) => {
        return `${Math.min(100, Math.max(2, score))}%`;
    }, []);

    const getScoreBarColor = useCallback((score: number) => {
        if (score >= 75) return 'bg-signal-buy';
        if (score >= 50) return 'bg-signal-alert';
        if (score >= 25) return 'bg-signal-sell/80';
        return 'bg-muted';
    }, []);

    return (
        <div className="flex flex-col h-full">
            {/* ── Filters Section ── */}
            <div className="p-3 space-y-2 border-b border-border flex-shrink-0">
                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                        placeholder="Buscar moeda..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="h-8 pl-8 text-xs bg-secondary/50 border-border/50"
                    />
                </div>

                {/* Filter Row */}
                <div className="flex items-center gap-1.5">
                    {/* Category */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1 px-2 flex-1">
                                {categoryFilter === 'all' ? 'Categoria' : CATEGORY_LABELS[categoryFilter] || categoryFilter}
                                <ChevronDown className="h-3 w-3 opacity-50" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-40">
                            <DropdownMenuLabel className="text-xs">Categoria</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuCheckboxItem
                                checked={categoryFilter === 'all'}
                                onCheckedChange={() => setCategoryFilter('all')}
                                className="text-xs"
                            >
                                Todas
                            </DropdownMenuCheckboxItem>
                            {availableCategories.map(cat => (
                                <DropdownMenuCheckboxItem
                                    key={cat}
                                    checked={categoryFilter === cat}
                                    onCheckedChange={() => setCategoryFilter(cat as AssetCategory)}
                                    className="text-xs"
                                >
                                    {CATEGORY_LABELS[cat] || cat}
                                </DropdownMenuCheckboxItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Signal Type */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1 px-2 flex-1">
                                {signalFilter === 'all' ? 'Sinal' : signalFilter === 'buy' ? '🟢 Compra' : signalFilter === 'sell' ? '🔴 Venda' : '⚪ Neutro'}
                                <ChevronDown className="h-3 w-3 opacity-50" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-36">
                            <DropdownMenuLabel className="text-xs">Tipo de Sinal</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => setSignalFilter('all')} className="text-xs">Todos</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setSignalFilter('buy')} className="text-xs">🟢 Compra</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setSignalFilter('sell')} className="text-xs">🔴 Venda</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setSignalFilter('neutral')} className="text-xs">⚪ Neutro</DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Sort */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="icon" className="h-7 w-7 flex-shrink-0">
                                <SlidersHorizontal className="h-3 w-3" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-36">
                            <DropdownMenuLabel className="text-xs">Ordenar por</DropdownMenuLabel>
                            <DropdownMenuSeparator />
                            {(Object.keys(SORT_LABELS) as SortKey[]).map(key => (
                                <DropdownMenuCheckboxItem
                                    key={key}
                                    checked={sortBy === key}
                                    onCheckedChange={() => setSortBy(key)}
                                    className="text-xs"
                                >
                                    {SORT_LABELS[key]}
                                </DropdownMenuCheckboxItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                {/* Results count */}
                <p className="text-[10px] text-muted-foreground">
                    {filteredPairs.length} moeda{filteredPairs.length !== 1 ? 's' : ''}
                </p>
            </div>

            {/* ── Coin List ── */}
            <ScrollArea className="flex-1">
                <div className="p-1.5">
                    {filteredPairs.map((pair) => {
                        const coinScore = scoreMap.get(pair.symbol);
                        const score = coinScore?.score || 0;
                        const isSelected = selectedSymbol === pair.symbol;
                        const hasSignal = coinScore?.hasActiveSignal || false;

                        return (
                            <button
                                key={pair.symbol}
                                onClick={() => onSelectPair(pair)}
                                className={cn(
                                    'w-full text-left px-2.5 py-2 rounded-md transition-all duration-150',
                                    'hover:bg-accent/50 group',
                                    isSelected && 'bg-accent/80 ring-1 ring-primary/30',
                                    'animate-fade-up'
                                )}
                            >
                                <div className="flex items-center gap-2.5">
                                    {/* Coin Icon placeholder + signal indicator */}
                                    <div className="relative flex-shrink-0">
                                        <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-[10px] font-bold text-foreground/70">
                                            {pair.symbol.replace('USDT', '').slice(0, 3)}
                                        </div>
                                        {/* Blinking active signal dot */}
                                        {hasSignal && (
                                            <span
                                                className={cn(
                                                    'absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full animate-blink ring-2 ring-card',
                                                    coinScore?.signalType === 'buy' ? 'bg-signal-buy' : 'bg-signal-sell'
                                                )}
                                            />
                                        )}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-semibold text-foreground truncate">
                                                {pair.symbol.replace('USDT', '')}
                                            </span>
                                            <span className="text-xs font-mono text-foreground">
                                                ${pair.price < 1 ? pair.price.toFixed(6) : pair.price < 100 ? pair.price.toFixed(2) : pair.price.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                            </span>
                                        </div>

                                        <div className="flex items-center justify-between mt-0.5">
                                            <span className="text-[10px] text-muted-foreground truncate">{pair.name}</span>
                                            <span
                                                className={cn(
                                                    'flex items-center gap-0.5 text-[10px] font-medium',
                                                    pair.change24h >= 0 ? 'text-signal-buy' : 'text-signal-sell'
                                                )}
                                            >
                                                {pair.change24h >= 0 ? (
                                                    <TrendingUp className="w-2.5 h-2.5" />
                                                ) : (
                                                    <TrendingDown className="w-2.5 h-2.5" />
                                                )}
                                                {pair.change24h >= 0 ? '+' : ''}
                                                {pair.change24h.toFixed(2)}%
                                            </span>
                                        </div>

                                        {/* Score Bar */}
                                        {score > 0 && (
                                            <div className="mt-1.5 flex items-center gap-1.5">
                                                <div className="flex-1 h-1 rounded-full bg-secondary overflow-hidden">
                                                    <div
                                                        className={cn('h-full rounded-full transition-all duration-500', getScoreBarColor(score))}
                                                        style={{ width: getScoreBarWidth(score) }}
                                                    />
                                                </div>
                                                <span className={cn('text-[10px] font-mono font-medium tabular-nums', getScoreColor(score))}>
                                                    {score}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </button>
                        );
                    })}

                    {filteredPairs.length === 0 && (
                        <div className="text-center py-8 text-muted-foreground">
                            <Search className="w-8 h-8 mx-auto mb-2 opacity-20" />
                            <p className="text-xs">Nenhuma moeda encontrada</p>
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
};
