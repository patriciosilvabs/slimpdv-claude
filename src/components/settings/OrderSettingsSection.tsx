import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useOrderSettings } from '@/hooks/useOrderSettings';
import { useTableWaitSettings } from '@/hooks/useTableWaitSettings';
import { Printer } from 'lucide-react';
import { useIdleTableSettings } from '@/hooks/useIdleTableSettings';
import { ShoppingCart } from 'lucide-react';

export function OrderSettingsSection() {
  const { duplicateItems, duplicateItemsMaxQty, toggleDuplicateItems, updateDuplicateItemsMaxQty, printIndividualItems, togglePrintIndividualItems } = useOrderSettings();
  const { settings: tableWaitSettings, updateSettings: updateTableWaitSettings } = useTableWaitSettings();
  const { settings: idleTableSettings, updateSettings: updateIdleTableSettings } = useIdleTableSettings();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <ShoppingCart className="h-5 w-5" />
          Configurações de Pedido
        </CardTitle>
        <CardDescription>
          Ajuste o comportamento do sistema de pedidos
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="font-medium">Duplicar itens em vez de somar quantidade</Label>
            <p className="text-sm text-muted-foreground">
              Quando ativo, adicionar o mesmo produto cria um novo item separado no pedido.
              Facilita a visualização de múltiplos itens na comanda da cozinha.
            </p>
          </div>
          <Switch 
            checked={duplicateItems} 
            onCheckedChange={toggleDuplicateItems} 
          />
        </div>

        {duplicateItems && (
          <div className="ml-4 pl-4 border-l-2 border-muted">
            <div className="flex items-center gap-3">
              <div className="space-y-0.5 flex-1">
                <Label className="font-medium text-sm">Quantidade máxima para duplicar</Label>
                <p className="text-xs text-muted-foreground">
                  Acima dessa quantidade, o sistema soma em vez de duplicar. 0 = sem limite.
                </p>
              </div>
              <Input
                type="number"
                min={0}
                max={100}
                className="w-20"
                value={duplicateItemsMaxQty}
                onChange={(e) => updateDuplicateItemsMaxQty(Number(e.target.value) || 0)}
              />
            </div>
          </div>
        )}

        <div className="border-t pt-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="font-medium flex items-center gap-2">
                <Printer className="h-4 w-4" />
                Imprimir itens em comandas separadas
              </Label>
              <p className="text-sm text-muted-foreground">
                Cada item do pedido será impresso em uma comanda individual. Útil para cozinhas que separam cada prato.
              </p>
            </div>
            <Switch 
              checked={printIndividualItems} 
              onCheckedChange={togglePrintIndividualItems} 
            />
          </div>
        </div>

        <div className="border-t pt-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="font-medium">Alerta de tempo de espera de mesa</Label>
              <p className="text-sm text-muted-foreground">
                Tocar som quando uma mesa ocupada ultrapassar o tempo limite configurado
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Select
                value={tableWaitSettings.thresholdMinutes.toString()}
                onValueChange={(v) => updateTableWaitSettings({ thresholdMinutes: Number(v) })}
                disabled={!tableWaitSettings.enabled}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2 min</SelectItem>
                  <SelectItem value="4">4 min</SelectItem>
                  <SelectItem value="6">6 min</SelectItem>
                  <SelectItem value="8">8 min</SelectItem>
                  <SelectItem value="10">10 min</SelectItem>
                  <SelectItem value="12">12 min</SelectItem>
                  <SelectItem value="14">14 min</SelectItem>
                  <SelectItem value="15">15 min</SelectItem>
                  <SelectItem value="16">16 min</SelectItem>
                  <SelectItem value="18">18 min</SelectItem>
                  <SelectItem value="20">20 min</SelectItem>
                  <SelectItem value="25">25 min</SelectItem>
                  <SelectItem value="30">30 min</SelectItem>
                  <SelectItem value="45">45 min</SelectItem>
                  <SelectItem value="60">60 min</SelectItem>
                </SelectContent>
              </Select>
              <Switch 
                checked={tableWaitSettings.enabled} 
                onCheckedChange={(enabled) => updateTableWaitSettings({ enabled })} 
              />
            </div>
          </div>

          {tableWaitSettings.enabled && (
            <div className="ml-4 pl-4 border-l-2 border-muted mt-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Intervalo de verificação</Label>
                  <p className="text-xs text-muted-foreground">
                    De quanto em quanto tempo o sistema verifica os pedidos
                  </p>
                </div>
                <Select
                  value={tableWaitSettings.checkIntervalSeconds.toString()}
                  onValueChange={(v) => updateTableWaitSettings({ checkIntervalSeconds: Number(v) })}
                >
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 seg</SelectItem>
                    <SelectItem value="30">30 seg</SelectItem>
                    <SelectItem value="45">45 seg</SelectItem>
                    <SelectItem value="60">60 seg</SelectItem>
                    <SelectItem value="90">90 seg</SelectItem>
                    <SelectItem value="120">120 seg</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Alerta persistente</Label>
                  <p className="text-xs text-muted-foreground">
                    Repetir som e popup até o operador dispensar o alerta
                  </p>
                </div>
                <Switch
                  checked={tableWaitSettings.persistentAlert}
                  onCheckedChange={(persistentAlert) => updateTableWaitSettings({ persistentAlert })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Inatividade no KDS</Label>
                  <p className="text-xs text-muted-foreground">
                    Alertar quando pedido ficar parado no KDS sem movimentação
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Select
                    value={tableWaitSettings.kdsIdleMinutes.toString()}
                    onValueChange={(v) => updateTableWaitSettings({ kdsIdleMinutes: Number(v) })}
                    disabled={!tableWaitSettings.kdsIdleEnabled}
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5 min</SelectItem>
                      <SelectItem value="10">10 min</SelectItem>
                      <SelectItem value="15">15 min</SelectItem>
                      <SelectItem value="20">20 min</SelectItem>
                      <SelectItem value="30">30 min</SelectItem>
                    </SelectContent>
                  </Select>
                  <Switch
                    checked={tableWaitSettings.kdsIdleEnabled}
                    onCheckedChange={(kdsIdleEnabled) => updateTableWaitSettings({ kdsIdleEnabled })}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="border-t pt-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="font-medium">Mesa ociosa (sem itens)</Label>
              <p className="text-sm text-muted-foreground">
                Alertar ou fechar mesas abertas sem pedidos após tempo limite
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Select
                value={idleTableSettings.thresholdMinutes.toString()}
                onValueChange={(v) => updateIdleTableSettings({ thresholdMinutes: Number(v) })}
                disabled={!idleTableSettings.enabled}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 min</SelectItem>
                  <SelectItem value="10">10 min</SelectItem>
                  <SelectItem value="15">15 min</SelectItem>
                  <SelectItem value="20">20 min</SelectItem>
                  <SelectItem value="30">30 min</SelectItem>
                </SelectContent>
              </Select>
              <div className="flex items-center gap-2">
                <Label className="text-xs whitespace-nowrap">Auto-fechar</Label>
                <Switch 
                  checked={idleTableSettings.autoClose} 
                  onCheckedChange={(autoClose) => updateIdleTableSettings({ autoClose })}
                  disabled={!idleTableSettings.enabled}
                />
              </div>
              <Switch 
                checked={idleTableSettings.enabled} 
                onCheckedChange={(enabled) => updateIdleTableSettings({ enabled })} 
              />
            </div>
          </div>
          
          <div className="flex items-center justify-between pl-4 border-l-2 border-muted">
            <div className="space-y-0.5">
              <Label className="text-sm">Incluir pedidos entregues</Label>
              <p className="text-xs text-muted-foreground">
                Também alertar quando o pedido já foi servido
              </p>
            </div>
            <Switch 
              checked={idleTableSettings.includeDeliveredOrders} 
              onCheckedChange={(includeDeliveredOrders) => updateIdleTableSettings({ includeDeliveredOrders })}
              disabled={!idleTableSettings.enabled}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
