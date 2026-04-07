import { useState } from 'react';
import PDVLayout from '@/components/layout/PDVLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { AccessDenied } from '@/components/auth/AccessDenied';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  ShoppingCart, 
  Receipt, 
  CalendarIcon,
  Package,
  Percent,
  Tag,
  Wallet,
  Users,
  UtensilsCrossed,
  Truck
} from 'lucide-react';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { 
  usePerformanceKPIs, 
  useHourlyRevenue, 
  useRevenueDetails, 
  useSegmentAnalysis,
  useEmployeePerformance,
  DateRange 
} from '@/hooks/usePerformance';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const CHART_COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))'];

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
};

const formatVariation = (value: number) => {
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
};

interface KPICardProps {
  title: string;
  value: number;
  variation: number;
  format: 'currency' | 'number';
  icon: React.ReactNode;
  loading?: boolean;
}

const KPICard = ({ title, value, variation, format: formatType, icon, loading }: KPICardProps) => {
  const isPositive = variation >= 0;
  
  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-8 w-32 mb-2" />
          <Skeleton className="h-4 w-16" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">{title}</span>
          <div className="p-2 bg-primary/10 rounded-lg">
            {icon}
          </div>
        </div>
        <div className="text-2xl font-bold mb-1">
          {formatType === 'currency' ? formatCurrency(value) : value}
        </div>
        <div className={cn(
          "flex items-center gap-1 text-sm font-medium",
          isPositive ? "text-green-500" : "text-red-500"
        )}>
          {isPositive ? (
            <TrendingUp className="h-4 w-4" />
          ) : (
            <TrendingDown className="h-4 w-4" />
          )}
          {formatVariation(variation)}
          <span className="text-muted-foreground font-normal ml-1">vs período anterior</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default function Performance() {
  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURN
  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const [dateRange, setDateRange] = useState<DateRange>({
    start: startOfDay(new Date()),
    end: endOfDay(new Date()),
  });
  const [filters, setFilters] = useState({
    orderType: 'all',
    paymentMethod: 'all',
  });
  const [groupBy, setGroupBy] = useState<'hour' | 'day'>('hour');
  const [segmentBy, setSegmentBy] = useState<'payment' | 'orderType'>('payment');
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  // Queries - must be before conditional return
  const { data: kpis, isLoading: kpisLoading } = usePerformanceKPIs(dateRange, filters);
  const { data: hourlyData, isLoading: hourlyLoading } = useHourlyRevenue(dateRange, groupBy);
  const { data: revenueDetails, isLoading: detailsLoading } = useRevenueDetails(dateRange);
  const { data: segments, isLoading: segmentsLoading } = useSegmentAnalysis(dateRange, segmentBy);
  const { data: employees, isLoading: employeesLoading } = useEmployeePerformance(dateRange);

  // Permission check AFTER all hooks
  if (!permissionsLoading && !hasPermission('performance_view')) {
    return <AccessDenied permission="performance_view" />;
  }

  const handleDatePreset = (days: number) => {
    const end = endOfDay(new Date());
    const start = startOfDay(subDays(new Date(), days - 1));
    setDateRange({ start, end });
  };

  return (
    <PDVLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Desempenho</h1>
            <p className="text-muted-foreground">Análise detalhada de vendas e performance</p>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-4 items-center">
              {/* Date Range Picker */}
              <div className="flex items-center gap-2">
                <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="min-w-[280px] justify-start">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {format(dateRange.start, "dd/MM/yyyy", { locale: ptBR })} - {format(dateRange.end, "dd/MM/yyyy", { locale: ptBR })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <div className="flex gap-2 p-2 border-b">
                      <Button variant="ghost" size="sm" onClick={() => { handleDatePreset(1); setIsCalendarOpen(false); }}>Hoje</Button>
                      <Button variant="ghost" size="sm" onClick={() => { handleDatePreset(7); setIsCalendarOpen(false); }}>7 dias</Button>
                      <Button variant="ghost" size="sm" onClick={() => { handleDatePreset(30); setIsCalendarOpen(false); }}>30 dias</Button>
                    </div>
                    <Calendar
                      mode="range"
                      selected={{ from: dateRange.start, to: dateRange.end }}
                      onSelect={(range) => {
                        if (range?.from && range?.to) {
                          setDateRange({ start: startOfDay(range.from), end: endOfDay(range.to) });
                          setIsCalendarOpen(false);
                        } else if (range?.from) {
                          setDateRange({ start: startOfDay(range.from), end: endOfDay(range.from) });
                        }
                      }}
                      locale={ptBR}
                      numberOfMonths={2}
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Order Type Filter */}
              <Select value={filters.orderType} onValueChange={(v) => setFilters(f => ({ ...f, orderType: v }))}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Tipo de pedido" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="dine_in">Mesa</SelectItem>
                  <SelectItem value="takeaway">Balcão</SelectItem>
                  <SelectItem value="delivery">Delivery</SelectItem>
                </SelectContent>
              </Select>

              {/* Payment Method Filter */}
              <Select value={filters.paymentMethod} onValueChange={(v) => setFilters(f => ({ ...f, paymentMethod: v }))}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Forma de pagamento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as formas</SelectItem>
                  <SelectItem value="cash">Dinheiro</SelectItem>
                  <SelectItem value="credit_card">Cartão de Crédito</SelectItem>
                  <SelectItem value="debit_card">Cartão de Débito</SelectItem>
                  <SelectItem value="pix">PIX</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <KPICard
            title="Faturamento"
            value={kpis?.revenue || 0}
            variation={kpis?.revenueVariation || 0}
            format="currency"
            icon={<DollarSign className="h-5 w-5 text-primary" />}
            loading={kpisLoading}
          />
          <KPICard
            title="Pedidos"
            value={kpis?.orders || 0}
            variation={kpis?.ordersVariation || 0}
            format="number"
            icon={<ShoppingCart className="h-5 w-5 text-primary" />}
            loading={kpisLoading}
          />
          <KPICard
            title="Ticket Médio"
            value={kpis?.averageTicket || 0}
            variation={kpis?.ticketVariation || 0}
            format="currency"
            icon={<Receipt className="h-5 w-5 text-primary" />}
            loading={kpisLoading}
          />
        </div>

        {/* Hourly Revenue Chart */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Faturamento por {groupBy === 'hour' ? 'Hora' : 'Dia'}</CardTitle>
            <Select value={groupBy} onValueChange={(v) => setGroupBy(v as 'hour' | 'day')}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="hour">Por hora</SelectItem>
                <SelectItem value="day">Por dia</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {hourlyLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={hourlyData || []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="hour" 
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <YAxis 
                    tickFormatter={(value) => `R$ ${value}`}
                    tick={{ fontSize: 12 }}
                    className="text-muted-foreground"
                  />
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="currentPeriod" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    name="Período atual"
                    dot={false}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="previousPeriod" 
                    stroke="hsl(var(--muted-foreground))" 
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    name="Período anterior"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue Details */}
          <Card>
            <CardHeader>
              <CardTitle>Detalhes do Faturamento</CardTitle>
            </CardHeader>
            <CardContent>
              {detailsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10 w-full" />)}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Package className="h-5 w-5 text-muted-foreground" />
                      <span>Total dos produtos</span>
                    </div>
                    <span className="font-semibold">{formatCurrency(revenueDetails?.productsTotal || 0)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Percent className="h-5 w-5 text-muted-foreground" />
                      <span>Taxa de serviço</span>
                    </div>
                    <span className="font-semibold">{formatCurrency(revenueDetails?.serviceCharge || 0)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Tag className="h-5 w-5 text-muted-foreground" />
                      <span>Total de descontos</span>
                    </div>
                    <span className="font-semibold text-red-500">-{formatCurrency(revenueDetails?.discountsTotal || 0)}</span>
                  </div>
                  <div className="border-t pt-4">
                    <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Wallet className="h-5 w-5 text-primary" />
                        <span className="font-semibold">Faturamento</span>
                      </div>
                      <span className="font-bold text-lg text-primary">{formatCurrency(revenueDetails?.netRevenue || 0)}</span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Segment Analysis */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Análise por Segmento</CardTitle>
              <Select value={segmentBy} onValueChange={(v) => setSegmentBy(v as 'payment' | 'orderType')}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="payment">Forma de pagamento</SelectItem>
                  <SelectItem value="orderType">Tipo de pedido</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              {segmentsLoading ? (
                <Skeleton className="h-[200px] w-full" />
              ) : (
                <div className="flex flex-col lg:flex-row gap-4">
                  <div className="w-full lg:w-1/3">
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie
                          data={segments || []}
                          dataKey="revenue"
                          nameKey="segment"
                          cx="50%"
                          cy="50%"
                          innerRadius={40}
                          outerRadius={70}
                        >
                          {(segments || []).map((_, index) => (
                            <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{segmentBy === 'payment' ? 'Forma' : 'Tipo'}</TableHead>
                          <TableHead className="text-right">Faturamento</TableHead>
                          <TableHead className="text-right">Pedidos</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(segments || []).map((seg, index) => (
                          <TableRow key={seg.segment}>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div 
                                  className="w-3 h-3 rounded-full" 
                                  style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                                />
                                {seg.segment}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">{formatCurrency(seg.revenue)}</TableCell>
                            <TableCell className="text-right">{seg.orders}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Employee Performance */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UtensilsCrossed className="h-5 w-5" />
                Mesas/Comandas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {employeesLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Funcionário</TableHead>
                      <TableHead className="text-right">Faturamento</TableHead>
                      <TableHead className="text-right">Pedidos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(employees?.dineIn || []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground">
                          Nenhum dado no período
                        </TableCell>
                      </TableRow>
                    ) : (
                      (employees?.dineIn || []).map((emp) => (
                        <TableRow key={emp.employeeId}>
                          <TableCell className="font-medium">{emp.employeeName}</TableCell>
                          <TableCell className="text-right">{formatCurrency(emp.revenue)}</TableCell>
                          <TableCell className="text-right">{emp.orders}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Delivery/Balcão
              </CardTitle>
            </CardHeader>
            <CardContent>
              {employeesLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Funcionário</TableHead>
                      <TableHead className="text-right">Faturamento</TableHead>
                      <TableHead className="text-right">Pedidos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(employees?.delivery || []).length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground">
                          Nenhum dado no período
                        </TableCell>
                      </TableRow>
                    ) : (
                      (employees?.delivery || []).map((emp) => (
                        <TableRow key={emp.employeeId}>
                          <TableCell className="font-medium">{emp.employeeName}</TableCell>
                          <TableCell className="text-right">{formatCurrency(emp.revenue)}</TableCell>
                          <TableCell className="text-right">{emp.orders}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </PDVLayout>
  );
}
