import { useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { XCircle, Calendar, Search, Download, Package, DollarSign, FileText, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useItemCancellationHistory, useItemCancellationSummary, ItemCancellationFilters } from '@/hooks/useItemCancellationHistory';
import { useEmployees } from '@/hooks/useEmployees';
import { cn } from '@/lib/utils';

export default function ItemCancellationHistory() {
  const [filters, setFilters] = useState<ItemCancellationFilters>({});
  const [reasonSearch, setReasonSearch] = useState('');

  const { data: records = [], isLoading } = useItemCancellationHistory(filters);
  const { data: employees = [] } = useEmployees();
  const summary = useItemCancellationSummary(records);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const handleReasonSearch = () => {
    setFilters(prev => ({ ...prev, reason: reasonSearch || undefined }));
  };

  const handleExportCSV = () => {
    const headers = ['Data/Hora', 'Produto', 'Variação', 'Quantidade', 'Valor', 'Mesa', 'Cliente', 'Motivo', 'Responsável'];
    const rows = records.map(r => [
      r.cancelled_at ? format(new Date(r.cancelled_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '',
      r.product_name,
      r.variation_name || '',
      r.quantity.toString(),
      formatCurrency(r.total_price),
      r.table_number?.toString() || '',
      r.customer_name || '',
      r.cancellation_reason,
      r.cancelled_by_name || ''
    ]);

    const csvContent = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `cancelamentos-itens-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  const getOrderTypeLabel = (type: string | null) => {
    switch (type) {
      case 'dine_in': return 'Mesa';
      case 'takeaway': return 'Balcão';
      case 'delivery': return 'Delivery';
      default: return type || '-';
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-destructive/10 rounded-lg">
            <XCircle className="h-6 w-6 text-destructive" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Histórico de Cancelamento de Itens</h1>
            <p className="text-muted-foreground">Auditoria de itens cancelados individualmente</p>
          </div>
        </div>
        <Button onClick={handleExportCSV} variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Itens</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.totalQuantity}</div>
            <p className="text-xs text-muted-foreground">{summary.totalCancellations} cancelamentos</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Total Perdido</CardTitle>
            <DollarSign className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{formatCurrency(summary.totalValue)}</div>
            <p className="text-xs text-muted-foreground">em itens cancelados</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Produto Mais Cancelado</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold truncate">{summary.mostCancelledProduct}</div>
            <p className="text-xs text-muted-foreground">
              {summary.productBreakdown[0]?.[1] || 0} unidades
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Motivo Mais Frequente</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold truncate">{summary.mostCommonReason}</div>
            <p className="text-xs text-muted-foreground">
              {summary.reasonBreakdown[0]?.[1] || 0} ocorrências
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            {/* Date From */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[180px] justify-start text-left font-normal", !filters.dateFrom && "text-muted-foreground")}>
                  <Calendar className="mr-2 h-4 w-4" />
                  {filters.dateFrom ? format(filters.dateFrom, 'dd/MM/yyyy', { locale: ptBR }) : 'Data inicial'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <CalendarComponent
                  mode="single"
                  selected={filters.dateFrom}
                  onSelect={(date) => setFilters(prev => ({ ...prev, dateFrom: date }))}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            {/* Date To */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className={cn("w-[180px] justify-start text-left font-normal", !filters.dateTo && "text-muted-foreground")}>
                  <Calendar className="mr-2 h-4 w-4" />
                  {filters.dateTo ? format(filters.dateTo, 'dd/MM/yyyy', { locale: ptBR }) : 'Data final'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <CalendarComponent
                  mode="single"
                  selected={filters.dateTo}
                  onSelect={(date) => setFilters(prev => ({ ...prev, dateTo: date }))}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            {/* Reason Search */}
            <div className="flex gap-2">
              <Input
                placeholder="Buscar motivo..."
                value={reasonSearch}
                onChange={(e) => setReasonSearch(e.target.value)}
                className="w-[200px]"
                onKeyDown={(e) => e.key === 'Enter' && handleReasonSearch()}
              />
              <Button variant="outline" size="icon" onClick={handleReasonSearch}>
                <Search className="h-4 w-4" />
              </Button>
            </div>

            {/* Cancelled By */}
            <Select
              value={filters.cancelledBy || 'all'}
              onValueChange={(value) => setFilters(prev => ({ ...prev, cancelledBy: value === 'all' ? undefined : value }))}
            >
              <SelectTrigger className="w-[200px]">
                <User className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Responsável" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {employees.map(emp => (
                  <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Clear Filters */}
            {(filters.dateFrom || filters.dateTo || filters.reason || filters.cancelledBy) && (
              <Button
                variant="ghost"
                onClick={() => {
                  setFilters({});
                  setReasonSearch('');
                }}
              >
                Limpar filtros
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : records.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum cancelamento de item encontrado
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data/Hora</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-center">Qtd</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Local</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Responsável</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell className="whitespace-nowrap">
                      {record.cancelled_at && format(new Date(record.cancelled_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{record.product_name}</div>
                      {record.variation_name && (
                        <div className="text-xs text-muted-foreground">{record.variation_name}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-center">{record.quantity}</TableCell>
                    <TableCell className="text-right font-medium text-destructive">
                      {formatCurrency(record.total_price)}
                    </TableCell>
                    <TableCell>
                      {record.table_number ? (
                        <Badge variant="outline">Mesa {record.table_number}</Badge>
                      ) : record.customer_name ? (
                        <span className="text-sm">{record.customer_name}</span>
                      ) : (
                        <Badge variant="secondary">{getOrderTypeLabel(record.order_type)}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[200px]">
                      <span className="text-sm truncate block" title={record.cancellation_reason}>
                        {record.cancellation_reason}
                      </span>
                    </TableCell>
                    <TableCell>
                      {record.cancelled_by_name || <span className="text-muted-foreground">-</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
