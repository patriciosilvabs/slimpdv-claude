import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTables, useTableMutations } from '@/hooks/useTables';
import { useToast } from '@/hooks/use-toast';
import { UtensilsCrossed, Plus, Edit, Trash2, Clock, Timer, Bell, Play, Volume2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { useTableWaitSettings } from '@/hooks/useTableWaitSettings';
import { useIdleTableSettings } from '@/hooks/useIdleTableSettings';
import { useAudioNotification } from '@/hooks/useAudioNotification';
import { SoundSelector } from '@/components/SoundSelector';

export function TablesSettings() {
  const { data: tables } = useTables();
  const { createTable, updateTable, deleteTable } = useTableMutations();
  const { toast } = useToast();

  const [tablesToCreate, setTablesToCreate] = useState(5);
  const [defaultCapacity, setDefaultCapacity] = useState(4);
  const [isCreatingTables, setIsCreatingTables] = useState(false);
  const [editingTable, setEditingTable] = useState<any>(null);
  const [tableForm, setTableForm] = useState({ number: 0, capacity: 4 });
  const [isTableDialogOpen, setIsTableDialogOpen] = useState(false);

  const { settings: tableWaitSettings, updateSettings: updateTableWaitSettings } = useTableWaitSettings();
  const { settings: idleTableSettings, updateSettings: updateIdleTableSettings } = useIdleTableSettings();
  const { settings: audioSettings, updateSettings: updateAudioSettings, toggleSound, setSelectedSound, testSound } = useAudioNotification();

  const handleCreateTables = async () => {
    if (tablesToCreate <= 0) return;
    
    setIsCreatingTables(true);
    try {
      const existingNumbers = tables?.map(t => t.number) || [];
      let startNumber = existingNumbers.length > 0 ? Math.max(...existingNumbers) + 1 : 1;
      
      for (let i = 0; i < tablesToCreate; i++) {
        await createTable.mutateAsync({ 
          number: startNumber + i, 
          capacity: defaultCapacity,
          status: 'available',
          position_x: 0,
          position_y: 0
        });
      }
      
      toast({ title: `${tablesToCreate} mesa(s) criada(s) com sucesso!` });
      setTablesToCreate(5);
    } catch (error: any) {
      toast({ 
        title: 'Erro ao criar mesas', 
        description: error.message, 
        variant: 'destructive' 
      });
    } finally {
      setIsCreatingTables(false);
    }
  };

  const handleEditTable = (table: any) => {
    setEditingTable(table);
    setTableForm({ number: table.number, capacity: table.capacity || 4 });
    setIsTableDialogOpen(true);
  };

  const handleSaveTable = async () => {
    if (!editingTable) return;
    
    try {
      await updateTable.mutateAsync({ 
        id: editingTable.id, 
        number: tableForm.number, 
        capacity: tableForm.capacity 
      });
      toast({ title: 'Mesa atualizada!' });
      setIsTableDialogOpen(false);
      setEditingTable(null);
    } catch (error: any) {
      toast({ 
        title: 'Erro ao atualizar mesa', 
        description: error.message, 
        variant: 'destructive' 
      });
    }
  };

  const handleDeleteTable = async (tableId: string) => {
    const table = tables?.find(t => t.id === tableId);
    if (table?.status === 'occupied') {
      toast({ 
        title: 'Mesa ocupada', 
        description: 'Não é possível excluir uma mesa ocupada', 
        variant: 'destructive' 
      });
      return;
    }
    
    try {
      await deleteTable.mutateAsync(tableId);
      toast({ title: 'Mesa excluída!' });
    } catch (error: any) {
      toast({ 
        title: 'Erro ao excluir mesa', 
        description: error.message, 
        variant: 'destructive' 
      });
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <UtensilsCrossed className="h-5 w-5" />
            Configuração de Mesas
          </CardTitle>
          <CardDescription>
            Gerencie as mesas do estabelecimento
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Create Tables in Batch */}
          <div className="flex flex-col sm:flex-row gap-4 p-4 border rounded-lg bg-muted/30">
            <div className="flex-1 space-y-2">
              <Label>Quantidade de Mesas</Label>
              <Input
                type="number"
                min={1}
                max={50}
                value={tablesToCreate}
                onChange={(e) => setTablesToCreate(Number(e.target.value))}
              />
            </div>
            <div className="flex-1 space-y-2">
              <Label>Capacidade Padrão</Label>
              <Input
                type="number"
                min={1}
                max={20}
                value={defaultCapacity}
                onChange={(e) => setDefaultCapacity(Number(e.target.value))}
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleCreateTables} disabled={isCreatingTables || tablesToCreate <= 0}>
                <Plus className="h-4 w-4 mr-2" />
                {isCreatingTables ? 'Criando...' : 'Criar Mesas'}
              </Button>
            </div>
          </div>

          {/* Existing Tables */}
          <div>
            <Label className="text-sm text-muted-foreground mb-2 block">
              Mesas Existentes ({tables?.length || 0})
            </Label>
            {tables && tables.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mesa</TableHead>
                    <TableHead>Capacidade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tables.map((table) => (
                    <TableRow key={table.id}>
                      <TableCell className="font-medium">Mesa {table.number}</TableCell>
                      <TableCell>{table.capacity || 4} pessoas</TableCell>
                      <TableCell>
                        <Badge variant={table.status === 'available' ? 'secondary' : 'default'}>
                          {table.status === 'available' ? 'Livre' : 
                           table.status === 'occupied' ? 'Ocupada' : 
                           table.status === 'reserved' ? 'Reservada' : 'Conta'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditTable(table)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteTable(table.id)}
                            disabled={table.status === 'occupied'}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-8 text-muted-foreground border rounded-lg">
                <UtensilsCrossed className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma mesa cadastrada</p>
                <p className="text-sm">Use o formulário acima para criar mesas</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit Table Dialog */}
      <Dialog open={isTableDialogOpen} onOpenChange={setIsTableDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Mesa</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label>Número da Mesa</Label>
              <Input
                type="number"
                value={tableForm.number}
                onChange={(e) => setTableForm({ ...tableForm, number: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Capacidade</Label>
              <Input
                type="number"
                min={1}
                max={20}
                value={tableForm.capacity}
                onChange={(e) => setTableForm({ ...tableForm, capacity: Number(e.target.value) })}
              />
            </div>
            <Button onClick={handleSaveTable} className="w-full">
              Salvar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Table Wait Alerts Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Alertas de Espera
          </CardTitle>
          <CardDescription>
            Configure quando alertar sobre mesas com tempo de espera elevado
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Table wait alert */}
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
                  {[2,4,6,8,10,12,14,15,16,18,20,25,30,45,60].map(m => (
                    <SelectItem key={m} value={m.toString()}>{m} min</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Switch
                checked={tableWaitSettings.enabled}
                onCheckedChange={(enabled) => updateTableWaitSettings({ enabled })}
              />
            </div>
          </div>

          {tableWaitSettings.enabled && (
            <div className="ml-4 pl-4 border-l-2 border-muted space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Intervalo de verificação</Label>
                  <p className="text-xs text-muted-foreground">De quanto em quanto tempo o sistema verifica os pedidos</p>
                </div>
                <Select
                  value={tableWaitSettings.checkIntervalSeconds.toString()}
                  onValueChange={(v) => updateTableWaitSettings({ checkIntervalSeconds: Number(v) })}
                >
                  <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[15,30,45,60,90,120].map(s => (
                      <SelectItem key={s} value={s.toString()}>{s} seg</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Alerta persistente</Label>
                  <p className="text-xs text-muted-foreground">Repetir som e popup até o operador dispensar o alerta</p>
                </div>
                <Switch
                  checked={tableWaitSettings.persistentAlert}
                  onCheckedChange={(persistentAlert) => updateTableWaitSettings({ persistentAlert })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-sm font-medium">Inatividade no KDS</Label>
                  <p className="text-xs text-muted-foreground">Alertar quando pedido ficar parado no KDS sem movimentação</p>
                </div>
                <div className="flex items-center gap-3">
                  <Select
                    value={tableWaitSettings.kdsIdleMinutes.toString()}
                    onValueChange={(v) => updateTableWaitSettings({ kdsIdleMinutes: Number(v) })}
                    disabled={!tableWaitSettings.kdsIdleEnabled}
                  >
                    <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[5,10,15,20,30].map(m => (
                        <SelectItem key={m} value={m.toString()}>{m} min</SelectItem>
                      ))}
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

          {/* Idle table settings */}
          <div className="border-t pt-6 space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="font-medium flex items-center gap-2">
                  <Timer className="h-4 w-4" />
                  Mesa ociosa (sem itens)
                </Label>
                <p className="text-sm text-muted-foreground">Alertar ou fechar mesas abertas sem pedidos após tempo limite</p>
              </div>
              <div className="flex items-center gap-3">
                <Select
                  value={idleTableSettings.thresholdMinutes.toString()}
                  onValueChange={(v) => updateIdleTableSettings({ thresholdMinutes: Number(v) })}
                  disabled={!idleTableSettings.enabled}
                >
                  <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[5,10,15,20,30].map(m => (
                      <SelectItem key={m} value={m.toString()}>{m} min</SelectItem>
                    ))}
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
                <p className="text-xs text-muted-foreground">Também alertar quando o pedido já foi servido</p>
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

      {/* Table Sounds Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Sons de Mesa
          </CardTitle>
          <CardDescription>
            Sons de alerta específicos para eventos de mesa
          </CardDescription>
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
            max={100}
            step={5}
            disabled={!audioSettings.enabled}
            className="mb-4"
          />
          {[
            { type: 'tableWaitAlert' as const, icon: Clock, iconColor: 'text-amber-500', label: 'Alerta de Espera de Mesa', description: 'Som quando mesa ultrapassa tempo limite' },
            { type: 'idleTableAlert' as const, icon: Timer, iconColor: 'text-orange-500', label: 'Alerta de Mesa Ociosa', description: 'Som quando mesa está aberta sem pedidos' },
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
    </>
  );
}
