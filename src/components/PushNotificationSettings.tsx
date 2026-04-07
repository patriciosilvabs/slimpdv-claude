import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  BellRing, 
  Smartphone, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  CheckCircle, 
  AlertCircle,
  Clock
} from 'lucide-react';

export function PushNotificationSettings() {
  const { 
    isSupported, 
    permission, 
    settings, 
    updateSettings, 
    requestPermission,
    sendNotification 
  } = usePushNotifications();

  const handleRequestPermission = async () => {
    const granted = await requestPermission();
    if (granted) {
      await sendNotification('Notificações ativadas!', {
        body: 'Você receberá alertas sobre sincronização de dados.',
        tag: 'permission-granted',
      });
    }
  };

  const handleTestNotification = async () => {
    await sendNotification('Teste de notificação', {
      body: 'Esta é uma notificação de teste do PDV Pizzaria.',
      tag: 'test-notification',
    });
  };

  if (!isSupported) {
    return (
      <Card className="border-muted">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <BellRing className="h-5 w-5" />
            Notificações Push
          </CardTitle>
          <CardDescription>
            Seu navegador não suporta notificações push.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <BellRing className="h-5 w-5" />
              Notificações Push
            </CardTitle>
            <CardDescription>
              Alertas sobre sincronização e operações pendentes
            </CardDescription>
          </div>
          <Badge variant={permission === 'granted' ? 'default' : 'secondary'}>
            {permission === 'granted' ? 'Ativadas' : permission === 'denied' ? 'Bloqueadas' : 'Pendente'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Permission request */}
        {permission !== 'granted' && (
          <div className="p-4 rounded-lg bg-primary/5 border border-primary/20 space-y-3">
            <div className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-primary" />
              <p className="font-medium text-sm">Permissão necessária</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Permita notificações para receber alertas quando houver operações pendentes de sincronização.
            </p>
            <Button onClick={handleRequestPermission} size="sm">
              Permitir notificações
            </Button>
          </div>
        )}

        {permission === 'granted' && (
          <>
            {/* Master toggle */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="push-enabled">Ativar notificações push</Label>
                <p className="text-sm text-muted-foreground">
                  Receba alertas sobre sincronização de dados
                </p>
              </div>
              <Switch
                id="push-enabled"
                checked={settings.enabled}
                onCheckedChange={(enabled) => updateSettings({ enabled })}
              />
            </div>

            {/* Individual notification types */}
            <div className="space-y-4">
              <Label className="text-sm font-medium">Tipos de Notificação</Label>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-warning/10">
                      <WifiOff className="h-4 w-4 text-warning" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Operações Pendentes</p>
                      <p className="text-xs text-muted-foreground">
                        Quando há operações aguardando sincronização
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={settings.pendingSync}
                    onCheckedChange={(pendingSync) => updateSettings({ pendingSync })}
                    disabled={!settings.enabled}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-success/10">
                      <CheckCircle className="h-4 w-4 text-success" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Sincronização Concluída</p>
                      <p className="text-xs text-muted-foreground">
                        Quando as operações são sincronizadas com sucesso
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={settings.syncComplete}
                    onCheckedChange={(syncComplete) => updateSettings({ syncComplete })}
                    disabled={!settings.enabled}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-destructive/10">
                      <AlertCircle className="h-4 w-4 text-destructive" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Erros de Sincronização</p>
                      <p className="text-xs text-muted-foreground">
                        Quando há falhas na sincronização
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={settings.syncError}
                    onCheckedChange={(syncError) => updateSettings({ syncError })}
                    disabled={!settings.enabled}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-info/10">
                      <Clock className="h-4 w-4 text-info" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">Lembrete Offline</p>
                      <p className="text-xs text-muted-foreground">
                        Lembrete quando offline com operações pendentes antigas
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={settings.offlineReminder}
                    onCheckedChange={(offlineReminder) => updateSettings({ offlineReminder })}
                    disabled={!settings.enabled}
                  />
                </div>
              </div>
            </div>

            {/* Test button */}
            <div className="pt-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleTestNotification}
                disabled={!settings.enabled}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Testar notificação
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
