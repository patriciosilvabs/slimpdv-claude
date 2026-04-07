import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useKdsStations, KdsStation, STATION_TYPE_LABELS, StationType } from '@/hooks/useKdsStations';
import { Factory, Plus, Pencil, Trash2, GripVertical, Circle, Layers, Flame, ChefHat, ArrowRight } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const STATION_ICONS = [
  { value: 'Circle', icon: Circle, label: 'Círculo' },
  { value: 'Layers', icon: Layers, label: 'Camadas' },
  { value: 'Flame', icon: Flame, label: 'Chama' },
  { value: 'ChefHat', icon: ChefHat, label: 'Chef' },
];

const PRESET_COLORS = [
  '#EF4444', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6', '#EC4899', '#6B7280',
];

interface StationFormData {
  name: string;
  station_type: StationType;
  description: string;
  color: string;
  icon: string;
  is_active: boolean;
  is_edge_sector: boolean;
  oven_time_minutes: number;
  displayed_item_kinds: string[];
}

const OPERATIONAL_TYPE_OPTIONS = [
  { value: 'cozinha', label: 'Cozinha' },
  { value: 'bebida', label: 'Bebida' },
  { value: 'sobremesa', label: 'Sobremesa' },
  { value: 'acompanhamento', label: 'Acompanhamento' },
];

const defaultFormData: StationFormData = {
  name: '',
  station_type: 'custom',
  description: '',
  color: '#3B82F6',
  icon: 'ChefHat',
  is_active: true,
  is_edge_sector: false,
  oven_time_minutes: 12,
  displayed_item_kinds: [],
};

function SortableStation({
  station,
  IconComponent,
  onEdit,
  onDelete,
  onToggle,
}: {
  station: KdsStation;
  IconComponent: React.ElementType;
  onEdit: (station: KdsStation) => void;
  onDelete: (id: string) => void;
  onToggle: (id: string, is_active: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: station.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      className={`flex items-center gap-3 p-3 rounded-lg border transition-opacity ${
        station.is_active ? 'bg-card' : 'bg-muted/50 opacity-60'
      }`}
    >
      <GripVertical {...listeners} className="h-4 w-4 text-muted-foreground cursor-grab" />

      <div
        className="h-8 w-8 rounded-full flex items-center justify-center"
        style={{ backgroundColor: station.color + '20' }}
      >
        <IconComponent className="h-4 w-4" style={{ color: station.color }} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{station.name}</span>
          <span className="text-xs text-muted-foreground px-1.5 py-0.5 bg-muted rounded">
            {STATION_TYPE_LABELS[station.station_type as StationType] || station.station_type}
          </span>
        </div>
        {station.description && (
          <p className="text-sm text-muted-foreground truncate">{station.description}</p>
        )}
      </div>

      <Switch
        checked={station.is_active}
        onCheckedChange={(is_active) => onToggle(station.id, is_active)}
      />

      <Button variant="ghost" size="icon" onClick={() => onEdit(station)}>
        <Pencil className="h-4 w-4" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="text-destructive hover:text-destructive"
        onClick={() => onDelete(station.id)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

export function KdsStationsSettings() {
  const { stations, isLoading, createStation, updateStation, deleteStation, toggleStationActive, reorderStations } = useKdsStations();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStation, setEditingStation] = useState<KdsStation | null>(null);
  const [formData, setFormData] = useState<StationFormData>(defaultFormData);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      const oldIndex = stations.findIndex((s) => s.id === active.id);
      const newIndex = stations.findIndex((s) => s.id === over.id);
      const newOrder = arrayMove(stations, oldIndex, newIndex);
      reorderStations.mutate(newOrder.map((s) => s.id));
    }
  };

  const openNewDialog = () => {
    setEditingStation(null);
    setFormData(defaultFormData);
    setDialogOpen(true);
  };

  const openEditDialog = (station: KdsStation) => {
    setEditingStation(station);
    setFormData({
      name: station.name,
      station_type: station.station_type as StationType,
      description: station.description || '',
      color: station.color,
      icon: station.icon,
      is_active: station.is_active,
      is_edge_sector: station.is_edge_sector || false,
      oven_time_minutes: station.oven_time_minutes ?? 12,
      displayed_item_kinds: station.displayed_item_kinds || [],
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.name.trim()) return;

    if (editingStation) {
      updateStation.mutate({
        id: editingStation.id,
        ...formData,
      });
    } else {
      createStation.mutate({
        ...formData,
        sort_order: stations.length,
      });
    }
    setDialogOpen(false);
  };

  const handleDelete = (id: string) => {
    deleteStation.mutate(id);
    setDeleteConfirmId(null);
  };

  const getIconComponent = (iconName: string) => {
    const found = STATION_ICONS.find((i) => i.value === iconName);
    return found ? found.icon : ChefHat;
  };

  const productionFlow = stations.filter(s => s.is_active && s.station_type !== 'order_status');
  const orderStatusFlow = stations.filter(s => s.is_active && s.station_type === 'order_status');

  return (
    <>
      {/* Flow visualization */}
      {productionFlow.length > 0 && (
        <Card className="border-dashed">
          <CardContent className="pt-4 pb-3">
            <p className="text-xs text-muted-foreground mb-3">Fluxo de produção — todo item passa por todas as praças na ordem abaixo:</p>
            <div className="flex items-center gap-1 flex-wrap">
              {productionFlow.map((station, idx) => {
                const Icon = getIconComponent(station.icon);
                return (
                  <div key={station.id} className="flex items-center gap-1">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-sm font-medium" style={{ borderColor: station.color + '40', backgroundColor: station.color + '10' }}>
                      <Icon className="h-3.5 w-3.5" style={{ color: station.color }} />
                      <span>{station.name}</span>
                    </div>
                    {idx < productionFlow.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />}
                  </div>
                );
              })}
              {orderStatusFlow.length > 0 && (
                <>
                  <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                  {orderStatusFlow.map((station, idx) => {
                    const Icon = getIconComponent(station.icon);
                    return (
                      <div key={station.id} className="flex items-center gap-1">
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-sm font-medium border-border bg-muted/50">
                          <Icon className="h-3.5 w-3.5" style={{ color: station.color }} />
                          <span>{station.name}</span>
                        </div>
                        {idx < orderStatusFlow.length - 1 && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Factory className="h-5 w-5" />
                Praças de Produção
              </CardTitle>
              <CardDescription>
                Configure as estações de trabalho. A ordem (drag-and-drop) define o fluxo sequencial.
              </CardDescription>
            </div>
            <Button onClick={openNewDialog} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Nova Praça
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-center py-4">Carregando...</p>
          ) : stations.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              Nenhuma praça configurada. Clique em "Nova Praça" para começar.
            </p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={stations.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {stations.map((station) => {
                    const Icon = getIconComponent(station.icon);
                    return (
                      <SortableStation
                        key={station.id}
                        station={station}
                        IconComponent={Icon}
                        onEdit={openEditDialog}
                        onDelete={setDeleteConfirmId}
                        onToggle={(id, is_active) => toggleStationActive.mutate({ id, is_active })}
                      />
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </CardContent>
      </Card>

      {/* Dialog de criar/editar praça */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingStation ? 'Editar Praça' : 'Nova Praça'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Forno Principal"
              />
            </div>

            <div>
              <Label>Descrição (opcional)</Label>
              <Input
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descrição da praça"
              />
            </div>

            <div className="space-y-3">
              <Label>Características da praça</Label>
              
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium">Montagem</span>
                  <p className="text-xs text-muted-foreground">Praça de montagem/produção dos itens</p>
                </div>
                <Switch
                  checked={formData.station_type === 'assembly' || formData.station_type === 'item_assembly'}
                  onCheckedChange={(checked) => setFormData({ 
                    ...formData, 
                    station_type: checked ? 'assembly' : 'custom'
                  })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium">Forno</span>
                  <p className="text-xs text-muted-foreground">Praça com timer de forno para finalização</p>
                </div>
                <Switch
                  checked={formData.station_type === 'oven_expedite'}
                  onCheckedChange={(checked) => setFormData({ 
                    ...formData, 
                    station_type: checked ? 'oven_expedite' : 'custom',
                    ...(checked ? { is_edge_sector: false } : {}),
                  })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium">Setor de borda</span>
                  <p className="text-xs text-muted-foreground">Itens passam por este setor antes do despacho</p>
                </div>
                <Switch
                  checked={formData.is_edge_sector}
                  onCheckedChange={(checked) => setFormData({ 
                    ...formData, 
                    is_edge_sector: checked,
                    ...(checked ? { station_type: 'custom' as StationType } : {}),
                  })}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium">Status do pedido</span>
                  <p className="text-xs text-muted-foreground">Exibe status final (pronto/entregue)</p>
                </div>
                <Switch
                  checked={formData.station_type === 'order_status'}
                  onCheckedChange={(checked) => setFormData({ 
                    ...formData, 
                    station_type: checked ? 'order_status' : 'custom'
                  })}
                />
              </div>
            </div>

            <div>
              <Label>Cor</Label>
              <div className="flex gap-2 mt-1">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData({ ...formData, color })}
                    className={`h-8 w-8 rounded-full border-2 transition-transform ${
                      formData.color === color ? 'border-primary scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>

            <div>
              <Label>Ícone</Label>
              <div className="flex gap-2 mt-1">
                {STATION_ICONS.map(({ value, icon: Icon, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFormData({ ...formData, icon: value })}
                    className={`h-10 w-10 rounded-lg border-2 flex items-center justify-center transition-all ${
                      formData.icon === value 
                        ? 'border-primary bg-primary/10' 
                        : 'border-border hover:border-primary/50'
                    }`}
                    title={label}
                  >
                    <Icon className="h-5 w-5" style={{ color: formData.color }} />
                  </button>
                ))}
              </div>
              </div>
            </div>


            {formData.station_type === 'oven_expedite' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Timer do forno</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">Contagem regressiva ao enviar itens para o forno</p>
                  </div>
                  <Switch
                    checked={formData.oven_time_minutes > 0}
                    onCheckedChange={(checked) =>
                      setFormData({ ...formData, oven_time_minutes: checked ? 12 : 0 })
                    }
                  />
                </div>
                {formData.oven_time_minutes > 0 && (
                  <div>
                    <Label>Tempo (minutos)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={120}
                      value={formData.oven_time_minutes}
                      onChange={(e) => setFormData({ ...formData, oven_time_minutes: parseInt(e.target.value) || 1 })}
                      className="mt-1"
                    />
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>Tipos de itens exibidos</Label>
              <p className="text-xs text-muted-foreground">
                Selecione quais tipos de itens esta praça deve exibir. Se nenhum for selecionado, exibe todos.
              </p>
              <div className="space-y-2 mt-1">
                {OPERATIONAL_TYPE_OPTIONS.map(opt => (
                  <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={formData.displayed_item_kinds.includes(opt.value)}
                      onCheckedChange={(checked) => {
                        setFormData(prev => ({
                          ...prev,
                          displayed_item_kinds: checked
                            ? [...prev.displayed_item_kinds, opt.value]
                            : prev.displayed_item_kinds.filter(k => k !== opt.value),
                        }));
                      }}
                    />
                    <span className="text-sm">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={!formData.name.trim() || createStation.isPending || updateStation.isPending}
            >
              {editingStation ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmação de exclusão */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir Praça</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            Tem certeza que deseja excluir esta praça? Esta ação não pode ser desfeita.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
              disabled={deleteStation.isPending}
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
