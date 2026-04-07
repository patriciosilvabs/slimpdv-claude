import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Target, Copy, AlertCircle } from 'lucide-react';
import { 
  useProductionTargetsGrid, 
  useProductionTargetMutations,
  DAY_NAMES,
  FULL_DAY_NAMES,
} from '@/hooks/useProductionTargets';

export function ProductionTargetsSettings() {
  const { data, isLoading, error } = useProductionTargetsGrid();
  const { upsertTarget, copyDayTargets } = useProductionTargetMutations();
  
  const [editingCell, setEditingCell] = useState<{ ingredientId: string; day: number } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [copyFrom, setCopyFrom] = useState<number>(0);
  const [copyTo, setCopyTo] = useState<number>(1);

  const handleCellClick = (ingredientId: string, day: number, currentValue: number) => {
    setEditingCell({ ingredientId, day });
    setEditValue(currentValue.toString());
  };

  const handleSave = async () => {
    if (!editingCell) return;
    
    const value = parseFloat(editValue) || 0;
    if (value < 0) return;
    
    await upsertTarget.mutateAsync({
      ingredientId: editingCell.ingredientId,
      dayOfWeek: editingCell.day,
      targetQuantity: value,
    });
    
    setEditingCell(null);
    setEditValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setEditingCell(null);
      setEditValue('');
    }
  };

  const handleCopyDays = async () => {
    await copyDayTargets.mutateAsync({ fromDay: copyFrom, toDay: copyTo });
    setCopyDialogOpen(false);
  };

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-8 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <span>Erro ao carregar metas: {(error as Error).message}</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Target className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Metas de Produção</CardTitle>
                <CardDescription>
                  Configure as metas de estoque ideais para cada dia da semana
                </CardDescription>
              </div>
            </div>
            <Button 
              variant="outline" 
              onClick={() => setCopyDialogOpen(true)}
              disabled={!data?.ingredients.length}
            >
              <Copy className="h-4 w-4 mr-2" />
              Copiar Metas
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : !data?.ingredients.length ? (
            <div className="text-center py-8 text-muted-foreground">
              <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum ingrediente cadastrado</p>
              <p className="text-sm">Cadastre ingredientes no menu Estoque para configurar metas</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[150px]">Ingrediente</TableHead>
                    <TableHead className="text-center w-[80px]">Unid.</TableHead>
                    {DAY_NAMES.map((day, index) => (
                      <TableHead key={index} className="text-center min-w-[70px]">
                        {day}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.ingredients.map((ingredient) => (
                    <TableRow key={ingredient.id}>
                      <TableCell className="font-medium">{ingredient.name}</TableCell>
                      <TableCell className="text-center text-muted-foreground">
                        {ingredient.unit}
                      </TableCell>
                      {[0, 1, 2, 3, 4, 5, 6].map((day) => {
                        const target = data.targetsMap[ingredient.id]?.[day];
                        const value = target?.target_quantity || 0;
                        const isEditing = editingCell?.ingredientId === ingredient.id && editingCell?.day === day;
                        
                        return (
                          <TableCell key={day} className="text-center p-1">
                            {isEditing ? (
                              <Input
                                type="number"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onBlur={handleSave}
                                onKeyDown={handleKeyDown}
                                className="w-16 h-8 text-center mx-auto"
                                autoFocus
                                min={0}
                              />
                            ) : (
                              <button
                                onClick={() => handleCellClick(ingredient.id, day, value)}
                                className={`
                                  w-14 h-8 rounded border transition-colors
                                  ${value > 0 
                                    ? 'bg-primary/10 border-primary/30 hover:bg-primary/20' 
                                    : 'bg-muted/50 border-border hover:bg-muted'
                                  }
                                `}
                              >
                                {value > 0 ? value : '-'}
                              </button>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          
          <p className="text-sm text-muted-foreground mt-4">
            💡 Clique em uma célula para editar a meta. A demanda de produção é calculada automaticamente: 
            <strong> Meta - Estoque Atual = A Produzir</strong>
          </p>
        </CardContent>
      </Card>

      {/* Copy Dialog */}
      <Dialog open={copyDialogOpen} onOpenChange={setCopyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Copiar Metas Entre Dias</DialogTitle>
            <DialogDescription>
              Copie todas as metas de um dia para outro
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">De:</label>
              <Select 
                value={copyFrom.toString()} 
                onValueChange={(v) => setCopyFrom(parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FULL_DAY_NAMES.map((day, index) => (
                    <SelectItem key={index} value={index.toString()}>
                      {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Para:</label>
              <Select 
                value={copyTo.toString()} 
                onValueChange={(v) => setCopyTo(parseInt(v))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FULL_DAY_NAMES.map((day, index) => (
                    <SelectItem key={index} value={index.toString()} disabled={index === copyFrom}>
                      {day}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setCopyDialogOpen(false)}>
              Cancelar
            </Button>
            <Button 
              onClick={handleCopyDays} 
              disabled={copyDayTargets.isPending || copyFrom === copyTo}
            >
              {copyDayTargets.isPending ? 'Copiando...' : 'Copiar Metas'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
