import { useState, useMemo } from 'react';
import PDVLayout from '@/components/layout/PDVLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useClosingHistory, useClosingHistorySummary, ClosingHistoryFilters } from '@/hooks/useClosingHistory';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { AccessDenied } from '@/components/auth/AccessDenied';
import { PaymentMethod } from '@/hooks/useCashRegister';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  CalendarIcon, 
  Filter, 
  X, 
  DollarSign, 
  ShoppingCart, 
  TrendingUp, 
  Tag,
  CreditCard,
  Banknote,
  QrCode,
  ChevronDown,
  FileDown,
  RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

const paymentMethodLabels: Record<PaymentMethod, { label: string; icon: any }> = {
  cash: { label: 'Dinheiro', icon: Banknote },
  credit_card: { label: 'Crédito', icon: CreditCard },
  debit_card: { label: 'Débito', icon: CreditCard },
  pix: { label: 'Pix', icon: QrCode }
};

const orderTypeLabels = {
  dine_in: '🍽️ Mesa',
  takeaway: '🏪 Balcão',
  delivery: '🚚 Delivery'
};

export default function ClosingHistory() {
  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  
  const [filters, setFilters] = useState<ClosingHistoryFilters>({
    dateRange: 'today',
    paymentMethod: 'all',
    orderType: 'all'
  });
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [customStartDate, setCustomStartDate] = useState<Date>();
  const [customEndDate, setCustomEndDate] = useState<Date>();
  const [minValue, setMinValue] = useState('');
  const [maxValue, setMaxValue] = useState('');

  const { data, isLoading, refetch } = useClosingHistory({
    ...filters,
    customStart: customStartDate,
    customEnd: customEndDate,
    minValue: minValue ? parseFloat(minValue) : undefined,
    maxValue: maxValue ? parseFloat(maxValue) : undefined
  });

  const summary = useClosingHistorySummary(data);

  const totalByMethod = useMemo(() => {
    const total = Object.values(summary.byPaymentMethod).reduce((a, b) => a + b, 0);
    return total || 1; // Prevent division by zero
  }, [summary.byPaymentMethod]);

  const canViewHistory = hasPermission('closing_history_view');
  const canExportHistory = hasPermission('closing_history_export');

  if (!permissionsLoading && !canViewHistory) {
    return <AccessDenied permission="closing_history_view" />;
  }

  const clearFilters = () => {
    setFilters({
      dateRange: 'today',
      paymentMethod: 'all',
      orderType: 'all'
    });
    setCustomStartDate(undefined);
    setCustomEndDate(undefined);
    setMinValue('');
    setMaxValue('');
  };

  const exportCSV = () => {
    if (!data || data.length === 0) return;

    const headers = ['Data/Hora', 'Tipo', 'Mesa', 'Cliente', 'Subtotal', 'Desconto', 'Total', 'Pagamentos'];
    const rows = data.map(record => [
      format(new Date(record.created_at), 'dd/MM/yyyy HH:mm'),
      orderTypeLabels[record.order_type],
      record.table_number || '-',
      record.customer_name || '-',
      record.subtotal.toFixed(2),
      record.discount.toFixed(2),
      record.total.toFixed(2),
      record.payments.map(p => `${paymentMethodLabels[p.payment_method].label}: ${p.amount.toFixed(2)}`).join('; ')
    ]);

    const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `fechamentos_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  return (
    <PDVLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Histórico de Fechamentos</h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
            {canExportHistory && (
              <Button variant="outline" size="sm" onClick={exportCSV} disabled={!data || data.length === 0}>
                <FileDown className="h-4 w-4 mr-2" />
                Exportar CSV
              </Button>
            )}
          </div>
        </div>

        {/* Filters */}
        <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    Filtros
                  </CardTitle>
                  <ChevronDown className={cn("h-4 w-4 transition-transform", filtersOpen && "rotate-180")} />
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Date Range */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Período</label>
                    <Select 
                      value={filters.dateRange} 
                      onValueChange={(v) => setFilters(prev => ({ ...prev, dateRange: v as any }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="today">Hoje</SelectItem>
                        <SelectItem value="yesterday">Ontem</SelectItem>
                        <SelectItem value="week">Últimos 7 dias</SelectItem>
                        <SelectItem value="month">Últimos 30 dias</SelectItem>
                        <SelectItem value="custom">Personalizado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Custom Date Range */}
                  {filters.dateRange === 'custom' && (
                    <>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Data inicial</label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-start text-left font-normal">
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {customStartDate ? format(customStartDate, 'dd/MM/yyyy') : 'Selecionar'}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={customStartDate}
                              onSelect={setCustomStartDate}
                              locale={ptBR}
                              className="pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium">Data final</label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full justify-start text-left font-normal">
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {customEndDate ? format(customEndDate, 'dd/MM/yyyy') : 'Selecionar'}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={customEndDate}
                              onSelect={setCustomEndDate}
                              locale={ptBR}
                              className="pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </>
                  )}

                  {/* Payment Method */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Forma de Pagamento</label>
                    <Select 
                      value={filters.paymentMethod || 'all'} 
                      onValueChange={(v) => setFilters(prev => ({ ...prev, paymentMethod: v as any }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        <SelectItem value="cash">Dinheiro</SelectItem>
                        <SelectItem value="credit_card">Crédito</SelectItem>
                        <SelectItem value="debit_card">Débito</SelectItem>
                        <SelectItem value="pix">Pix</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Order Type */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Tipo de Pedido</label>
                    <Select 
                      value={filters.orderType || 'all'} 
                      onValueChange={(v) => setFilters(prev => ({ ...prev, orderType: v as any }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="dine_in">Mesa</SelectItem>
                        <SelectItem value="takeaway">Balcão</SelectItem>
                        <SelectItem value="delivery">Delivery</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Min Value */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Valor mínimo</label>
                    <Input
                      type="number"
                      placeholder="R$ 0,00"
                      value={minValue}
                      onChange={(e) => setMinValue(e.target.value)}
                    />
                  </div>

                  {/* Max Value */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Valor máximo</label>
                    <Input
                      type="number"
                      placeholder="Sem limite"
                      value={maxValue}
                      onChange={(e) => setMaxValue(e.target.value)}
                    />
                  </div>
                </div>

                <div className="flex justify-end mt-4">
                  <Button variant="outline" size="sm" onClick={clearFilters}>
                    <X className="h-4 w-4 mr-2" />
                    Limpar filtros
                  </Button>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <DollarSign className="h-4 w-4" />
                Total
              </div>
              <p className="text-2xl font-bold mt-1">{formatCurrency(summary.totalRevenue)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <ShoppingCart className="h-4 w-4" />
                Pedidos
              </div>
              <p className="text-2xl font-bold mt-1">{summary.totalOrders}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <TrendingUp className="h-4 w-4" />
                Ticket Médio
              </div>
              <p className="text-2xl font-bold mt-1">{formatCurrency(summary.averageTicket)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground text-sm">
                <Tag className="h-4 w-4" />
                Descontos
              </div>
              <p className="text-2xl font-bold mt-1 text-destructive">{formatCurrency(summary.totalDiscounts)}</p>
            </CardContent>
          </Card>
        </div>

        {/* Payment Method Breakdown */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Pagamentos por Forma</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {(Object.entries(summary.byPaymentMethod) as [PaymentMethod, number][]).map(([method, amount]) => {
                const { label, icon: Icon } = paymentMethodLabels[method];
                const percent = totalByMethod > 0 ? Math.round((amount / totalByMethod) * 100) : 0;
                return (
                  <div key={method} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                    <Icon className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{label}</p>
                      <p className="text-lg font-bold">{formatCurrency(amount)}</p>
                    </div>
                    <Badge variant="secondary">{percent}%</Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Records Table */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Lista de Fechamentos</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Mesa</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Subtotal</TableHead>
                    <TableHead className="text-right">Desconto</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Pagamentos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Carregando...
                      </TableCell>
                    </TableRow>
                  ) : !data || data.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        Nenhum registro encontrado
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.map(record => (
                      <TableRow key={record.id}>
                        <TableCell className="whitespace-nowrap">
                          {format(new Date(record.created_at), 'dd/MM HH:mm')}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="whitespace-nowrap">
                            {orderTypeLabels[record.order_type]}
                          </Badge>
                        </TableCell>
                        <TableCell>{record.table_number || '-'}</TableCell>
                        <TableCell className="max-w-[120px] truncate">
                          {record.customer_name || '-'}
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(record.subtotal)}</TableCell>
                        <TableCell className="text-right text-destructive">
                          {record.discount > 0 ? `-${formatCurrency(record.discount)}` : '-'}
                        </TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(record.total)}</TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {record.payments.map((p, i) => (
                              <Badge key={i} variant="secondary" className="text-xs">
                                {paymentMethodLabels[p.payment_method].label.slice(0, 3)}: {formatCurrency(p.amount)}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </PDVLayout>
  );
}
