import { useState, useMemo } from 'react';
import PDVLayout from '@/components/layout/PDVLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useEmployees } from '@/hooks/useEmployees';
import { useCancellationHistory, useCancellationSummary, CancellationFilters } from '@/hooks/useCancellationHistory';
import { AccessDenied } from '@/components/auth/AccessDenied';
import { format, subDays, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Ban, Calendar, ChevronDown, ChevronUp, Download, Filter, Search, User, XCircle, TrendingDown, FileText, Loader2 } from 'lucide-react';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

const orderTypeLabels: Record<string, string> = {
  dine_in: 'Mesa',
  takeaway: 'Balcão',
  delivery: 'Delivery',
};

export default function CancellationHistory() {
  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const { data: employees } = useEmployees();
  
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [filters, setFilters] = useState<CancellationFilters>({
    dateFrom: subDays(new Date(), 30),
    dateTo: new Date(),
  });
  const [reasonSearch, setReasonSearch] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState<string>('all');

  // Build filters
  const queryFilters: CancellationFilters = useMemo(() => ({
    ...filters,
    reason: reasonSearch || undefined,
    cancelledBy: selectedEmployee !== 'all' ? selectedEmployee : undefined,
  }), [filters, reasonSearch, selectedEmployee]);

  const { data: records = [], isLoading } = useCancellationHistory(queryFilters);
  const summary = useCancellationSummary(records);

  if (!permissionsLoading && !hasPermission('closing_history_view')) {
    return <AccessDenied permission="closing_history_view" />;
  }

  const handleExportCSV = () => {
    const headers = ['Data', 'Hora', 'Tipo', 'Mesa/Cliente', 'Valor', 'Motivo', 'Responsável'];
    const rows = records.map(r => [
      r.cancelled_at ? format(new Date(r.cancelled_at), 'dd/MM/yyyy') : '-',
      r.cancelled_at ? format(new Date(r.cancelled_at), 'HH:mm') : '-',
      r.order_type ? orderTypeLabels[r.order_type] || r.order_type : '-',
      r.table_number ? `Mesa ${r.table_number}` : r.customer_name || '-',
      r.total?.toFixed(2) || '0.00',
      r.cancellation_reason || '-',
      r.cancelled_by_name || '-',
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cancelamentos_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const clearFilters = () => {
    setFilters({
      dateFrom: subDays(new Date(), 30),
      dateTo: new Date(),
    });
    setReasonSearch('');
    setSelectedEmployee('all');
  };

  return (
    <PDVLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Ban className="h-6 w-6 text-destructive" />
              Histórico de Cancelamentos
            </h1>
            <p className="text-muted-foreground">
              Acompanhe e audite os pedidos cancelados
            </p>
          </div>
          <Button variant="outline" onClick={handleExportCSV} disabled={records.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <XCircle className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Cancelados</p>
                  <p className="text-2xl font-bold">{summary.totalCancellations}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <TrendingDown className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Valor Perdido</p>
                  <p className="text-2xl font-bold text-destructive">{formatCurrency(summary.totalValue)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-warning/10">
                  <FileText className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Motivo Frequente</p>
                  <p className="text-lg font-semibold truncate">{summary.mostCommonReason}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-muted">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Período</p>
                  <p className="text-sm font-medium">
                    {filters.dateFrom ? format(filters.dateFrom, 'dd/MM') : '??'} - {filters.dateTo ? format(filters.dateTo, 'dd/MM') : '??'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    Filtros
                  </CardTitle>
                  {filtersOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </div>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label>Data Início</Label>
                    <Input
                      type="date"
                      value={filters.dateFrom ? format(filters.dateFrom, 'yyyy-MM-dd') : ''}
                      onChange={(e) => setFilters(f => ({ ...f, dateFrom: e.target.value ? new Date(e.target.value) : undefined }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Data Fim</Label>
                    <Input
                      type="date"
                      value={filters.dateTo ? format(filters.dateTo, 'yyyy-MM-dd') : ''}
                      onChange={(e) => setFilters(f => ({ ...f, dateTo: e.target.value ? new Date(e.target.value) : undefined }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Motivo</Label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar motivo..."
                        value={reasonSearch}
                        onChange={(e) => setReasonSearch(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Responsável</Label>
                    <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        {employees?.map((emp) => (
                          <SelectItem key={emp.id} value={emp.id}>
                            {emp.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex justify-end mt-4">
                  <Button variant="outline" size="sm" onClick={clearFilters}>
                    Limpar Filtros
                  </Button>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cancelamentos</CardTitle>
            <CardDescription>
              {isLoading ? 'Carregando...' : `${records.length} registro(s) encontrado(s)`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : records.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Ban className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhum cancelamento encontrado no período</p>
              </div>
            ) : (
              <ScrollArea className="max-h-[500px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Mesa/Cliente</TableHead>
                      <TableHead className="text-right">Valor</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Responsável</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="whitespace-nowrap">
                          {record.cancelled_at ? (
                            <div>
                              <div className="font-medium">
                                {format(new Date(record.cancelled_at), 'dd/MM/yyyy')}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {format(new Date(record.cancelled_at), 'HH:mm')}
                              </div>
                            </div>
                          ) : '-'}
                        </TableCell>
                        <TableCell>
                          {record.order_type && (
                            <Badge variant="outline">
                              {orderTypeLabels[record.order_type] || record.order_type}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {record.table_number ? (
                            <span className="font-medium">Mesa {record.table_number}</span>
                          ) : (
                            record.customer_name || '-'
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium text-destructive">
                          {formatCurrency(record.total || 0)}
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          <span className="truncate block" title={record.cancellation_reason || ''}>
                            {record.cancellation_reason || '-'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm">{record.cancelled_by_name || 'Desconhecido'}</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>
    </PDVLayout>
  );
}
