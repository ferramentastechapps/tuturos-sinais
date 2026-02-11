import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { mlService } from '@/services/ml/mlService';
import { MLModelMetrics, MLServiceStatus } from '@/types/mlTypes';
import { Loader2, BrainCircuit, BarChart3, Database } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { fetchTrainingData } from '@/services/ml/mlContentManager';

const MLAnalytics = () => {
    const { toast } = useToast();
    const [status, setStatus] = useState<MLServiceStatus>(mlService.getStatus());
    const [metrics, setMetrics] = useState<MLModelMetrics | null>(null);
    const [dataCount, setDataCount] = useState<number>(0);
    const [isTraining, setIsTraining] = useState(false);

    useEffect(() => {
        loadData();
        const interval = setInterval(loadData, 5000);
        return () => clearInterval(interval);
    }, []);

    const loadData = async () => {
        setStatus(mlService.getStatus());

        // Fetch data count
        const { samples } = await fetchTrainingData(1); // just to check if exists or get count if API supported count
        // For now, let's just get the active model's metrics if available
        // In a real app we'd store metrics in state or fetch them

        // Mock fetching count for now or implement count query
        // setDataCount(samples.length); 
    };

    const handleTrain = async () => {
        setIsTraining(true);
        toast({ title: 'Training Initiated', description: 'Training Random Forest model...' });

        try {
            const newMetrics = await mlService.trainModel('random_forest');
            setMetrics(newMetrics);
            toast({ title: 'Training Complete', description: `Accuracy: ${(newMetrics?.accuracy || 0 * 100).toFixed(1)}%` });
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Training Failed', description: error.message });
        } finally {
            setIsTraining(false);
            loadData();
        }
    };

    return (
        <div className="container mx-auto p-6 space-y-8 animate-fade-in">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-600">
                        ML Analytics
                    </h1>
                    <p className="text-muted-foreground mt-2">
                        Machine Learning signal optimization and performance metrics
                    </p>
                </div>
                <Button
                    onClick={handleTrain}
                    disabled={isTraining}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                >
                    {isTraining ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BrainCircuit className="mr-2 h-4 w-4" />}
                    Train New Model
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Model Status</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold flex items-center">
                            {status.isReady ? (
                                <span className="text-green-500 flex items-center">Active <BrainCircuit className="ml-2 h-5 w-5" /></span>
                            ) : (
                                <span className="text-yellow-500">Not Trained</span>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Version: {status.activeModelVersion || 'N/A'}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Training Data</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{status.trainingSamplesCount}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Total samples available
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Model Accuracy</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {metrics ? `${(metrics.accuracy * 100).toFixed(1)}%` : 'N/A'}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            On validation set
                        </p>
                    </CardContent>
                </Card>
            </div>

            <Tabs defaultValue="performance" className="w-full">
                <TabsList>
                    <TabsTrigger value="performance">Performance</TabsTrigger>
                    <TabsTrigger value="features">Feature Importance</TabsTrigger>
                </TabsList>

                <TabsContent value="performance" className="mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Model Metrics</CardTitle>
                            <CardDescription>Detailed performance metrics of the active model</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                                {metrics ? (
                                    <div className="grid grid-cols-2 gap-8 w-full max-w-2xl">
                                        <div className="space-y-2">
                                            <div className="flex justify-between"><span>Accuracy</span><span>{(metrics.accuracy * 100).toFixed(1)}%</span></div>
                                            <div className="flex justify-between"><span>Precision</span><span>{(metrics.precision * 100).toFixed(1)}%</span></div>
                                            <div className="flex justify-between"><span>Recall</span><span>{(metrics.recall * 100).toFixed(1)}%</span></div>
                                        </div>
                                        <div className="space-y-2">
                                            <div className="flex justify-between"><span>F1 Score</span><span>{(metrics.f1Score * 100).toFixed(1)}%</span></div>
                                            <div className="flex justify-between"><span>Win Rate</span><span>{(metrics.winRate * 100).toFixed(1)}%</span></div>
                                            <div className="flex justify-between"><span>Profit Factor</span><span>{metrics.profitFactor.toFixed(2)}</span></div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center">
                                        <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-20" />
                                        <p>Train a model to view performance metrics</p>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="features" className="mt-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Feature Importance</CardTitle>
                            <CardDescription>Which factors contribute most to model predictions</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                                <p>Feature importance visualization coming soon</p>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
};

export default MLAnalytics;
