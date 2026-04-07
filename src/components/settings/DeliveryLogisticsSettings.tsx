import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useDeliveryLogistics } from '@/hooks/useDeliveryLogistics';
import { Truck, Clock, MapPin, Package } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function DeliveryLogisticsSettings() {
  const { config, saveConfig, bufferedCount, isEnabled } = useDeliveryLogistics();
  const { toast } = useToast();

  const handleSave = async (changes: Partial<typeof config>) => {
    try {
      await saveConfig(changes);
      toast({ title: 'Configuração salva', description: 'Logística de delivery atualizada.' });
    } catch {
      toast({ title: 'Erro ao salvar', variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Agrupamento Logístico de Delivery
              </CardTitle>
              <CardDescription>
                Segure pedidos delivery por uma janela de tempo para agrupá-los geograficamente
              </CardDescription>
            </div>
            {isEnabled && bufferedCount > 0 && (
              <Badge variant="secondary" className="animate-pulse">
                <Package className="h-3 w-3 mr-1" />
                {bufferedCount} em buffer
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Toggle principal */}
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="logistics-enabled" className="text-base font-medium">Ativar agrupamento</Label>
              <p className="text-sm text-muted-foreground">
                Quando ativado, pedidos delivery ficam em buffer antes de ir para produção
              </p>
            </div>
            <Switch
              id="logistics-enabled"
              checked={config.enabled}
              onCheckedChange={(checked) => handleSave({ enabled: checked })}
            />
          </div>

          {config.enabled && (
            <>
              {/* Buffer time */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Tempo de buffer
                </Label>
                <Select
                  value={String(config.buffer_minutes)}
                  onValueChange={(v) => handleSave({ buffer_minutes: Number(v) })}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 minuto</SelectItem>
                    <SelectItem value="2">2 minutos</SelectItem>
                    <SelectItem value="3">3 minutos</SelectItem>
                    <SelectItem value="5">5 minutos</SelectItem>
                    <SelectItem value="10">10 minutos</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Tempo que o pedido aguarda antes de ser liberado para produção
                </p>
              </div>

              {/* Strategy */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Estratégia de agrupamento
                </Label>
                <Select
                  value={config.strategy}
                  onValueChange={(v) => handleSave({ strategy: v as typeof config.strategy })}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="disabled">Desativado (só buffer)</SelectItem>
                    <SelectItem value="neighborhood">Por bairro</SelectItem>
                    <SelectItem value="proximity">Por proximidade</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {config.strategy === 'disabled' && 'Pedidos são segurados pelo tempo de buffer e liberados individualmente'}
                  {config.strategy === 'neighborhood' && 'Pedidos do mesmo bairro são agrupados para entrega conjunta'}
                  {config.strategy === 'proximity' && 'Pedidos próximos geograficamente são agrupados (usa geocodificação)'}
                </p>
              </div>

              {/* Max radius (only for proximity) */}
              {config.strategy === 'proximity' && (
                <div className="space-y-2">
                  <Label>Raio máximo de agrupamento (km)</Label>
                  <Input
                    type="number"
                    min={0.5}
                    max={10}
                    step={0.5}
                    value={config.max_group_radius_km}
                    onChange={(e) => handleSave({ max_group_radius_km: Number(e.target.value) })}
                    className="w-32"
                  />
                </div>
              )}

              {/* Info box */}
              <div className="bg-muted/50 rounded-lg p-4 text-sm space-y-1">
                <p className="font-medium">Como funciona:</p>
                <ol className="list-decimal list-inside text-muted-foreground space-y-1">
                  <li>Pedido delivery entra e fica em buffer (não aparece no KDS)</li>
                  <li>Durante o tempo de buffer, o sistema tenta agrupar com pedidos compatíveis</li>
                  <li>Após o tempo expirar, o pedido é liberado para produção normalmente</li>
                  <li>Se a geocodificação falhar, o pedido é liberado imediatamente</li>
                </ol>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
