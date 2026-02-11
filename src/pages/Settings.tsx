import { SimpleHeader } from '@/components/trading/SimpleHeader';
import { useDataBackup } from '@/hooks/useDataBackup';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Download, Upload, Trash2, Database, Shield, Bell } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useRef } from 'react';
import { Switch } from '@/components/ui/switch';
import { TelegramSettings } from '@/components/dashboard/TelegramSettings';

const Settings = () => {
  const { exportBackup, importBackup, clearAllData } = useDataBackup();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      importBackup(file);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SimpleHeader />

      <main className="container mx-auto px-4 py-6 space-y-6 max-w-4xl">
        <div>
          <h1 className="text-2xl font-bold">Configurações</h1>
          <p className="text-muted-foreground">Gerencie suas preferências e dados</p>
        </div>

        {/* Backup & Restore */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Backup e Restauração
            </CardTitle>
            <CardDescription>
              Faça backup dos seus dados ou restaure de um arquivo anterior
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <Button onClick={exportBackup} className="flex-1">
                <Download className="h-4 w-4 mr-2" />
                Exportar Backup
              </Button>
              <Button onClick={handleImportClick} variant="outline" className="flex-1">
                <Upload className="h-4 w-4 mr-2" />
                Importar Backup
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>
            <Alert>
              <AlertDescription className="text-sm">
                O backup inclui: portfolio, trades, transações e configurações.
                Seus dados são salvos apenas localmente no navegador.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Notifications */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notificações
            </CardTitle>
            <CardDescription>
              Configure alertas e notificações
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Alertas de Preço</Label>
                <p className="text-sm text-muted-foreground">
                  Receber notificações quando alertas forem acionados
                </p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Som de Alerta</Label>
                <p className="text-sm text-muted-foreground">
                  Reproduzir som quando alertas forem acionados
                </p>
              </div>
              <Switch defaultChecked />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Alertas de Performance</Label>
                <p className="text-sm text-muted-foreground">
                  Notificar sobre drawdown alto ou metas atingidas
                </p>
              </div>
              <Switch />
            </div>
          </CardContent>
        </Card>

        {/* Telegram Bot Settings */}
        <TelegramSettings />

        {/* Trading Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Preferências de Trading
            </CardTitle>
            <CardDescription>
              Configure valores padrão e limites
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="defaultFee">Taxa Padrão (%)</Label>
                <Input
                  id="defaultFee"
                  type="number"
                  step="0.01"
                  placeholder="0.1"
                  defaultValue="0.1"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="defaultExchange">Exchange Padrão</Label>
                <Input
                  id="defaultExchange"
                  placeholder="Binance"
                  defaultValue="Binance"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="initialCapital">Capital Inicial ($)</Label>
                <Input
                  id="initialCapital"
                  type="number"
                  placeholder="10000"
                  defaultValue="10000"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="riskPerTrade">Risco por Trade (%)</Label>
                <Input
                  id="riskPerTrade"
                  type="number"
                  step="0.1"
                  placeholder="2"
                  defaultValue="2"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Data Management */}
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Zona de Perigo
            </CardTitle>
            <CardDescription>
              Ações irreversíveis - use com cuidado
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertDescription>
                <strong>Atenção:</strong> Apagar todos os dados é uma ação permanente e não pode ser desfeita.
                Faça um backup antes de prosseguir.
              </AlertDescription>
            </Alert>
            <Button
              onClick={clearAllData}
              variant="destructive"
              className="w-full sm:w-auto"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Apagar Todos os Dados
            </Button>
          </CardContent>
        </Card>

        {/* About */}
        <Card>
          <CardHeader>
            <CardTitle>Sobre</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p><strong>Versão:</strong> 1.0.0</p>
            <p><strong>Última Atualização:</strong> Janeiro 2026</p>
            <p>
              CryptoFutures é uma ferramenta de gestão de trading de criptomoedas.
              Todos os dados são armazenados localmente no seu navegador.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Settings;
