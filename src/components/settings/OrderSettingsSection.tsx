import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useOrderSettings } from '@/hooks/useOrderSettings';
import { useAudioNotification } from '@/hooks/useAudioNotification';
import { SoundSelector } from '@/components/SoundSelector';
import { ShoppingCart, Printer, PackageCheck, Bell, Play, ShoppingBag, CalendarCheck, ChefHat, Volume2 } from 'lucide-react';

export function OrderSettingsSection() {
  const {
    duplicateItems, duplicateItemsMaxQty, toggleDuplicateItems, updateDuplicateItemsMaxQty,
    printIndividualItems, togglePrintIndividualItems,
    autoAccept, toggleAutoAccept,
    autoPrintKitchenTicket, toggleAutoPrintKitchenTicket,
    autoPrintCustomerReceipt, toggleAutoPrintCustomerReceipt,
  } = useOrderSettings();

  const { settings: audioSettings, updateSettings: updateAudioSettings, toggleSound, setSelectedSound, testSound } = useAudioNotification();

  return (
    <div className="space-y-6">
      {/* Order behavior */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Comportamento de Pedidos
          </CardTitle>
          <CardDescription>Ajuste o comportamento do sistema de pedidos</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Auto accept */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="font-medium flex items-center gap-2">
                <PackageCheck className="h-4 w-4" />
                Aceitar automaticamente
              </Label>
              <p className="text-sm text-muted-foreground">
                Pedidos entram direto em preparo sem precisar confirmar manualmente
              </p>
            </div>
            <Switch checked={autoAccept} onCheckedChange={toggleAutoAccept} />
          </div>

          {/* Duplicate items */}
          <div className="border-t pt-6 flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="font-medium">Duplicar itens em vez de somar quantidade</Label>
              <p className="text-sm text-muted-foreground">
                Quando ativo, adicionar o mesmo produto cria um novo item separado no pedido.
              </p>
            </div>
            <Switch checked={duplicateItems} onCheckedChange={toggleDuplicateItems} />
          </div>

          {duplicateItems && (
            <div className="ml-4 pl-4 border-l-2 border-muted">
              <div className="flex items-center gap-3">
                <div className="space-y-0.5 flex-1">
                  <Label className="font-medium text-sm">Quantidade máxima para duplicar</Label>
                  <p className="text-xs text-muted-foreground">Acima dessa quantidade, o sistema soma em vez de duplicar. 0 = sem limite.</p>
                </div>
                <Input
                  type="number" min={0} max={100} className="w-20"
                  value={duplicateItemsMaxQty}
                  onChange={(e) => updateDuplicateItemsMaxQty(Number(e.target.value) || 0)}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Auto-print */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Printer className="h-5 w-5" />
            Impressão Automática
          </CardTitle>
          <CardDescription>O que imprimir automaticamente ao confirmar um pedido</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="font-medium">Comanda da cozinha</Label>
              <p className="text-sm text-muted-foreground">Imprime automaticamente a comanda para a cozinha</p>
            </div>
            <Switch checked={autoPrintKitchenTicket} onCheckedChange={toggleAutoPrintKitchenTicket} />
          </div>

          <div className="border-t pt-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="font-medium">Recibo do cliente</Label>
              <p className="text-sm text-muted-foreground">Imprime automaticamente o recibo no caixa</p>
            </div>
            <Switch checked={autoPrintCustomerReceipt} onCheckedChange={toggleAutoPrintCustomerReceipt} />
          </div>

          <div className="border-t pt-4 flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="font-medium flex items-center gap-2">
                <Printer className="h-4 w-4" />
                Imprimir itens em comandas separadas
              </Label>
              <p className="text-sm text-muted-foreground">
                Cada item do pedido será impresso em uma comanda individual.
              </p>
            </div>
            <Switch checked={printIndividualItems} onCheckedChange={togglePrintIndividualItems} />
          </div>
        </CardContent>
      </Card>

      {/* Order Sounds */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Sons de Pedidos
          </CardTitle>
          <CardDescription>Sons de alerta para eventos de pedidos</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Volume2 className="h-4 w-4 text-muted-foreground" />
              <Label>Volume geral: {Math.round(audioSettings.volume * 100)}%</Label>
            </div>
            <Switch
              checked={audioSettings.enabled}
              onCheckedChange={(enabled) => updateAudioSettings({ enabled })}
            />
          </div>
          <Slider
            value={[audioSettings.volume * 100]}
            onValueChange={([value]) => updateAudioSettings({ volume: value / 100 })}
            max={100} step={5}
            disabled={!audioSettings.enabled}
            className="mb-4"
          />
          {[
            { type: 'newOrder' as const, icon: ShoppingBag, iconColor: 'text-primary', label: 'Novo Pedido', description: 'Alerta quando um novo pedido é criado' },
            { type: 'orderReady' as const, icon: ChefHat, iconColor: 'text-accent-foreground', label: 'Pedido Pronto', description: 'Alerta quando um pedido está pronto' },
            { type: 'newReservation' as const, icon: CalendarCheck, iconColor: 'text-info', label: 'Nova Reserva', description: 'Alerta quando uma reserva é feita' },
          ].map(event => {
            const Icon = event.icon;
            return (
              <div key={event.type} className="flex items-center justify-between p-3 rounded-lg border">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-muted">
                    <Icon className={`h-4 w-4 ${event.iconColor}`} />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{event.label}</p>
                    <p className="text-xs text-muted-foreground">{event.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <SoundSelector
                    soundType={event.type}
                    selectedSound={audioSettings.selectedSounds[event.type]}
                    onSelect={(soundId, soundUrl) => setSelectedSound(event.type, soundId, soundUrl)}
                    disabled={!audioSettings.enabled}
                  />
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => testSound(event.type)} disabled={!audioSettings.enabled}>
                    <Play className="h-4 w-4" />
                  </Button>
                  <Switch
                    checked={audioSettings.enabledSounds[event.type]}
                    onCheckedChange={() => toggleSound(event.type)}
                    disabled={!audioSettings.enabled}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
