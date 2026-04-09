import { useState, useMemo } from 'react';
import PDVLayout from '@/components/layout/PDVLayout';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { AccessDenied } from '@/components/auth/AccessDenied';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Search, 
  Plus, 
  User, 
  Phone, 
  MapPin, 
  Edit, 
  History, 
  MessageCircle,
  Package,
  Calendar,
  DollarSign,
  ShoppingBag,
  CheckCircle2,
  AlertCircle,
  FileText,
  Filter,
  X,
  Cake,
  Truck,
  Store,
  UtensilsCrossed,
  Star
} from 'lucide-react';
import { useCustomers, useCustomerMutations, Customer } from '@/hooks/useCustomers';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, subDays, isAfter, isBefore, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatPhoneNumber(value: string): string {
  const numbers = value.replace(/\D/g, '');
  const limited = numbers.slice(0, 11);
  
  if (limited.length <= 2) {
    return limited.length ? `(${limited}` : '';
  } else if (limited.length <= 6) {
    return `(${limited.slice(0, 2)}) ${limited.slice(2)}`;
  } else if (limited.length <= 10) {
    return `(${limited.slice(0, 2)}) ${limited.slice(2, 6)}-${limited.slice(6)}`;
  } else {
    return `(${limited.slice(0, 2)}) ${limited.slice(2, 7)}-${limited.slice(7)}`;
  }
}

export default function Customers() {
  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const { data: customers, isLoading } = useCustomers();
  const { createCustomer, updateCustomer } = useCustomerMutations();
  const { toast } = useToast();

  if (!permissionsLoading && !hasPermission('customers_view')) {
    return <AccessDenied permission="customers_view" />;
  }

  const [searchQuery, setSearchQuery] = useState('');
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Filter states
  const [filterMinSpent, setFilterMinSpent] = useState('');
  const [filterMaxSpent, setFilterMaxSpent] = useState('');
  const [filterMinOrders, setFilterMinOrders] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [filterLastOrderDays, setFilterLastOrderDays] = useState<string>('');

  // Form state
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formBirthday, setFormBirthday] = useState('');

  // Fetch customer orders for history dialog
  const { data: customerOrders } = useQuery({
    queryKey: ['customer-orders', selectedCustomer?.id],
    queryFn: async () => {
      if (!selectedCustomer) return [];
      
      // Try by customer_id first, then fallback to phone/name
      let query = supabase
        .from('orders')
        .select(`
          id,
          created_at,
          order_type,
          status,
          total,
          order_items (
            id,
            quantity,
            unit_price,
            total_price,
            product:products(name)
          )
        `);
      
      // Build filter: customer_id OR phone/name match
      const filters = [`customer_id.eq.${selectedCustomer.id}`];
      if (selectedCustomer.phone) {
        filters.push(`customer_phone.eq."${selectedCustomer.phone}"`);
      }
      filters.push(`customer_name.eq."${selectedCustomer.name}"`);
      
      query = query.or(filters.join(','));
      
      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedCustomer && historyDialogOpen,
  });

  // Helper to check if customer is "active" (ordered in last 30 days)
  const isActiveCustomer = (customer: Customer): boolean => {
    if (!customer.last_order_at) return false;
    return isAfter(parseISO(customer.last_order_at), subDays(new Date(), 30));
  };

  // Check if any filter is active
  const hasActiveFilters = filterMinSpent || filterMaxSpent || filterMinOrders || filterStatus !== 'all' || filterLastOrderDays;

  const clearFilters = () => {
    setFilterMinSpent('');
    setFilterMaxSpent('');
    setFilterMinOrders('');
    setFilterStatus('all');
    setFilterLastOrderDays('');
  };

  const filteredCustomers = useMemo(() => {
    if (!customers) return [];
    
    return customers.filter(c => {
      // Text search
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        if (!c.name.toLowerCase().includes(query) && !c.phone?.toLowerCase().includes(query)) {
          return false;
        }
      }
      
      // Min spent filter
      if (filterMinSpent && c.total_spent < Number(filterMinSpent)) {
        return false;
      }
      
      // Max spent filter
      if (filterMaxSpent && c.total_spent > Number(filterMaxSpent)) {
        return false;
      }
      
      // Min orders filter
      if (filterMinOrders && c.total_orders < Number(filterMinOrders)) {
        return false;
      }
      
      // Status filter
      if (filterStatus === 'active' && !isActiveCustomer(c)) {
        return false;
      }
      if (filterStatus === 'inactive' && isActiveCustomer(c)) {
        return false;
      }
      
      // Last order days filter
      if (filterLastOrderDays) {
        const daysAgo = Number(filterLastOrderDays);
        if (c.last_order_at) {
          const cutoffDate = subDays(new Date(), daysAgo);
          if (isBefore(parseISO(c.last_order_at), cutoffDate)) {
            return false;
          }
        } else {
          return false; // No order = exclude when filtering by last order
        }
      }
      
      return true;
    });
  }, [customers, searchQuery, filterMinSpent, filterMaxSpent, filterMinOrders, filterStatus, filterLastOrderDays]);

  const openEditDialog = (customer: Customer) => {
    setSelectedCustomer(customer);
    setFormName(customer.name);
    setFormPhone(customer.phone || '');
    setFormAddress(customer.address || '');
    setFormNotes(customer.notes || '');
    setFormBirthday(customer.birthday || '');
    setEditDialogOpen(true);
  };

  const openCreateDialog = () => {
    setFormName('');
    setFormPhone('');
    setFormAddress('');
    setFormNotes('');
    setFormBirthday('');
    setCreateDialogOpen(true);
  };

  const openHistoryDialog = (customer: Customer) => {
    setSelectedCustomer(customer);
    setHistoryDialogOpen(true);
  };

  const handleCreate = async () => {
    if (!formName.trim()) {
      toast({ title: 'Nome é obrigatório', variant: 'destructive' });
      return;
    }

    try {
      await createCustomer.mutateAsync({
        name: formName.trim(),
        phone: formPhone || null,
        address: formAddress || null,
        notes: formNotes || null,
        birthday: formBirthday || null,
      });
      toast({ title: 'Cliente criado com sucesso!' });
      setCreateDialogOpen(false);
    } catch (error: any) {
      toast({ title: 'Erro ao criar cliente', description: error.message, variant: 'destructive' });
    }
  };

  const handleUpdate = async () => {
    if (!selectedCustomer || !formName.trim()) return;

    try {
      await updateCustomer.mutateAsync({
        id: selectedCustomer.id,
        name: formName.trim(),
        phone: formPhone || null,
        address: formAddress || null,
        notes: formNotes || null,
        birthday: formBirthday || null,
      } as any);
      toast({ title: 'Cliente atualizado!' });
      setEditDialogOpen(false);
    } catch (error: any) {
      toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
    }
  };

  const getOrderTypeLabel = (type: string | null) => {
    switch (type) {
      case 'delivery': return '🚚 Delivery';
      case 'takeaway': return '📦 Retirada';
      case 'dine_in': return '🍽️ Mesa';
      default: return type || '-';
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'pending': return <Badge variant="outline">Pendente</Badge>;
      case 'preparing': return <Badge variant="secondary">Preparando</Badge>;
      case 'ready': return <Badge className="bg-green-500">Pronto</Badge>;
      case 'delivered': return <Badge>Entregue</Badge>;
      case 'cancelled': return <Badge variant="destructive">Cancelado</Badge>;
      default: return <Badge variant="outline">{status || '-'}</Badge>;
    }
  };

  // Phone validation helper
  const phoneDigits = formPhone.replace(/\D/g, '');
  const isPhoneValid = phoneDigits.length >= 10;
  const isPhonePartial = phoneDigits.length > 0 && phoneDigits.length < 10;

  return (
    <PDVLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Clientes</h1>
            <p className="text-muted-foreground">Gerencie seus clientes e veja o histórico de pedidos</p>
          </div>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Cliente
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="space-y-3">
          <div className="flex gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou telefone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              variant={hasActiveFilters ? 'default' : 'outline'}
              onClick={() => setFiltersOpen(!filtersOpen)}
              className="gap-2"
            >
              <Filter className="h-4 w-4" />
              Filtros
              {hasActiveFilters && (
                <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                  !
                </Badge>
              )}
            </Button>
          </div>

          {/* Advanced Filters */}
          <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
            <CollapsibleContent>
              <Card className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Gasto mínimo (R$)</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={filterMinSpent}
                      onChange={(e) => setFilterMinSpent(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Gasto máximo (R$)</Label>
                    <Input
                      type="number"
                      placeholder="Sem limite"
                      value={filterMaxSpent}
                      onChange={(e) => setFilterMaxSpent(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Mín. de pedidos</Label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={filterMinOrders}
                      onChange={(e) => setFilterMinOrders(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Último pedido</Label>
                    <Select value={filterLastOrderDays} onValueChange={setFilterLastOrderDays}>
                      <SelectTrigger>
                        <SelectValue placeholder="Qualquer data" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Qualquer data</SelectItem>
                        <SelectItem value="7">Últimos 7 dias</SelectItem>
                        <SelectItem value="30">Últimos 30 dias</SelectItem>
                        <SelectItem value="60">Últimos 60 dias</SelectItem>
                        <SelectItem value="90">Últimos 90 dias</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="active">Ativos (30 dias)</SelectItem>
                        <SelectItem value="inactive">Inativos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {hasActiveFilters && (
                  <div className="mt-4 flex items-center justify-between pt-3 border-t">
                    <p className="text-sm text-muted-foreground">
                      {filteredCustomers.length} cliente(s) encontrado(s)
                    </p>
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-2">
                      <X className="h-4 w-4" />
                      Limpar filtros
                    </Button>
                  </div>
                )}
              </Card>
            </CollapsibleContent>
          </Collapsible>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-full">
                  <User className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{customers?.length || 0}</p>
                  <p className="text-sm text-muted-foreground">Total de clientes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-green-500/10 rounded-full">
                  <ShoppingBag className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {customers?.reduce((sum, c) => sum + c.total_orders, 0) || 0}
                  </p>
                  <p className="text-sm text-muted-foreground">Total de pedidos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-amber-500/10 rounded-full">
                  <DollarSign className="h-6 w-6 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {formatCurrency(customers?.reduce((sum, c) => sum + c.total_spent, 0) || 0)}
                  </p>
                  <p className="text-sm text-muted-foreground">Faturamento total</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Customers Table */}
        <Card>
          <CardHeader>
            <CardTitle>Lista de Clientes</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">
                Carregando...
              </div>
            ) : filteredCustomers.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <User className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Nenhum cliente encontrado</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-3 font-medium">Cliente</th>
                      <th className="pb-3 font-medium">Telefone</th>
                      <th className="pb-3 font-medium text-center">Pedidos</th>
                      <th className="pb-3 font-medium text-right">Total Gasto</th>
                      <th className="pb-3 font-medium">Último Pedido</th>
                      <th className="pb-3 font-medium text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCustomers.map(customer => (
                      <tr key={customer.id} className="border-b last:border-b-0 hover:bg-muted/50">
                        <td className="py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <User className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="font-medium">{customer.name}</p>
                                {customer.total_orders === 0 && (
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">Novo</Badge>
                                )}
                                {customer.total_orders === 1 && (
                                  <Badge className="bg-blue-500/10 text-blue-600 border-blue-200 text-[10px] px-1.5 py-0">1º pedido</Badge>
                                )}
                                {customer.total_orders >= 5 && (
                                  <Badge className="bg-amber-500/10 text-amber-600 border-amber-200 text-[10px] px-1.5 py-0">
                                    <Star className="h-3 w-3 mr-0.5" />Fiel
                                  </Badge>
                                )}
                              </div>
                              {customer.birthday && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Cake className="h-3 w-3" />
                                  {format(new Date(customer.birthday + 'T00:00:00'), 'dd/MM', { locale: ptBR })}
                                </p>
                              )}
                              {customer.address && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {customer.address.slice(0, 30)}{customer.address.length > 30 ? '...' : ''}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3">
                          {customer.phone ? (
                            <div className="flex items-center gap-2">
                              <span className="text-sm">{customer.phone}</span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-green-600 hover:text-green-700"
                                onClick={() => {
                                  const numbers = customer.phone?.replace(/\D/g, '') || '';
                                  window.open(`https://wa.me/55${numbers}`, '_blank');
                                }}
                              >
                                <MessageCircle className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="py-3 text-center">
                          <Badge variant="secondary">{customer.total_orders}</Badge>
                        </td>
                        <td className="py-3 text-right font-medium text-primary">
                          {formatCurrency(customer.total_spent)}
                        </td>
                        <td className="py-3">
                          {customer.last_order_at ? (
                            <span className="text-sm text-muted-foreground">
                              {format(new Date(customer.last_order_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="py-3">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openEditDialog(customer)}
                              title="Editar"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openHistoryDialog(customer)}
                              title="Histórico de Pedidos"
                            >
                              <History className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Customer Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Nome do cliente"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="(11) 99999-9999"
                  value={formPhone}
                  onChange={(e) => setFormPhone(formatPhoneNumber(e.target.value))}
                  className="pl-10 pr-10"
                  type="tel"
                />
                {isPhoneValid && (
                  <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                )}
                {isPhonePartial && (
                  <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-500" />
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Endereço</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Textarea
                  placeholder="Endereço completo"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  className="pl-10"
                  rows={2}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Aniversário</Label>
              <div className="relative">
                <Cake className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={formBirthday}
                  onChange={(e) => setFormBirthday(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                placeholder="Notas sobre o cliente..."
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={createCustomer.isPending}>
              {createCustomer.isPending ? 'Criando...' : 'Criar Cliente'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Customer Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Cliente</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Nome do cliente"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Telefone</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="(11) 99999-9999"
                  value={formPhone}
                  onChange={(e) => setFormPhone(formatPhoneNumber(e.target.value))}
                  className="pl-10 pr-10"
                  type="tel"
                />
                {isPhoneValid && (
                  <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-green-500" />
                )}
                {isPhonePartial && (
                  <AlertCircle className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-amber-500" />
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Endereço</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Textarea
                  placeholder="Endereço completo"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  className="pl-10"
                  rows={2}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Aniversário</Label>
              <div className="relative">
                <Cake className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={formBirthday}
                  onChange={(e) => setFormBirthday(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                placeholder="Notas sobre o cliente..."
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdate} disabled={updateCustomer.isPending}>
              {updateCustomer.isPending ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Order History Dialog */}
      <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Histórico - {selectedCustomer?.name}
            </DialogTitle>
          </DialogHeader>
          
          {selectedCustomer && (
            <div className="space-y-3 mb-4">
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-2xl font-bold text-primary">{selectedCustomer.total_orders}</p>
                    <p className="text-xs text-muted-foreground">Pedidos</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-600">{formatCurrency(selectedCustomer.total_spent)}</p>
                    <p className="text-xs text-muted-foreground">Total gasto</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      {selectedCustomer.total_orders > 0 
                        ? formatCurrency(selectedCustomer.total_spent / selectedCustomer.total_orders)
                        : formatCurrency(0)
                      }
                    </p>
                    <p className="text-xs text-muted-foreground">Ticket médio</p>
                  </div>
                </div>
              </div>
              
              {/* Order type breakdown */}
              {customerOrders && customerOrders.length > 0 && (() => {
                const takeawayCount = customerOrders.filter((o: any) => o.order_type === 'takeaway').length;
                const deliveryCount = customerOrders.filter((o: any) => o.order_type === 'delivery').length;
                const dineInCount = customerOrders.filter((o: any) => o.order_type === 'dine_in').length;
                return (
                  <div className="flex gap-3">
                    <div className="flex-1 bg-muted/50 rounded-lg p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5 mb-1">
                        <Store className="h-4 w-4 text-muted-foreground" />
                        <span className="text-lg font-bold">{takeawayCount}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">Retirada</p>
                    </div>
                    <div className="flex-1 bg-muted/50 rounded-lg p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5 mb-1">
                        <Truck className="h-4 w-4 text-muted-foreground" />
                        <span className="text-lg font-bold">{deliveryCount}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">Delivery</p>
                    </div>
                    <div className="flex-1 bg-muted/50 rounded-lg p-3 text-center">
                      <div className="flex items-center justify-center gap-1.5 mb-1">
                        <UtensilsCrossed className="h-4 w-4 text-muted-foreground" />
                        <span className="text-lg font-bold">{dineInCount}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">Mesa</p>
                    </div>
                  </div>
                );
              })()}

              {selectedCustomer.birthday && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded-lg px-4 py-2">
                  <Cake className="h-4 w-4" />
                  Aniversário: {format(new Date(selectedCustomer.birthday + 'T00:00:00'), 'dd/MM/yyyy', { locale: ptBR })}
                </div>
              )}
            </div>
          )}

          <ScrollArea className="flex-1">
            {!customerOrders || customerOrders.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Nenhum pedido encontrado</p>
              </div>
            ) : (
              <div className="space-y-3 pr-4">
                {customerOrders.map((order: any) => (
                  <div key={order.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">
                            {format(new Date(order.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                        <span className="text-sm text-muted-foreground">
                          {getOrderTypeLabel(order.order_type)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(order.status)}
                        <span className="font-bold text-primary">
                          {formatCurrency(order.total || 0)}
                        </span>
                      </div>
                    </div>
                    
                    {order.order_items && order.order_items.length > 0 && (
                      <div className="space-y-1 text-sm text-muted-foreground border-t pt-2">
                        {order.order_items.map((item: any) => (
                          <div key={item.id} className="flex items-center justify-between">
                            <span>
                              {item.quantity}x {item.product?.name || 'Produto'}
                            </span>
                            <span>{formatCurrency(item.total_price)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </PDVLayout>
  );
}
