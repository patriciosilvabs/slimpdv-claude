import PDVLayout from '@/components/layout/PDVLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Factory, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  RefreshCw,
  Package,
  AlertCircle,
  TrendingUp,
  ShieldX,
  Loader2,
} from 'lucide-react';
import { 
  useConsolidatedProductionDemand, 
  useProductionDemandSummary,
  ProductionDemandItem,
} from '@/hooks/useProductionDemand';
import { useUnmappedSalesCount } from '@/hooks/useUnmappedSales';
import { FULL_DAY_NAMES } from '@/hooks/useProductionTargets';
import { UnmappedSalesAlert } from '@/components/production/UnmappedSalesAlert';
import { ShipmentConfirmDialog } from '@/components/production/ShipmentConfirmDialog';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useState } from 'react';

function StatusBadge({ status }: { status: 'ok' | 'warning' | 'critical' }) {
  const config = {
    ok: { label: 'OK', variant: 'default' as const, icon: CheckCircle2, className: 'bg-green-500/10 text-green-600 border-green-500/30' },
    warning: { label: 'Atenção', variant: 'secondary' as const, icon: Clock, className: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/30' },
    critical: { label: 'Crítico', variant: 'destructive' as const, icon: AlertTriangle, className: 'bg-red-500/10 text-red-600 border-red-500/30' },
  };
  
  const { label, icon: Icon, className } = config[status];
  
  return (
    <Badge variant="outline" className={className}>
      <Icon className="h-3 w-3 mr-1" />
      {label}
    </Badge>
  );
}

function LojaDemandCard({ 
  storeName, 
  items,
  onShipment,
  canManage,
}: { 
  storeName: string; 
  items: ProductionDemandItem[];
  onShipment: (item: ProductionDemandItem) => void;
  canManage: boolean;
}) {
  const criticalCount = items.filter(i => i.status === 'critical').length;
  const warningCount = items.filter(i => i.status === 'warning').length;
  
  const borderColor = criticalCount > 0 
    ? 'border-red-500/50' 
    : warningCount > 0 
      ? 'border-yellow-500/50' 
      : 'border-green-500/50';

  return (
    <Card className={`${borderColor} border-2`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{storeName}</CardTitle>
          <div className="flex gap-1">
            {criticalCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {criticalCount} crítico{criticalCount > 1 ? 's' : ''}
              </Badge>
            )}
            {warningCount > 0 && (
              <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600 text-xs">
                {warningCount} atenção
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhuma demanda para hoje
          </p>
        ) : (
          items.map((item) => (
            <div 
              key={item.ingredient_id} 
              className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
            >
              <div className="flex-1">
                <p className="font-medium text-sm">{item.ingredient_name}</p>
                <p className="text-xs text-muted-foreground">
                  Atual: {item.current_stock} | Meta: {item.ideal_stock} {item.unit}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`
                  font-bold text-lg
                  ${item.status === 'critical' ? 'text-red-600' : ''}
                  ${item.status === 'warning' ? 'text-yellow-600' : ''}
                  ${item.status === 'ok' ? 'text-green-600' : ''}
                `}>
                  {item.to_produce > 0 ? `+${item.to_produce}` : '✓'}
                </span>
                {item.to_produce > 0 && canManage && (
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => onShipment(item)}
                  >
                    Enviar
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

function ConsolidatedTable({ 
  data,
  onShipment,
  canManage,
}: { 
  data: ProductionDemandItem[];
  onShipment: (item: ProductionDemandItem) => void;
  canManage: boolean;
}) {
  // Group by ingredient
  const byIngredient: Record<string, { 
    name: string; 
    unit: string; 
    stores: Record<string, ProductionDemandItem>;
    total: number;
  }> = {};
  
  const storeNames = new Set<string>();
  
  for (const item of data) {
    storeNames.add(item.store_name);
    
    if (!byIngredient[item.ingredient_id]) {
      byIngredient[item.ingredient_id] = {
        name: item.ingredient_name,
        unit: item.unit,
        stores: {},
        total: 0,
      };
    }
    byIngredient[item.ingredient_id].stores[item.store_name] = item;
    byIngredient[item.ingredient_id].total += item.to_produce;
  }
  
  const stores = Array.from(storeNames).sort();
  const ingredients = Object.entries(byIngredient).sort((a, b) => b[1].total - a[1].total);

  if (ingredients.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>Nenhuma demanda de produção para hoje</p>
        <p className="text-sm">Configure metas em Configurações → Metas de Produção</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Ingrediente</TableHead>
            <TableHead className="text-center">Unid.</TableHead>
            {stores.map(store => (
              <TableHead key={store} className="text-center">{store}</TableHead>
            ))}
            <TableHead className="text-center font-bold">TOTAL</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {ingredients.map(([id, ingredient]) => (
            <TableRow key={id}>
              <TableCell className="font-medium">{ingredient.name}</TableCell>
              <TableCell className="text-center text-muted-foreground">{ingredient.unit}</TableCell>
              {stores.map(store => {
                const item = ingredient.stores[store];
                const value = item?.to_produce || 0;
                
                return (
                  <TableCell key={store} className="text-center">
                    {item ? (
                      <button
                        onClick={() => value > 0 && canManage && onShipment(item)}
                        disabled={value === 0 || !canManage}
                        className={`
                          px-2 py-1 rounded font-medium transition-colors
                          ${item.status === 'critical' ? 'bg-red-500/10 text-red-600 hover:bg-red-500/20' : ''}
                          ${item.status === 'warning' ? 'bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20' : ''}
                          ${item.status === 'ok' ? 'text-green-600' : ''}
                          ${value === 0 ? 'cursor-default' : 'cursor-pointer'}
                        `}
                      >
                        {value > 0 ? value : '✓'}
                      </button>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                );
              })}
              <TableCell className="text-center">
                <span className={`font-bold ${ingredient.total > 0 ? 'text-primary' : 'text-green-600'}`}>
                  {ingredient.total > 0 ? ingredient.total : '✓'}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function Production() {
  const { data: demand, isLoading, error, refetch } = useConsolidatedProductionDemand();
  const { summary } = useProductionDemandSummary();
  const { data: unmappedCount } = useUnmappedSalesCount();
  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  
  const [shipmentItem, setShipmentItem] = useState<ProductionDemandItem | null>(null);
  
  const today = new Date();
  const dayName = FULL_DAY_NAMES[today.getDay()];

  const canView = hasPermission('production_view');
  const canManage = hasPermission('production_manage');

  if (permissionsLoading) {
    return (
      <PDVLayout>
        <div className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </PDVLayout>
    );
  }

  if (!canView) {
    return (
      <PDVLayout>
        <Card className="max-w-md mx-auto mt-12">
          <CardContent className="flex flex-col items-center p-8 text-center">
            <div className="p-4 bg-destructive/10 rounded-full mb-4">
              <ShieldX className="h-8 w-8 text-destructive" />
            </div>
            <h2 className="text-xl font-bold mb-2">Acesso Negado</h2>
            <p className="text-muted-foreground">
              Você não tem permissão para acessar a Central de Produção.
            </p>
          </CardContent>
        </Card>
      </PDVLayout>
    );
  }

  return (
    <PDVLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Factory className="h-6 w-6" />
                Central de Produção
              </h1>
              <p className="text-muted-foreground">
                Demanda de produção para <strong>{dayName}</strong>, {today.toLocaleDateString('pt-BR')}
              </p>
            </div>
            <Button 
              variant="outline" 
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>

          {/* Unmapped Sales Alert */}
          {unmappedCount && unmappedCount > 0 && (
            <UnmappedSalesAlert count={unmappedCount} />
          )}

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-red-500/10">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{summary.criticalCount}</p>
                    <p className="text-xs text-muted-foreground">Críticos</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-yellow-500/10">
                    <Clock className="h-5 w-5 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{summary.warningCount}</p>
                    <p className="text-xs text-muted-foreground">Atenção</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-green-500/10">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{summary.okCount}</p>
                    <p className="text-xs text-muted-foreground">OK</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <TrendingUp className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{summary.totalItems}</p>
                    <p className="text-xs text-muted-foreground">Total Itens</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          {error ? (
            <Card>
              <CardContent className="flex items-center gap-2 py-8 text-destructive">
                <AlertCircle className="h-5 w-5" />
                <span>Erro ao carregar demanda: {(error as Error).message}</span>
              </CardContent>
            </Card>
          ) : isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-48 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          ) : (
            <Tabs defaultValue="stores" className="space-y-4">
              <TabsList>
                <TabsTrigger value="stores">Por Loja</TabsTrigger>
                <TabsTrigger value="consolidated">Consolidado</TabsTrigger>
              </TabsList>
              
              <TabsContent value="stores">
                {Object.keys(summary.byStore).length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                      <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Nenhuma demanda de produção para hoje</p>
                      <p className="text-sm">Configure metas em Configurações → Metas de Produção</p>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Object.entries(summary.byStore).map(([storeName, items]) => (
                      <LojaDemandCard 
                        key={storeName} 
                        storeName={storeName} 
                        items={items}
                        onShipment={setShipmentItem}
                        canManage={canManage}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>
              
              <TabsContent value="consolidated">
                <Card>
                  <CardHeader>
                    <CardTitle>Demanda Consolidada</CardTitle>
                    <CardDescription>
                      Clique em um valor para registrar envio de produção
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ConsolidatedTable 
                      data={demand || []} 
                      onShipment={setShipmentItem}
                      canManage={canManage}
                    />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </div>

        {/* Shipment Dialog */}
        <ShipmentConfirmDialog
          item={shipmentItem}
          onClose={() => setShipmentItem(null)}
        />
    </PDVLayout>
  );
}
