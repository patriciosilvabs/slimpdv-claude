import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useAllStationsMetrics,
  useStationPerformanceHistory,
  useBottleneckAnalysis,
  StationMetrics,
  BottleneckInfo,
} from '@/hooks/useKdsStationLogs';
import {
  BarChart3,
  Clock,
  AlertTriangle,
  TrendingUp,
  Users,
  CheckCircle,
  Timer,
  Activity,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  Cell,
} from 'recharts';

interface KdsMetricsDashboardProps {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const formatTime = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
};

const getSeverityColor = (severity: BottleneckInfo['severity']) => {
  switch (severity) {
    case 'critical':
      return 'bg-red-500/20 text-red-500 border-red-500/50';
    case 'high':
      return 'bg-orange-500/20 text-orange-500 border-orange-500/50';
    case 'medium':
      return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50';
    default:
      return 'bg-green-500/20 text-green-500 border-green-500/50';
  }
};

const getQueueStatus = (queue: number) => {
  if (queue === 0) return { color: 'text-muted-foreground', label: 'Vazio' };
  if (queue <= 2) return { color: 'text-green-500', label: 'Normal' };
  if (queue <= 5) return { color: 'text-yellow-500', label: 'Moderado' };
  return { color: 'text-red-500', label: 'Alto' };
};

// Station Metric Card
function StationMetricCard({ metric }: { metric: StationMetrics }) {
  const queueStatus = getQueueStatus(metric.currentQueue);
  const avgMinutes = Math.round(metric.averageSeconds / 60);
  const isSlowStation = avgMinutes > 10;

  return (
    <Card
      className="relative overflow-hidden"
      style={{ borderLeftColor: metric.stationColor, borderLeftWidth: '4px' }}
    >
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: metric.stationColor }}
            />
            {metric.stationName}
          </span>
          {isSlowStation && (
            <Badge variant="outline" className="text-yellow-500 border-yellow-500/50">
              <Clock className="h-3 w-3 mr-1" />
              Lento
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Main Metrics */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
            <Timer className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Tempo Médio</p>
              <p className={cn('font-bold', isSlowStation ? 'text-yellow-500' : 'text-foreground')}>
                {formatTime(metric.averageSeconds)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Completados</p>
              <p className="font-bold">{metric.totalCompleted}</p>
            </div>
          </div>
        </div>

        {/* Queue and In Progress */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Fila:</span>
            <span className={cn('font-semibold', queueStatus.color)}>
              {metric.currentQueue} itens
            </span>
          </div>
          {metric.inProgress > 0 && (
            <Badge variant="secondary">
              <Activity className="h-3 w-3 mr-1" />
              {metric.inProgress} em andamento
            </Badge>
          )}
        </div>

        {/* Min/Max */}
        {metric.totalCompleted > 0 && (
          <div className="flex items-center justify-between text-xs text-muted-foreground border-t pt-2">
            <span>Min: {formatTime(metric.minSeconds)}</span>
            <span>Máx: {formatTime(metric.maxSeconds)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Bottleneck Alert Card
function BottleneckAlert({ bottleneck }: { bottleneck: BottleneckInfo }) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 p-3 rounded-lg border',
        getSeverityColor(bottleneck.severity)
      )}
    >
      <AlertTriangle className="h-5 w-5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: bottleneck.stationColor }}
          />
          <span className="font-medium truncate">{bottleneck.stationName}</span>
          <Badge variant="outline" className="ml-auto text-xs">
            {bottleneck.severity === 'critical'
              ? 'CRÍTICO'
              : bottleneck.severity === 'high'
              ? 'ALTO'
              : 'MÉDIO'}
          </Badge>
        </div>
        <p className="text-sm mt-1 opacity-90">{bottleneck.reason}</p>
      </div>
    </div>
  );
}

// Performance Chart
function PerformanceChart() {
  const { data, isLoading } = useStationPerformanceHistory();

  if (isLoading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data || data.dataPoints.length === 0) {
    return (
      <div className="h-64 flex items-center justify-center text-muted-foreground">
        Sem dados de performance ainda
      </div>
    );
  }

  // Transform data for chart
  const hours = [...new Set(data.dataPoints.map(d => d.hour))].sort();
  const chartData = hours.map(hour => {
    const hourData: Record<string, any> = { hour };
    data.stations.forEach(station => {
      const point = data.dataPoints.find(
        d => d.hour === hour && d.stationId === station.id
      );
      hourData[station.id] = point ? Math.round(point.avgSeconds / 60) : null;
    });
    return hourData;
  });

  return (
    <ResponsiveContainer width="100%" height={250}>
      <LineChart data={chartData}>
        <XAxis
          dataKey="hour"
          tick={{ fontSize: 11 }}
          stroke="hsl(var(--muted-foreground))"
        />
        <YAxis
          tick={{ fontSize: 11 }}
          width={35}
          stroke="hsl(var(--muted-foreground))"
          label={{
            value: 'min',
            angle: -90,
            position: 'insideLeft',
            style: { fontSize: 10, fill: 'hsl(var(--muted-foreground))' },
          }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--background))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
            fontSize: '12px',
          }}
          formatter={(value: number) => [`${value} min`, '']}
        />
        <Legend
          wrapperStyle={{ fontSize: '11px' }}
          formatter={(value) => {
            const station = data.stations.find(s => s.id === value);
            return station?.name || value;
          }}
        />
        {data.stations.map(station => (
          <Line
            key={station.id}
            type="monotone"
            dataKey={station.id}
            stroke={station.color}
            strokeWidth={2}
            dot={{ r: 3 }}
            connectNulls
            name={station.id}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

// Completion Bar Chart
function CompletionChart({ metrics }: { metrics: StationMetrics[] }) {
  const chartData = metrics.map(m => ({
    name: m.stationName,
    completed: m.totalCompleted,
    color: m.stationColor,
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={chartData} layout="vertical">
        <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 11 }}
          width={100}
          stroke="hsl(var(--muted-foreground))"
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'hsl(var(--background))',
            border: '1px solid hsl(var(--border))',
            borderRadius: '8px',
            fontSize: '12px',
          }}
          formatter={(value: number) => [`${value} itens`, 'Completados']}
        />
        <Bar dataKey="completed" radius={[0, 4, 4, 0]}>
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function KdsMetricsDashboard({ trigger, open: controlledOpen, onOpenChange }: KdsMetricsDashboardProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  
  // Support both controlled and uncontrolled modes
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = (value: boolean) => {
    if (isControlled && onOpenChange) {
      onOpenChange(value);
    } else {
      setInternalOpen(value);
    }
  };
  
  const { data: metrics, isLoading: metricsLoading } = useAllStationsMetrics();
  const { data: bottlenecks, isLoading: bottlenecksLoading } = useBottleneckAnalysis();

  const isLoading = metricsLoading || bottlenecksLoading;
  const hasBottlenecks = bottlenecks && bottlenecks.length > 0;
  const criticalBottlenecks = bottlenecks?.filter(b => b.severity === 'critical') || [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Métricas</span>
            {criticalBottlenecks.length > 0 && (
              <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 justify-center">
                {criticalBottlenecks.length}
              </Badge>
            )}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Dashboard de Métricas - KDS
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[70vh] pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="overview" className="gap-2">
                  <Activity className="h-4 w-4" />
                  Visão Geral
                </TabsTrigger>
                <TabsTrigger value="performance" className="gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Performance
                </TabsTrigger>
                <TabsTrigger value="alerts" className="gap-2 relative">
                  <AlertTriangle className="h-4 w-4" />
                  Alertas
                  {hasBottlenecks && (
                    <Badge
                      variant={criticalBottlenecks.length > 0 ? 'destructive' : 'secondary'}
                      className="ml-1 h-5 min-w-5 p-0 px-1 justify-center text-xs"
                    >
                      {bottlenecks?.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview" className="space-y-4">
                {/* Summary Stats */}
                {metrics && metrics.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Card className="bg-primary/5">
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-5 w-5 text-primary" />
                          <div>
                            <p className="text-xs text-muted-foreground">Total Completados</p>
                            <p className="text-2xl font-bold">
                              {metrics.reduce((sum, m) => sum + m.totalCompleted, 0)}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-blue-500/5">
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-2">
                          <Timer className="h-5 w-5 text-blue-500" />
                          <div>
                            <p className="text-xs text-muted-foreground">Tempo Médio Geral</p>
                            <p className="text-2xl font-bold">
                              {formatTime(
                                Math.round(
                                  metrics.reduce((sum, m) => sum + m.averageSeconds, 0) /
                                    metrics.length
                                )
                              )}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-yellow-500/5">
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-2">
                          <Users className="h-5 w-5 text-yellow-500" />
                          <div>
                            <p className="text-xs text-muted-foreground">Total na Fila</p>
                            <p className="text-2xl font-bold">
                              {metrics.reduce((sum, m) => sum + m.currentQueue, 0)}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <Card className="bg-green-500/5">
                      <CardContent className="pt-4">
                        <div className="flex items-center gap-2">
                          <Activity className="h-5 w-5 text-green-500" />
                          <div>
                            <p className="text-xs text-muted-foreground">Em Andamento</p>
                            <p className="text-2xl font-bold">
                              {metrics.reduce((sum, m) => sum + m.inProgress, 0)}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {/* Station Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {metrics?.map(metric => (
                    <StationMetricCard key={metric.stationId} metric={metric} />
                  ))}
                </div>

                {(!metrics || metrics.length === 0) && (
                  <div className="text-center py-12 text-muted-foreground">
                    <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhuma praça configurada ou sem dados ainda</p>
                  </div>
                )}
              </TabsContent>

              {/* Performance Tab */}
              <TabsContent value="performance" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Tempo Médio por Hora (últimas 6h)
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <PerformanceChart />
                  </CardContent>
                </Card>

                {metrics && metrics.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm flex items-center gap-2">
                        <CheckCircle className="h-4 w-4" />
                        Itens Completados por Praça (24h)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CompletionChart metrics={metrics} />
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Alerts Tab */}
              <TabsContent value="alerts" className="space-y-4">
                {hasBottlenecks ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        Gargalos Detectados
                      </h3>
                      <Badge variant="outline">
                        {bottlenecks?.length} alerta{bottlenecks && bottlenecks.length > 1 ? 's' : ''}
                      </Badge>
                    </div>
                    {bottlenecks?.map((bottleneck, index) => (
                      <BottleneckAlert key={index} bottleneck={bottleneck} />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500 opacity-50" />
                    <p className="text-lg font-medium">Tudo em ordem!</p>
                    <p className="text-sm">Nenhum gargalo detectado no momento</p>
                  </div>
                )}

                {/* Alert Thresholds Info */}
                <Card className="bg-muted/30">
                  <CardHeader>
                    <CardTitle className="text-sm">Critérios de Alerta</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-2 text-muted-foreground">
                    <p>
                      <span className="text-red-500 font-medium">Crítico:</span> Tempo &gt;80% acima da
                      média ou fila &gt;8 itens
                    </p>
                    <p>
                      <span className="text-orange-500 font-medium">Alto:</span> Tempo &gt;40% acima
                      da média ou fila &gt;5 itens
                    </p>
                    <p>
                      <span className="text-yellow-500 font-medium">Médio:</span> Tempo &gt;20% acima
                      da média ou fila &gt;3 itens
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
