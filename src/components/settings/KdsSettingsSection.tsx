import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useKdsSettings, KdsOperationMode, OrderManagementViewMode, KanbanColumn } from '@/hooks/useKdsSettings';
import { useKdsStations } from '@/hooks/useKdsStations';
import { useKdsDevice } from '@/hooks/useKdsDevice';
import { useAudioNotification } from '@/hooks/useAudioNotification';
import { SoundSelector } from '@/components/SoundSelector';
import { ChefHat, Printer, Monitor, Factory, Clock, Circle, X, Plus, AlertTriangle, ChevronDown, Layers, User, Eye, Palette, ClipboardList, CheckCircle, Package, Columns, Moon, Bell, Play, Volume2, Store, Ban, Hourglass } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { BADGE_COLOR_OPTIONS, getBadgeColorClasses } from '@/lib/badgeColors';

export function KdsSettingsSection() {
  const { settings, updateSettings, updateDeviceSettings, updateBottleneckSettings, updateStationOverride, isLoading } = useKdsSettings();
  const { activeStations } = useKdsStations();
  const { device, assignToStation, renameDevice } = useKdsDevice();
  const { settings: audioSettings, updateSettings: updateAudioSettings, toggleSound, setSelectedSound, testSound } = useAudioNotification();
  const [newKeyword, setNewKeyword] = useState('');
  const [expandedStations, setExpandedStations] = useState<Set<string>>(new Set());

  const addBorderKeyword = () => {
    if (newKeyword.trim() && !settings.borderKeywords.includes(newKeyword.trim().toLowerCase())) {
      updateSettings({
        borderKeywords: [...settings.borderKeywords, newKeyword.trim().toLowerCase()]
      });
      setNewKeyword('');
    }
  };

  const removeBorderKeyword = (keyword: string) => {
    updateSettings({
      borderKeywords: settings.borderKeywords.filter(k => k !== keyword)
    });
  };

  const toggleStationExpanded = (stationId: string) => {
    setExpandedStations(prev => {
      const next = new Set(prev);
      if (next.has(stationId)) {
        next.delete(stationId);
      } else {
        next.add(stationId);
      }
      return next;
    });
  };

  const queueSizeOptions = [3, 5, 8, 10, 15];
  const timeRatioOptions = [
    { value: 1.2, label: '1.2x (20% acima)' },
    { value: 1.3, label: '1.3x (30% acima)' },
    { value: 1.5, label: '1.5x (50% acima)' },
    { value: 1.8, label: '1.8x (80% acima)' },
    { value: 2.0, label: '2.0x (100% acima)' },
  ];

  return (
    <div className="space-y-6">
      {/* Modo de Operação */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Factory className="h-5 w-5" />
            Modo de Operação
          </CardTitle>
          <CardDescription>
            Defina como o KDS irá organizar o fluxo de trabalho
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => updateSettings({ operationMode: 'traditional' })}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                settings.operationMode === 'traditional'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Monitor className="h-5 w-5" />
                <span className="font-medium">Tradicional (Kanban)</span>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Todos os pedidos aparecem em uma única tela. Ideal para operações pequenas
                onde um único cozinheiro gerencia todo o processo.
              </p>
              {/* Preview Kanban */}
              <div className="flex gap-1 h-12 rounded overflow-hidden border border-border/50">
                <div className="flex-1 bg-yellow-500/30 flex flex-col items-center justify-center">
                  <Clock className="h-3 w-3 text-yellow-700 dark:text-yellow-300 mb-0.5" />
                  <span className="text-[8px] text-yellow-700 dark:text-yellow-300 font-medium">Pendente</span>
                </div>
                <div className="flex-1 bg-blue-500/30 flex flex-col items-center justify-center">
                  <ChefHat className="h-3 w-3 text-blue-700 dark:text-blue-300 mb-0.5" />
                  <span className="text-[8px] text-blue-700 dark:text-blue-300 font-medium">Preparo</span>
                </div>
                <div className="flex-1 bg-green-500/30 flex flex-col items-center justify-center">
                  <CheckCircle className="h-3 w-3 text-green-700 dark:text-green-300 mb-0.5" />
                  <span className="text-[8px] text-green-700 dark:text-green-300 font-medium">Pronto</span>
                </div>
                <div className="flex-1 bg-gray-500/30 flex flex-col items-center justify-center">
                  <Package className="h-3 w-3 text-gray-700 dark:text-gray-300 mb-0.5" />
                  <span className="text-[8px] text-gray-700 dark:text-gray-300 font-medium">Entregue</span>
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => updateSettings({ operationMode: 'production_line' })}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                settings.operationMode === 'production_line'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Factory className="h-5 w-5" />
                <span className="font-medium">Linha de Produção</span>
              </div>
              <p className="text-sm text-muted-foreground mb-3">
                Cada dispositivo mostra apenas sua praça. O item avança conforme a etapa
                é concluída. Ideal para alta demanda.
              </p>
              {/* Preview Linha de Produção */}
              <div className="flex gap-1 h-12 rounded overflow-hidden border border-border/50">
                {activeStations.slice(0, 4).map((station, idx) => (
                  <div 
                    key={station.id}
                    className="flex-1 flex flex-col items-center justify-center"
                    style={{ backgroundColor: `${station.color}30` }}
                  >
                    <Circle 
                      className="h-3 w-3 mb-0.5" 
                      style={{ color: station.color, fill: station.color }} 
                    />
                    <span 
                      className="text-[8px] font-medium truncate px-1 max-w-full"
                      style={{ color: station.color }}
                    >
                      {station.name.slice(0, 8)}
                    </span>
                  </div>
                ))}
                {activeStations.length === 0 && (
                  <>
                    <div className="flex-1 bg-primary/20 flex flex-col items-center justify-center">
                      <Circle className="h-3 w-3 text-primary mb-0.5" />
                      <span className="text-[8px] text-primary font-medium">Praça 1</span>
                    </div>
                    <div className="flex-1 bg-primary/20 flex flex-col items-center justify-center">
                      <Circle className="h-3 w-3 text-primary mb-0.5" />
                      <span className="text-[8px] text-primary font-medium">Praça 2</span>
                    </div>
                    <div className="flex-1 bg-primary/20 flex flex-col items-center justify-center">
                      <Circle className="h-3 w-3 text-primary mb-0.5" />
                      <span className="text-[8px] text-primary font-medium">Praça 3</span>
                    </div>
                  </>
                )}
              </div>
            </button>
          </div>

          {settings.operationMode === 'production_line' && (
            <div className="mt-4 p-4 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">
                <strong>Dica:</strong> No modo Linha de Produção, configure a praça atribuída na seção "Configuração do Dispositivo" abaixo.
              </p>
            </div>
          )}

          {settings.operationMode === 'production_line' && (
            <div className="mt-4 border-t pt-4 space-y-3">
              <Label className="font-medium text-base">Modo de Roteamento</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => updateSettings({ routingMode: 'sequential' })}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${
                    settings.routingMode === 'sequential'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <span className="font-medium text-sm">Sequencial</span>
                  <p className="text-xs text-muted-foreground mt-1">
                    Todo item passa por todas as praças na ordem configurada. Nenhuma etapa é pulada.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => updateSettings({ routingMode: 'smart' })}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${
                    settings.routingMode === 'smart'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <span className="font-medium text-sm">Inteligente (Borda)</span>
                  <p className="text-xs text-muted-foreground mt-1">
                    O sistema detecta se o item tem borda e roteia para o setor de bordas. Sem borda, pula para montagem.
                  </p>
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Device Configuration - Always visible */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Monitor className="h-5 w-5" />
            Configuração do Dispositivo
          </CardTitle>
          <CardDescription>
            Configure este dispositivo para exibir uma praça específica
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="font-medium flex items-center gap-2">
              <User className="h-4 w-4" />
              Nome deste dispositivo
            </Label>
            <Input
              value={settings.deviceName}
              onChange={(e) => {
                updateDeviceSettings({ deviceName: e.target.value });
                renameDevice(e.target.value);
              }}
              placeholder="Ex: Tablet Cozinha 1"
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              ID: {settings.deviceId.slice(0, 8)}...
            </p>
          </div>

          <div>
            <Label className="font-medium flex items-center gap-2">
              <Layers className="h-4 w-4" />
              Praça atribuída
            </Label>
            <Select
              value={settings.assignedStationId || 'none'}
              onValueChange={(value) => assignToStation(value === 'none' ? null : value)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecione uma praça" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">
                  <div className="flex items-center gap-2">
                    <Circle className="h-3 w-3 text-muted-foreground" />
                    Nenhuma (ver todas)
                  </div>
                </SelectItem>
                {activeStations.map((station) => (
                  <SelectItem key={station.id} value={station.id}>
                    <div className="flex items-center gap-2">
                      <Circle 
                        className="h-3 w-3" 
                        style={{ color: station.color, fill: station.color }} 
                      />
                      {station.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Quando atribuído, este dispositivo mostrará apenas os itens desta praça.
              Funciona em ambos os modos (Kanban e Linha de Produção).
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Visualização Gestão de Pedidos */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ClipboardList className="h-5 w-5" />
            Visualização da Gestão de Pedidos
          </CardTitle>
          <CardDescription>
            Escolha como a tela de Gestão de Pedidos (Balcão/Delivery) irá exibir os pedidos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              type="button"
              onClick={() => updateSettings({ orderManagementViewMode: 'follow_kds' })}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                settings.orderManagementViewMode === 'follow_kds'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Eye className="h-5 w-5" />
                <span className="font-medium">Seguir KDS</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Usa o mesmo modo de visualização configurado no KDS.
              </p>
            </button>

            <button
              type="button"
              onClick={() => updateSettings({ orderManagementViewMode: 'kanban' })}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                settings.orderManagementViewMode === 'kanban'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Monitor className="h-5 w-5" />
                <span className="font-medium">Kanban</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Exibe pedidos em colunas por status (Pendentes, Preparando, Prontos).
              </p>
            </button>

            <button
              type="button"
              onClick={() => updateSettings({ orderManagementViewMode: 'production_line' })}
              className={`p-4 rounded-lg border-2 text-left transition-all ${
                settings.orderManagementViewMode === 'production_line'
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Factory className="h-5 w-5" />
                <span className="font-medium">Linha de Produção</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Exibe pedidos organizados por praça/estação de trabalho.
              </p>
            </button>
          </div>

          {/* Colunas Visíveis do Kanban */}
          {(settings.operationMode === 'traditional' || 
            (settings.orderManagementViewMode === 'kanban' || settings.orderManagementViewMode === 'follow_kds')) && (
            <div className="mt-6 pt-4 border-t">
              <Label className="font-medium text-base mb-3 block flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Colunas Visíveis no Kanban
              </Label>
              <p className="text-sm text-muted-foreground mb-4">
                Escolha quais colunas exibir no modo Kanban
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { key: 'pending' as KanbanColumn, label: 'Pendentes', icon: Clock, color: 'yellow' },
                  { key: 'preparing' as KanbanColumn, label: 'Em Preparo', icon: ChefHat, color: 'blue' },
                  { key: 'ready' as KanbanColumn, label: 'Prontos', icon: CheckCircle, color: 'green' },
                  { key: 'delivered_today' as KanbanColumn, label: 'Entregues Hoje', icon: Package, color: 'gray' },
                ].map(({ key, label, icon: Icon, color }) => {
                  const isVisible = settings.kanbanVisibleColumns.includes(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        const newColumns = isVisible
                          ? settings.kanbanVisibleColumns.filter(c => c !== key)
                          : [...settings.kanbanVisibleColumns, key];
                        // Ensure at least one column is visible
                        if (newColumns.length > 0) {
                          updateSettings({ kanbanVisibleColumns: newColumns });
                        }
                      }}
                      className={cn(
                        "flex items-center gap-2 p-3 rounded-lg border-2 transition-all",
                        isVisible 
                          ? `border-${color}-500 bg-${color}-500/10` 
                          : "border-border opacity-50 hover:opacity-75"
                      )}
                      style={{
                        borderColor: isVisible ? `var(--${color}-500, hsl(var(--${color})))` : undefined,
                        backgroundColor: isVisible ? `hsl(var(--${color}) / 0.1)` : undefined,
                      }}
                    >
                      <Switch
                        checked={isVisible}
                        onCheckedChange={(checked) => {
                          const newColumns = checked
                            ? [...settings.kanbanVisibleColumns, key]
                            : settings.kanbanVisibleColumns.filter(c => c !== key);
                          if (newColumns.length > 0) {
                            updateSettings({ kanbanVisibleColumns: newColumns });
                          }
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <Icon className="h-4 w-4" />
                      <span className="text-sm font-medium">{label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Nomes das Colunas */}
              <div className="mt-6 pt-4 border-t">
                <Label className="font-medium text-base mb-3 block flex items-center gap-2">
                  <Columns className="h-4 w-4" />
                  Nomes das Colunas
                </Label>
                <p className="text-sm text-muted-foreground mb-4">
                  Personalize os nomes das colunas para adaptar à terminologia da sua região
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm">Coluna "Pendente"</Label>
                    <Input
                      value={settings.columnNamePending}
                      onChange={(e) => updateSettings({ columnNamePending: e.target.value.toUpperCase() })}
                      placeholder="Ex: AGUARDANDO"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Coluna "Em Preparo"</Label>
                    <Input
                      value={settings.columnNamePreparing}
                      onChange={(e) => updateSettings({ columnNamePreparing: e.target.value.toUpperCase() })}
                      placeholder="Ex: PREPARANDO"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Coluna "Pronto"</Label>
                    <Input
                      value={settings.columnNameReady}
                      onChange={(e) => updateSettings({ columnNameReady: e.target.value.toUpperCase() })}
                      placeholder="Ex: FINALIZADO"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Coluna "Entregues Hoje"</Label>
                    <Input
                      value={settings.columnNameDelivered}
                      onChange={(e) => updateSettings({ columnNameDelivered: e.target.value.toUpperCase() })}
                      placeholder="Ex: FINALIZADOS"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modo Escuro */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Moon className="h-5 w-5" />
            Modo Escuro do KDS
          </CardTitle>
          <CardDescription>
            Ative o tema escuro para todos os dispositivos KDS. Ideal para ambientes de cozinha com pouca luz.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="font-medium">Ativar modo escuro</Label>
              <p className="text-sm text-muted-foreground">
                Aplica fundo escuro e cores otimizadas em todas as telas do KDS
              </p>
            </div>
            <Switch
              checked={settings.darkMode}
              onCheckedChange={(checked) => updateSettings({ darkMode: checked })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Alertas de Gargalo */}
      {settings.operationMode === 'production_line' && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Alertas de Gargalo
            </CardTitle>
            <CardDescription>
              Configure os limites para detecção de gargalos por praça
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="font-medium">Ativar alertas de gargalo</Label>
                <p className="text-sm text-muted-foreground">
                  Receba notificações quando uma praça estiver com acúmulo de itens ou tempo elevado
                </p>
              </div>
              <Switch
                checked={settings.bottleneckSettings.enabled}
                onCheckedChange={(enabled) => updateBottleneckSettings({ enabled })}
              />
            </div>

            {settings.bottleneckSettings.enabled && (
              <>
                {/* Limites Padrão */}
                <div className="border-t pt-4">
                  <Label className="font-medium text-base mb-3 block">Limites Padrão</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm text-muted-foreground">Tamanho máximo de fila</Label>
                      <Select
                        value={String(settings.bottleneckSettings.defaultMaxQueueSize)}
                        onValueChange={(value) => updateBottleneckSettings({ defaultMaxQueueSize: Number(value) })}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {queueSizeOptions.map(n => (
                            <SelectItem key={n} value={String(n)}>{n} itens</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">
                        Alerta quando a fila exceder este número
                      </p>
                    </div>

                    <div>
                      <Label className="text-sm text-muted-foreground">Tempo máximo relativo</Label>
                      <Select
                        value={String(settings.bottleneckSettings.defaultMaxTimeRatio)}
                        onValueChange={(value) => updateBottleneckSettings({ defaultMaxTimeRatio: Number(value) })}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {timeRatioOptions.map(opt => (
                            <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground mt-1">
                        Alerta quando o tempo médio exceder este ratio da média geral
                      </p>
                    </div>
                  </div>
                </div>

                {/* Configuração por Praça */}
                {activeStations.length > 0 && (
                  <div className="border-t pt-4">
                    <Label className="font-medium text-base mb-3 block">Configuração por Praça</Label>
                    <div className="space-y-2">
                      {activeStations.map((station) => {
                        const override = settings.bottleneckSettings.stationOverrides[station.id];
                        const hasOverride = override && (override.maxQueueSize !== undefined || override.maxTimeRatio !== undefined);
                        const isExpanded = expandedStations.has(station.id);
                        const alertsEnabled = override?.alertsEnabled !== false;

                        return (
                          <Collapsible
                            key={station.id}
                            open={isExpanded}
                            onOpenChange={() => toggleStationExpanded(station.id)}
                          >
                            <div className="border rounded-lg overflow-hidden">
                              <CollapsibleTrigger asChild>
                                <button
                                  type="button"
                                  className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors"
                                >
                                  <div className="flex items-center gap-3">
                                    <Circle
                                      className="h-4 w-4"
                                      style={{ color: station.color, fill: station.color }}
                                    />
                                    <span className="font-medium">{station.name}</span>
                                    {hasOverride && (
                                      <Badge variant="secondary" className="text-xs">
                                        Personalizado
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Switch
                                      checked={alertsEnabled}
                                      onCheckedChange={(checked) => {
                                        updateStationOverride(station.id, { alertsEnabled: checked });
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                    />
                                    <ChevronDown className={cn(
                                      "h-4 w-4 transition-transform",
                                      isExpanded && "rotate-180"
                                    )} />
                                  </div>
                                </button>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <div className="p-3 pt-0 border-t bg-muted/30 space-y-3">
                                  <div className="flex items-center gap-2">
                                    <Switch
                                      id={`override-${station.id}`}
                                      checked={hasOverride}
                                      onCheckedChange={(checked) => {
                                        if (checked) {
                                          updateStationOverride(station.id, {
                                            maxQueueSize: settings.bottleneckSettings.defaultMaxQueueSize,
                                            maxTimeRatio: settings.bottleneckSettings.defaultMaxTimeRatio,
                                          });
                                        } else {
                                          // Remove overrides but keep alertsEnabled
                                          const currentAlertsEnabled = override?.alertsEnabled;
                                          if (currentAlertsEnabled !== undefined && !currentAlertsEnabled) {
                                            updateStationOverride(station.id, { alertsEnabled: false });
                                          } else {
                                            updateStationOverride(station.id, null);
                                          }
                                        }
                                      }}
                                    />
                                    <Label htmlFor={`override-${station.id}`} className="text-sm">
                                      Usar limites personalizados
                                    </Label>
                                  </div>

                                  {hasOverride && (
                                    <div className="grid grid-cols-2 gap-3">
                                      <div>
                                        <Label className="text-xs text-muted-foreground">Fila máx.</Label>
                                        <Select
                                          value={String(override?.maxQueueSize ?? settings.bottleneckSettings.defaultMaxQueueSize)}
                                          onValueChange={(value) => {
                                            updateStationOverride(station.id, { maxQueueSize: Number(value) });
                                          }}
                                        >
                                          <SelectTrigger className="h-8 text-sm">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {queueSizeOptions.map(n => (
                                              <SelectItem key={n} value={String(n)}>{n} itens</SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                      <div>
                                        <Label className="text-xs text-muted-foreground">Tempo máx.</Label>
                                        <Select
                                          value={String(override?.maxTimeRatio ?? settings.bottleneckSettings.defaultMaxTimeRatio)}
                                          onValueChange={(value) => {
                                            updateStationOverride(station.id, { maxTimeRatio: Number(value) });
                                          }}
                                        >
                                          <SelectTrigger className="h-8 text-sm">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {timeRatioOptions.map(opt => (
                                              <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </CollapsibleContent>
                            </div>
                          </Collapsible>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Indicador de Tempo por Item */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Indicador de Tempo por Item
          </CardTitle>
          <CardDescription>
            Configure os tempos para o timer individual de cada item na estação
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="font-medium flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-green-500"></span>
                Verde (OK)
              </Label>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-muted-foreground">Até</span>
                <Select
                  value={String(settings.timerGreenMinutes ?? 5)}
                  onValueChange={(value) => updateSettings({ timerGreenMinutes: Number(value) })}
                >
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[2, 3, 4, 5, 6, 7, 8, 10].map(n => (
                      <SelectItem key={n} value={String(n)}>{n} min</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="font-medium flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-yellow-500"></span>
                Amarelo (Atenção)
              </Label>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-muted-foreground">Até</span>
                <Select
                  value={String(settings.timerYellowMinutes ?? 10)}
                  onValueChange={(value) => updateSettings({ timerYellowMinutes: Number(value) })}
                >
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[5, 8, 10, 12, 15, 18, 20].map(n => (
                      <SelectItem key={n} value={String(n)}>{n} min</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            Acima de {settings.timerYellowMinutes ?? 10} minutos, o timer ficará <span className="text-red-500 font-medium">vermelho</span>.
          </p>

          <div className="border-t pt-4 mt-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="font-medium flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  Alerta sonoro de item atrasado
                </Label>
                <p className="text-sm text-muted-foreground">
                  Toca um som quando algum item ultrapassa o tempo limite na estação
                </p>
              </div>
              <Switch
                checked={settings.delayAlertEnabled ?? true}
                onCheckedChange={(delayAlertEnabled) => updateSettings({ delayAlertEnabled })}
              />
            </div>

            {(settings.delayAlertEnabled ?? true) && (
              <div className="mt-3">
                <Label className="text-sm text-muted-foreground">Alertar após</Label>
                <Select
                  value={String(settings.delayAlertMinutes ?? 10)}
                  onValueChange={(value) => updateSettings({ delayAlertMinutes: Number(value) })}
                >
                  <SelectTrigger className="w-32 mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[5, 8, 10, 12, 15, 20, 25, 30].map(n => (
                      <SelectItem key={n} value={String(n)}>{n} minutos</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* SLA Visual */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Clock className="h-5 w-5" />
            SLA Visual (Semáforo do Pedido)
          </CardTitle>
          <CardDescription>
            Configure os tempos para indicação visual de urgência do pedido completo
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="font-medium flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-green-500"></span>
                Verde (OK)
              </Label>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-muted-foreground">Até</span>
                <Select
                  value={String(settings.slaGreenMinutes)}
                  onValueChange={(value) => updateSettings({ slaGreenMinutes: Number(value) })}
                >
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[5, 6, 7, 8, 10, 12, 15].map(n => (
                      <SelectItem key={n} value={String(n)}>{n} min</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="font-medium flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-yellow-500"></span>
                Amarelo (Atenção)
              </Label>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-muted-foreground">Até</span>
                <Select
                  value={String(settings.slaYellowMinutes)}
                  onValueChange={(value) => updateSettings({ slaYellowMinutes: Number(value) })}
                >
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[8, 10, 12, 15, 18, 20, 25, 30].map(n => (
                      <SelectItem key={n} value={String(n)}>{n} min</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            Acima de {settings.slaYellowMinutes} minutos, o pedido ficará <span className="text-red-500 font-medium">vermelho</span> (prioridade máxima).
          </p>
        </CardContent>
      </Card>

      {/* Exibição no KDS */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Exibição no KDS
          </CardTitle>
          <CardDescription>
            Configure a exibição de informações adicionais no KDS
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="font-medium">Piscar observações em todas as estações</Label>
              <p className="text-sm text-muted-foreground">
                Se desativado, observações piscam apenas na primeira estação
              </p>
            </div>
            <Switch 
              checked={settings.notesBlinkAllStations ?? false}
              onCheckedChange={(notesBlinkAllStations) => updateSettings({ notesBlinkAllStations })} 
            />
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="font-medium flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Exibir nome do garçom
                </Label>
                <p className="text-sm text-muted-foreground">
                  Mostra quem lançou cada item no pedido
                </p>
              </div>
              <Switch 
                checked={settings.showWaiterName ?? true}
                onCheckedChange={(showWaiterName) => updateSettings({ showWaiterName })} 
              />
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="font-medium">Ocultar categoria do sabor no KDS</Label>
                <p className="text-sm text-muted-foreground">
                  Oculta a linha com nome do produto (ex: "1x Pizza Grande") quando há sabores
                </p>
              </div>
              <Switch 
                checked={settings.hideFlavorCategoryKds ?? false}
                onCheckedChange={(hideFlavorCategoryKds) => updateSettings({ hideFlavorCategoryKds })} 
              />
            </div>
          </div>

          {/* Cores das Tarjas */}
          <div className="border-t pt-4 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Palette className="h-4 w-4" />
              <Label className="font-medium">Cores das Tarjas</Label>
            </div>
            
            {/* Cor da tarja de borda */}
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Cor da tarja de borda</Label>
              <div className="flex flex-wrap gap-2">
                {BADGE_COLOR_OPTIONS.map(color => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => updateSettings({ borderBadgeColor: color.value })}
                    className={cn(
                      "w-8 h-8 rounded-full border-2 transition-all",
                      color.bgClass,
                      settings.borderBadgeColor === color.value 
                        ? "ring-2 ring-offset-2 ring-primary scale-110" 
                        : "hover:scale-105"
                    )}
                    title={color.label}
                  />
                ))}
              </div>
              <div className="mt-2">
                <span className={cn(
                  "inline-flex px-2 py-1 rounded font-bold text-sm",
                  getBadgeColorClasses(settings.borderBadgeColor).bg,
                  getBadgeColorClasses(settings.borderBadgeColor).text
                )}>
                  🟡 Borda de Chocolate (preview)
                </span>
              </div>
            </div>

            {/* Cor da tarja de observações */}
            <div className="space-y-2">
              <Label className="text-sm text-muted-foreground">Cor da tarja de observações</Label>
              <div className="flex flex-wrap gap-2">
                {BADGE_COLOR_OPTIONS.map(color => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => updateSettings({ notesBadgeColor: color.value })}
                    className={cn(
                      "w-8 h-8 rounded-full border-2 transition-all",
                      color.bgClass,
                      settings.notesBadgeColor === color.value 
                        ? "ring-2 ring-offset-2 ring-primary scale-110" 
                        : "hover:scale-105"
                    )}
                    title={color.label}
                  />
                ))}
              </div>
              <div className="mt-2">
                <span className={cn(
                  "inline-flex px-2 py-1 rounded font-bold text-sm",
                  getBadgeColorClasses(settings.notesBadgeColor).bg,
                  getBadgeColorClasses(settings.notesBadgeColor).text
                )}>
                  📝 Sem cebola (preview)
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Destaque de Bordas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Circle className="h-5 w-5" />
            Destaque de Bordas (Pizzarias)
          </CardTitle>
          <CardDescription>
            Configure palavras-chave para destacar pedidos com bordas especiais
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="font-medium">Ativar destaque de bordas</Label>
              <p className="text-sm text-muted-foreground">
                Pedidos com bordas especiais terão destaque visual agressivo
              </p>
            </div>
            <Switch
              checked={settings.highlightSpecialBorders}
              onCheckedChange={(highlightSpecialBorders) => updateSettings({ highlightSpecialBorders })}
            />
          </div>

          {settings.highlightSpecialBorders && (
            <div className="space-y-3">
              <Label className="font-medium">Palavras-chave de borda</Label>
              <div className="flex flex-wrap gap-2">
                {settings.borderKeywords.map((keyword) => (
                  <Badge key={keyword} variant="secondary" className="gap-1">
                    {keyword}
                    <button
                      type="button"
                      onClick={() => removeBorderKeyword(keyword)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={newKeyword}
                  onChange={(e) => setNewKeyword(e.target.value)}
                  placeholder="Nova palavra-chave"
                  onKeyDown={(e) => e.key === 'Enter' && addBorderKeyword()}
                />
                <Button type="button" variant="outline" size="icon" onClick={addBorderKeyword}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>


      {/* Configurações Tradicionais */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ChefHat className="h-5 w-5" />
            Configurações Gerais
          </CardTitle>
          <CardDescription>
            Ajuste o comportamento do Kitchen Display System
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="font-medium flex items-center gap-2">
                <Layers className="h-4 w-4" />
                Modo compacto (alta demanda)
              </Label>
              <p className="text-sm text-muted-foreground">
                Exibe mais pedidos por tela com cards menores
              </p>
            </div>
            <Switch 
              checked={settings.compactMode ?? false}
              onCheckedChange={(compactMode) => updateSettings({ compactMode })} 
            />
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="font-medium">Mostrar quantidade de pessoas</Label>
                <p className="text-sm text-muted-foreground">
                  Exibe "X pessoas" das mesas no KDS
                </p>
              </div>
              <Switch 
                checked={settings.showPartySize ?? true}
                onCheckedChange={(showPartySize) => updateSettings({ showPartySize })} 
              />
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="font-medium">Exibir coluna "Pendente"</Label>
                <p className="text-sm text-muted-foreground">
                  Quando desativado, pedidos entram direto em preparo. Útil para restaurantes
                  de alta demanda onde a produção inicia automaticamente.
                </p>
              </div>
              <Switch 
                checked={settings.showPendingColumn} 
                onCheckedChange={(showPendingColumn) => updateSettings({ showPendingColumn })} 
              />
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="font-medium">Alertas de Cancelamento</Label>
                <p className="text-sm text-muted-foreground">
                  Exibe notificações visuais e sonoras quando pedidos em produção são cancelados.
                </p>
              </div>
              <Switch 
                checked={settings.cancellationAlertsEnabled ?? true}
                onCheckedChange={(cancellationAlertsEnabled) => 
                  updateSettings({ cancellationAlertsEnabled })
                }
              />
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="font-medium">Intervalo do Alerta de Cancelamento</Label>
                <p className="text-sm text-muted-foreground">
                  Com que frequência o som de alerta toca quando há pedidos cancelados.
                </p>
              </div>
              <Select
                value={String(settings.cancellationAlertInterval || 3)}
                onValueChange={(value) => updateSettings({ cancellationAlertInterval: Number(value) })}
                disabled={!(settings.cancellationAlertsEnabled ?? true)}
              >
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 segundo</SelectItem>
                  <SelectItem value="2">2 segundos</SelectItem>
                  <SelectItem value="3">3 segundos</SelectItem>
                  <SelectItem value="5">5 segundos</SelectItem>
                  <SelectItem value="10">10 segundos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="font-medium flex items-center gap-2">
                  <Printer className="h-4 w-4" />
                  Impressão Automática de Cancelamentos
                </Label>
                <p className="text-sm text-muted-foreground">
                  Quando ativado, imprime automaticamente um comprovante de cancelamento.
                </p>
              </div>
              <Switch
                checked={settings.autoPrintCancellations ?? true}
                onCheckedChange={(autoPrintCancellations) =>
                  updateSettings({ autoPrintCancellations })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KDS Sounds Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Sons do KDS
          </CardTitle>
          <CardDescription>
            Sons de alerta específicos para a tela da cozinha
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
            max={100} step={5}
            disabled={!audioSettings.enabled}
            className="mb-4"
          />
          {[
            { type: 'kdsNewOrder' as const, icon: Store, iconColor: 'text-orange-500', label: 'Novo Pedido (KDS)', description: 'Som específico para a tela da cozinha' },
            { type: 'orderCancelled' as const, icon: Ban, iconColor: 'text-destructive', label: 'Pedido Cancelado', description: 'Alerta quando um pedido é cancelado' },
            { type: 'maxWaitAlert' as const, icon: AlertTriangle, iconColor: 'text-red-500', label: 'Alerta de Tempo Máximo', description: 'Som quando pedido excede 25min no KDS' },
            { type: 'itemDelayAlert' as const, icon: Hourglass, iconColor: 'text-red-600', label: 'Alerta de Item Atrasado', description: 'Som quando item fica muito tempo na estação' },
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
