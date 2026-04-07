import { useState, useMemo } from 'react';
import PDVLayout from '@/components/layout/PDVLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useOrderReopens, useOrderReopenMutations } from '@/hooks/useOrderReopens';
import { useClosingHistory, ClosingRecord, ClosingHistoryFilters } from '@/hooks/useClosingHistory';
import { useOrderMutations } from '@/hooks/useOrders';
import { useTableMutations } from '@/hooks/useTables';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useAuth } from '@/contexts/AuthContext';
import { AccessDenied } from '@/components/auth/AccessDenied';
import { format, startOfDay, endOfDay, subDays, isToday, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, RotateCcw, AlertTriangle, DollarSign, User, Receipt, History, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

const statusLabels: Record<string, string> = {
  pending: 'Pendente',
  preparing: 'Em Preparo',
  ready: 'Pronto',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
};

const orderTypeLabels: Record<string, string> = {
  dine_in: 'Mesa',
  takeaway: 'Balcão',
  delivery: 'Delivery',
};

const paymentMethodLabels: Record<string, string> = {
  cash: 'Dinheiro',
  credit_card: 'Crédito',
  debit_card: 'Débito',
  pix: 'PIX',
};

export default function ReopenHistory() {
  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [startDate, setStartDate] = useState<Date>(subDays(new Date(), 7));
  const [endDate, setEndDate] = useState<Date>(new Date());
  const [activeTab, setActiveTab] = useState('closed-sales');
  
  // Reopen dialog state
  const [reopenDialogOpen, setReopenDialogOpen] = useState(false);
  const [selectedSale, setSelectedSale] = useState<ClosingRecord | null>(null);
  const [reopenReason, setReopenReason] = useState('');
  const [isReopening, setIsReopening] = useState(false);

  // Filters for closing history
  const closingFilters: ClosingHistoryFilters = useMemo(() => ({
    dateRange: 'custom',
    customStart: startOfDay(startDate),
    customEnd: endOfDay(endDate),
  }), [startDate, endDate]);

  const { data: reopens, isLoading: reopensLoading } = useOrderReopens(
    startOfDay(startDate),
    endOfDay(endDate)
  );

  const { data: closedSales, isLoading: closedSalesLoading } = useClosingHistory(closingFilters);

  const { createReopen } = useOrderReopenMutations();
  const { updateOrder } = useOrderMutations();
  const { updateTable } = useTableMutations();

  // Group closed sales by date
  const groupedSales = useMemo(() => {
    if (!closedSales) return [];
    
    const groups: { date: string; label: string; sales: ClosingRecord[] }[] = [];
    const dateMap = new Map<string, ClosingRecord[]>();
    
    closedSales.forEach(sale => {
      const dateKey = format(new Date(sale.created_at), 'yyyy-MM-dd');
      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, []);
      }
      dateMap.get(dateKey)!.push(sale);
    });
    
    dateMap.forEach((sales, dateKey) => {
      const date = new Date(dateKey);
      let label = format(date, "dd/MM/yyyy (EEEE)", { locale: ptBR });
      if (isToday(date)) label = 'Hoje - ' + format(date, "dd/MM/yyyy", { locale: ptBR });
      else if (isYesterday(date)) label = 'Ontem - ' + format(date, "dd/MM/yyyy", { locale: ptBR });
      
      groups.push({ date: dateKey, label, sales });
    });
    
    return groups.sort((a, b) => b.date.localeCompare(a.date));
  }, [closedSales]);

  // Statistics for reopens
  const reopenStats = useMemo(() => {
    if (!reopens || reopens.length === 0) {
      return { total: 0, totalValue: 0, topUsers: [] };
    }

    const totalValue = reopens.reduce((sum, r) => sum + (r.total_value || 0), 0);
    
    const userCounts: Record<string, { name: string; count: number }> = {};
    reopens.forEach(r => {
      if (r.reopened_by_name) {
        if (!userCounts[r.reopened_by_name]) {
          userCounts[r.reopened_by_name] = { name: r.reopened_by_name, count: 0 };
        }
        userCounts[r.reopened_by_name].count++;
      }
    });
    
    const topUsers = Object.values(userCounts)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return { total: reopens.length, totalValue, topUsers };
  }, [reopens]);

  // Statistics for closed sales
  const closedStats = useMemo(() => {
    if (!closedSales || closedSales.length === 0) {
      return { total: 0, totalValue: 0 };
    }
    return {
      total: closedSales.length,
      totalValue: closedSales.reduce((sum, s) => sum + s.total, 0),
    };
  }, [closedSales]);

  const handleOpenReopenDialog = (sale: ClosingRecord) => {
    setSelectedSale(sale);
    setReopenReason('');
    setReopenDialogOpen(true);
  };

  const handleConfirmReopen = async () => {
    if (!selectedSale || !reopenReason.trim()) {
      toast.error('Informe o motivo da reabertura');
      return;
    }

    setIsReopening(true);
    try {
      // 1. Update order status back to preparing
      await updateOrder.mutateAsync({
        id: selectedSale.id,
        status: 'preparing',
        delivered_at: null,
      });

      // 2. If it's a table order, update table to occupied
      if (selectedSale.order_type === 'dine_in' && selectedSale.table_number) {
        // We need to find the table_id - fetch from orders
        const { supabase } = await import('@/integrations/supabase/client');
        const { data: orderData } = await supabase
          .from('orders')
          .select('table_id')
          .eq('id', selectedSale.id)
          .single();
        
        if (orderData?.table_id) {
          await updateTable.mutateAsync({
            id: orderData.table_id,
            status: 'occupied',
          });
        }
      }

      // 3. Create reopen audit record
      await createReopen({
        order_id: selectedSale.id,
        previous_status: 'delivered',
        new_status: 'preparing',
        reopened_by: user?.id,
        reason: reopenReason.trim(),
        order_type: selectedSale.order_type,
        customer_name: selectedSale.customer_name,
        total_value: selectedSale.total,
      });

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['tables'] });
      queryClient.invalidateQueries({ queryKey: ['closing-history'] });
      queryClient.invalidateQueries({ queryKey: ['order-reopens'] });

      toast.success('Venda reaberta com sucesso');
      setReopenDialogOpen(false);
      setSelectedSale(null);
    } catch (error) {
      console.error('Error reopening sale:', error);
      toast.error('Erro ao reabrir venda');
    } finally {
      setIsReopening(false);
    }
  };

  const canReopen = hasPermission('tables_reopen');

  if (!permissionsLoading && !hasPermission('reopen_history_view')) {
    return <AccessDenied permission="reopen_history_view" />;
  }

  return (
    <PDVLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <RotateCcw className="h-6 w-6" />
              Histórico de Reaberturas
            </h1>
            <p className="text-muted-foreground">
              Vendas fechadas e auditoria de reaberturas
            </p>
          </div>

          <div className="flex gap-2">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {format(startDate, 'dd/MM/yyyy')} - {format(endDate, 'dd/MM/yyyy')}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="end">
                <Calendar
                  mode="range"
                  selected={{ from: startDate, to: endDate }}
                  onSelect={(range) => {
                    if (range?.from) setStartDate(range.from);
                    if (range?.to) setEndDate(range.to);
                  }}
                  locale={ptBR}
                  className="pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="closed-sales" className="flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Vendas Fechadas ({closedStats.total})
            </TabsTrigger>
            <TabsTrigger value="reopen-history" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Histórico ({reopenStats.total})
            </TabsTrigger>
          </TabsList>

          {/* Tab: Closed Sales */}
          <TabsContent value="closed-sales" className="space-y-4">
            {/* KPIs */}
            <div className="grid sm:grid-cols-2 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Receipt className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total de Vendas</p>
                      <p className="text-2xl font-bold">{closedStats.total}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-success/10 rounded-lg">
                      <DollarSign className="h-5 w-5 text-success" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Valor Total</p>
                      <p className="text-2xl font-bold">{formatCurrency(closedStats.totalValue)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Closed Sales List */}
            {closedSalesLoading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : !closedSales || closedSales.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Nenhuma venda encontrada no período selecionado
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {groupedSales.map((group) => (
                  <Card key={group.date}>
                    <CardHeader className="py-3 bg-muted/50">
                      <CardTitle className="text-sm font-medium flex items-center justify-between">
                        <span>{group.label}</span>
                        <Badge variant="secondary">{group.sales.length} vendas</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="divide-y">
                        {group.sales.map((sale) => (
                          <div
                            key={sale.id}
                            className="p-4 flex flex-wrap items-center justify-between gap-4 hover:bg-muted/30 transition-colors"
                          >
                            <div className="flex items-center gap-4">
                              <div className="text-sm text-muted-foreground font-mono">
                                {format(new Date(sale.created_at), 'HH:mm')}
                              </div>
                              <Badge variant="outline">
                                {orderTypeLabels[sale.order_type]}
                              </Badge>
                              {sale.table_number && (
                                <span className="text-sm font-medium">Mesa {sale.table_number}</span>
                              )}
                              <span className="text-sm">
                                {sale.customer_name || 'Cliente não informado'}
                              </span>
                            </div>
                            
                            <div className="flex items-center gap-4">
                              <div className="text-right">
                                <p className="font-semibold">{formatCurrency(sale.total)}</p>
                                <div className="flex gap-1 flex-wrap justify-end">
                                  {sale.payments.map((p, idx) => (
                                    <Badge key={idx} variant="secondary" className="text-xs">
                                      {paymentMethodLabels[p.payment_method]} {formatCurrency(p.amount)}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                              
                              {canReopen && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleOpenReopenDialog(sale)}
                                  className="shrink-0"
                                >
                                  <RotateCcw className="h-4 w-4 mr-1" />
                                  Reabrir
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Tab: Reopen History */}
          <TabsContent value="reopen-history" className="space-y-4">
            {/* KPIs */}
            <div className="grid sm:grid-cols-3 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-warning/10 rounded-lg">
                      <AlertTriangle className="h-5 w-5 text-warning" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total de Reaberturas</p>
                      <p className="text-2xl font-bold">{reopenStats.total}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <DollarSign className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Valor Total Movimentado</p>
                      <p className="text-2xl font-bold">{formatCurrency(reopenStats.totalValue)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-info/10 rounded-lg">
                      <User className="h-5 w-5 text-info" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Top Usuário</p>
                      <p className="text-xl font-bold">
                        {reopenStats.topUsers[0]?.name || '-'}
                        {reopenStats.topUsers[0] && (
                          <span className="text-sm font-normal text-muted-foreground ml-2">
                            ({reopenStats.topUsers[0].count}x)
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Table */}
            <Card>
              <CardHeader>
                <CardTitle>Reaberturas no Período</CardTitle>
              </CardHeader>
              <CardContent>
                {reopensLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Carregando...</div>
                ) : !reopens || reopens.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhuma reabertura encontrada no período selecionado
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data/Hora</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Mesa</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Status Anterior</TableHead>
                          <TableHead>Valor</TableHead>
                          <TableHead>Usuário</TableHead>
                          <TableHead>Motivo</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {reopens.map((reopen) => (
                          <TableRow key={reopen.id}>
                            <TableCell className="whitespace-nowrap">
                              {format(new Date(reopen.reopened_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {orderTypeLabels[reopen.order_type || ''] || reopen.order_type || '-'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {reopen.table?.number ? `Mesa ${reopen.table.number}` : '-'}
                            </TableCell>
                            <TableCell>
                              {reopen.customer_name || '-'}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">
                                {statusLabels[reopen.previous_status] || reopen.previous_status}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium">
                              {reopen.total_value ? formatCurrency(reopen.total_value) : '-'}
                            </TableCell>
                            <TableCell>
                              {reopen.reopened_by_name || '-'}
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate">
                              {reopen.reason || '-'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top Users */}
            {reopenStats.topUsers.length > 1 && (
              <Card>
                <CardHeader>
                  <CardTitle>Usuários que mais Reabriram</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {reopenStats.topUsers.map((userItem, index) => (
                      <div key={userItem.name} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                        <div className="flex items-center gap-3">
                          <span className={cn(
                            "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                            index === 0 && "bg-yellow-500/20 text-yellow-500",
                            index === 1 && "bg-gray-400/20 text-gray-500",
                            index === 2 && "bg-amber-600/20 text-amber-600",
                            index > 2 && "bg-muted text-muted-foreground"
                          )}>
                            {index + 1}
                          </span>
                          <span className="font-medium">{userItem.name}</span>
                        </div>
                        <Badge variant="outline">{userItem.count} reaberturas</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Reopen Confirmation Dialog */}
        <Dialog open={reopenDialogOpen} onOpenChange={setReopenDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-warning" />
                Confirmar Reabertura de Venda
              </DialogTitle>
              <DialogDescription>
                Esta ação será registrada para auditoria.
              </DialogDescription>
            </DialogHeader>

            {selectedSale && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                  <div>
                    <p className="text-sm text-muted-foreground">Tipo</p>
                    <p className="font-medium">{orderTypeLabels[selectedSale.order_type]}</p>
                  </div>
                  {selectedSale.table_number && (
                    <div>
                      <p className="text-sm text-muted-foreground">Mesa</p>
                      <p className="font-medium">Mesa {selectedSale.table_number}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-muted-foreground">Cliente</p>
                    <p className="font-medium">{selectedSale.customer_name || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Valor</p>
                    <p className="font-medium">{formatCurrency(selectedSale.total)}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm text-muted-foreground">Fechado em</p>
                    <p className="font-medium">
                      {format(new Date(selectedSale.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reopen-reason">Motivo da reabertura *</Label>
                  <Textarea
                    id="reopen-reason"
                    placeholder="Ex: Cliente pediu item adicional após fechamento da conta"
                    value={reopenReason}
                    onChange={(e) => setReopenReason(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setReopenDialogOpen(false)}
                disabled={isReopening}
              >
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmReopen}
                disabled={isReopening || !reopenReason.trim()}
              >
                {isReopening && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <RotateCcw className="h-4 w-4 mr-2" />
                Confirmar Reabertura
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PDVLayout>
  );
}
