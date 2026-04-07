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
import { UtensilsCrossed, Plus, Edit, Trash2 } from 'lucide-react';

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
    </>
  );
}
