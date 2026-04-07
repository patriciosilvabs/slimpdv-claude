import { useAudioNotification } from '@/hooks/useAudioNotification';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Bell, Volume2, UtensilsCrossed, ShoppingCart, ChefHat } from 'lucide-react';

export function NotificationSettings() {
  const { settings, updateSettings } = useAudioNotification();

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Controle de Som Global
          </CardTitle>
          <CardDescription>
            Ative/desative e ajuste o volume de todos os alertas sonoros do sistema
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="notifications-enabled" className="font-medium">Ativar todas as notificações sonoras</Label>
              <p className="text-sm text-muted-foreground">
                Liga ou desliga todos os sons de alerta do sistema de uma vez
              </p>
            </div>
            <Switch
              id="notifications-enabled"
              checked={settings.enabled}
              onCheckedChange={(enabled) => updateSettings({ enabled })}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Volume2 className="h-4 w-4 text-muted-foreground" />
              <Label>Volume global: {Math.round(settings.volume * 100)}%</Label>
            </div>
            <Slider
              value={[settings.volume * 100]}
              onValueChange={([value]) => updateSettings({ volume: value / 100 })}
              max={100}
              step={5}
              disabled={!settings.enabled}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-base text-muted-foreground">Sons por funcionalidade</CardTitle>
          <CardDescription>
            Os sons de alerta foram organizados dentro de cada seção correspondente:
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3 text-sm">
            <li className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-muted"><UtensilsCrossed className="h-4 w-4 text-amber-500" /></div>
              <div>
                <p className="font-medium">Configurações → Mesas</p>
                <p className="text-muted-foreground text-xs">Alerta de espera de mesa · Mesa ociosa</p>
              </div>
            </li>
            <li className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-muted"><ChefHat className="h-4 w-4 text-orange-500" /></div>
              <div>
                <p className="font-medium">Configurações → KDS</p>
                <p className="text-muted-foreground text-xs">Novo pedido KDS · Pedido cancelado · Tempo máximo · Item atrasado</p>
              </div>
            </li>
            <li className="flex items-center gap-3">
              <div className="p-2 rounded-md bg-muted"><ShoppingCart className="h-4 w-4 text-primary" /></div>
              <div>
                <p className="font-medium">Configurações → Pedidos</p>
                <p className="text-muted-foreground text-xs">Novo pedido · Pedido pronto · Nova reserva</p>
              </div>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
