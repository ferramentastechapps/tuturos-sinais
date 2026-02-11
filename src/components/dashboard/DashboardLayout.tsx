import { useState } from 'react';
import { PanelLeft, PanelRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DashboardLayoutProps {
    sidebar: React.ReactNode;
    center: React.ReactNode;
    rightPanel?: React.ReactNode;
    bottomBar?: React.ReactNode;
}

export const DashboardLayout = ({
    sidebar,
    center,
    rightPanel,
    bottomBar,
}: DashboardLayoutProps) => {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [rightPanelOpen, setRightPanelOpen] = useState(false);

    return (
        <div className="relative">
            {/* Main 3-Column Grid */}
            <div className="dashboard-grid">
                {/* ── Left Sidebar (always visible on xl+, drawer on smaller) ── */}
                <aside
                    className={cn(
                        // Desktop: static sidebar
                        'hidden xl:flex flex-col border-r border-border bg-card/30 overflow-hidden',
                    )}
                >
                    {sidebar}
                </aside>

                {/* Mobile sidebar overlay */}
                {sidebarOpen && (
                    <div className="xl:hidden fixed inset-0 z-50 flex">
                        <div
                            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
                            onClick={() => setSidebarOpen(false)}
                        />
                        <aside className="relative w-[300px] max-w-[85vw] bg-card border-r border-border flex flex-col animate-slide-right shadow-2xl">
                            <div className="flex items-center justify-between p-3 border-b border-border">
                                <span className="text-sm font-semibold text-foreground">Moedas</span>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => setSidebarOpen(false)}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                            {sidebar}
                        </aside>
                    </div>
                )}

                {/* ── Center Area ── */}
                <main className="flex flex-col overflow-y-auto overflow-x-hidden">
                    {/* Mobile toggle buttons */}
                    <div className="xl:hidden flex items-center gap-1 px-3 py-2 border-b border-border bg-card/30">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1.5 text-xs"
                            onClick={() => setSidebarOpen(true)}
                        >
                            <PanelLeft className="h-3.5 w-3.5" />
                            Moedas
                        </Button>
                        {rightPanel && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 gap-1.5 text-xs ml-auto"
                                onClick={() => setRightPanelOpen(true)}
                            >
                                Posições
                                <PanelRight className="h-3.5 w-3.5" />
                            </Button>
                        )}
                    </div>

                    <div className="flex-1 p-3 sm:p-4 lg:p-5 space-y-4">
                        {center}
                    </div>
                </main>

                {/* ── Right Panel (visible on xl+) ── */}
                {rightPanel && (
                    <aside className="hidden xl:flex flex-col border-l border-border bg-card/30 overflow-y-auto overflow-x-hidden">
                        {rightPanel}
                    </aside>
                )}

                {/* Mobile right panel overlay */}
                {rightPanelOpen && rightPanel && (
                    <div className="xl:hidden fixed inset-0 z-50 flex justify-end">
                        <div
                            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
                            onClick={() => setRightPanelOpen(false)}
                        />
                        <aside className="relative w-[340px] max-w-[90vw] bg-card border-l border-border flex flex-col shadow-2xl">
                            <div className="flex items-center justify-between p-3 border-b border-border">
                                <span className="text-sm font-semibold text-foreground">Posições & Métricas</span>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => setRightPanelOpen(false)}
                                >
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                            <div className="flex-1 overflow-y-auto">
                                {rightPanel}
                            </div>
                        </aside>
                    </div>
                )}
            </div>

            {/* ── Bottom Ticker Bar ── */}
            {bottomBar && (
                <div className="fixed bottom-0 left-0 right-0 z-40">
                    {bottomBar}
                </div>
            )}
        </div>
    );
};
