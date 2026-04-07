import { useState } from 'react';


function parseBRL(v: string): number {
  return parseFloat(v.replace(/\./g, '').replace(',', '.')) || 0;
}

/** ATM-style currency input: digits enter from right, auto-formats as "1.234,56" */
function handleCurrencyInput(raw: string, setter: (v: string) => void) {
  const digits = raw.replace(/\D/g, '');
  const cents = parseInt(digits || '0', 10);
  const formatted = (cents / 100).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  setter(formatted);
}
import PDVLayout from '@/components/layout/PDVLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useOpenCashRegister, useCashRegisterMutations, useCashRegisterPaymentSummary, PaymentMethod } from '@/hooks/useCashRegister';
import { useCashMovements } from '@/hooks/useReports';
import { useOrders, Order } from '@/hooks/useOrders';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useGlobalSettings } from '@/hooks/useGlobalSettings';
import { AccessDenied } from '@/components/auth/AccessDenied';
import { useQueryClient, useMutation, useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useCentralizedPrinting } from '@/hooks/useCentralizedPrinting';
import { CashClosingReceiptData } from '@/utils/escpos';
import { useToast } from '@/hooks/use-toast';
import { 
  DollarSign, 
  CreditCard, 
  Smartphone, 
  Receipt, 
  ArrowUpCircle, 
  ArrowDownCircle,
  Lock,
  Unlock,
  CheckCircle,
  Users,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

const paymentMethodConfig: Record<PaymentMethod, { label: string; icon: any }> = {
  cash: { label: 'Dinheiro', icon: DollarSign },
  credit_card: { label: 'Cartão Crédito', icon: CreditCard },
  debit_card: { label: 'Cartão Débito', icon: CreditCard },
  pix: { label: 'PIX', icon: Smartphone },
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export default function CashRegister() {
  // ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURN
  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const { getSetting, isLoading: settingsLoading } = useGlobalSettings();
  
  // Granular permission checks
  const canOpenCash = hasPermission('cash_open');
  const canCloseCash = hasPermission('cash_close');
  const canWithdraw = hasPermission('cash_withdraw');
  const canSupply = hasPermission('cash_supply');
  const canManage = hasPermission('cash_register_manage');
  const canViewDifference = hasPermission('cash_view_difference');
  
  // Blind cash register setting
  const blindCashRegister = getSetting('blind_cash_register') === true;
  // User can see difference if: not blind mode OR has permission OR is manager
  const showDifference = !blindCashRegister || canViewDifference || canManage;

  // State hooks
  const [isOpenDialogOpen, setIsOpenDialogOpen] = useState(false);
  const [isCloseDialogOpen, setIsCloseDialogOpen] = useState(false);
  const [isMovementDialogOpen, setIsMovementDialogOpen] = useState(false);
  const [isPaymentDialogOpen, setIsPaymentDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  
  const [openingAmount, setOpeningAmount] = useState('');
  const [closingCash, setClosingCash] = useState('');
  const [closingCredit, setClosingCredit] = useState('');
  const [closingDebit, setClosingDebit] = useState('');
  const [closingPix, setClosingPix] = useState('');
  // Derived total closing amount
  const closingAmount = [closingCash, closingCredit, closingDebit, closingPix]
    .reduce((sum, v) => sum + parseBRL(v), 0)
    .toFixed(2)
    .replace('.', ',');
  const [movementType, setMovementType] = useState<'withdrawal' | 'supply'>('withdrawal');
  const [movementAmount, setMovementAmount] = useState('');
  const [movementReason, setMovementReason] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [paymentAmount, setPaymentAmount] = useState('');
  const [showDifferenceAlert, setShowDifferenceAlert] = useState(false);

  // Query hooks
  const { data: openRegister, isLoading } = useOpenCashRegister();
  const { data: movements } = useCashMovements(openRegister?.id);
  const { data: allReadyOrders } = useOrders(['ready']);
  const { openCashRegister, closeCashRegister, createPayment } = useCashRegisterMutations();
  const { data: paymentSummary } = useCashRegisterPaymentSummary(openRegister?.id);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { printCashClosingReceipt, canPrintToCashier } = useCentralizedPrinting();

  // Queries para verificar pendências antes de fechar o caixa
  const { data: openTablesCount } = useQuery({
    queryKey: ['open-tables-for-closing'],
    queryFn: async () => {
      const { count } = await supabase
        .from('tables')
        .select('*', { count: 'exact', head: true })
        .neq('status', 'available');
      return count || 0;
    },
    enabled: !!openRegister,
  });

  const { data: pendingOrderCounts } = useQuery({
    queryKey: ['pending-orders-for-closing'],
    queryFn: async () => {
      const { data } = await supabase
        .from('orders')
        .select('order_type')
        .not('status', 'in', '("delivered","cancelled")')
        .eq('is_draft', false);
      return {
        dine_in: data?.filter(o => o.order_type === 'dine_in').length || 0,
        takeaway: data?.filter(o => o.order_type === 'takeaway').length || 0,
        delivery: data?.filter(o => o.order_type === 'delivery').length || 0,
      };
    },
    enabled: !!openRegister,
  });

  const closingPendencies: string[] = [];
  if ((openTablesCount || 0) > 0) closingPendencies.push(`${openTablesCount} mesa(s) aberta(s)`);
  if ((pendingOrderCounts?.dine_in || 0) > 0) closingPendencies.push(`${pendingOrderCounts!.dine_in} pedido(s) mesa pendente(s)`);
  if ((pendingOrderCounts?.takeaway || 0) > 0) closingPendencies.push(`${pendingOrderCounts!.takeaway} pedido(s) balcão/retirada pendente(s)`);
  if ((pendingOrderCounts?.delivery || 0) > 0) closingPendencies.push(`${pendingOrderCounts!.delivery} pedido(s) delivery pendente(s)`);
  const hasClosingPendencies = closingPendencies.length > 0;

  // Filter: only show dine_in orders (counter/takeaway are pre-paid)
  const readyOrders = allReadyOrders?.filter(o => o.order_type === 'dine_in');

  // Fetch partial payments for this cash register WITH receiver profile
  const { data: partialPayments } = useQuery({
    queryKey: ['partial-payments', openRegister?.id],
    queryFn: async () => {
      if (!openRegister?.id) return [];
      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          order:orders!inner(
            id, customer_name, table_id, total,
            table:tables(number)
          )
        `)
        .eq('is_partial', true)
        .eq('cash_register_id', openRegister.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!openRegister?.id,
  });

  // Permission check AFTER all hooks
  if (!permissionsLoading && !hasPermission('cash_register_view')) {
    return <AccessDenied permission="cash_register_view" />;
  }

  // Calculate totals for the open register
  const calculateTotals = () => {
    if (!openRegister) return { cash: 0, card: 0, pix: 0, total: 0 };
    
    const cashMovementsTotal = movements?.reduce((sum, m) => {
      if (m.movement_type === 'supply') return sum + Number(m.amount);
      if (m.movement_type === 'withdrawal') return sum - Number(m.amount);
      return sum;
    }, 0) || 0;

    const paymentsTotal = paymentSummary
      ? (paymentSummary.cash + paymentSummary.credit_card + paymentSummary.debit_card + paymentSummary.pix)
      : 0;

    return {
      opening: Number(openRegister.opening_amount),
      movements: cashMovementsTotal,
      payments: paymentsTotal,
      expected: Number(openRegister.opening_amount) + cashMovementsTotal + paymentsTotal,
    };
  };

  const totals = calculateTotals();

  // Cash movement mutation
  const addCashMovement = useMutation({
    mutationFn: async ({ type, amount, reason }: { type: 'withdrawal' | 'supply'; amount: number; reason: string }) => {
      if (!openRegister) throw new Error('Caixa não está aberto');
      
      const { data: userData } = await supabase.auth.getUser();
      
      const { error } = await supabase
        .from('cash_movements')
        .insert({
          cash_register_id: openRegister.id,
          movement_type: type,
          amount,
          reason,
          created_by: userData.user?.id
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cash-movements'] });
      queryClient.invalidateQueries({ queryKey: ['open-cash-register'] });
      toast({ title: movementType === 'withdrawal' ? 'Sangria registrada!' : 'Suprimento registrado!' });
      setIsMovementDialogOpen(false);
      setMovementAmount('');
      setMovementReason('');
    },
    onError: (error: Error) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  });

  const handleOpenRegister = async () => {
    const amount = parseBRL(openingAmount);
    if (isNaN(amount) || amount < 0) {
      toast({ title: 'Valor inválido', variant: 'destructive' });
      return;
    }
    await openCashRegister.mutateAsync(amount);
    setIsOpenDialogOpen(false);
    setOpeningAmount('');
  };

  const executeCloseRegister = async () => {
    if (!openRegister) return;
    const amount = parseBRL(closingAmount);

    // Print closing receipt before clearing state
    if (canPrintToCashier) {
      const suppliesTotal = movements?.filter(m => m.movement_type === 'supply').reduce((sum, m) => sum + Number(m.amount), 0) || 0;
      const withdrawalsTotal = movements?.filter(m => m.movement_type === 'withdrawal').reduce((sum, m) => sum + Number(m.amount), 0) || 0;

      const closingData: CashClosingReceiptData = {
        restaurantName: localStorage.getItem('pdv_restaurant_name') || 'Minha Pizzaria',
        openedAt: openRegister.opened_at ? new Date(openRegister.opened_at).toLocaleString('pt-BR') : '-',
        closedAt: new Date().toLocaleString('pt-BR'),
        openingAmount: Number(openRegister.opening_amount),
        suppliesTotal,
        withdrawalsTotal,
        payments: {
          cash: paymentSummary?.cash || 0,
          credit_card: paymentSummary?.credit_card || 0,
          debit_card: paymentSummary?.debit_card || 0,
          pix: paymentSummary?.pix || 0,
        },
        expectedTotal: totals.expected,
        counted: {
          cash: parseBRL(closingCash),
          credit_card: parseBRL(closingCredit),
          debit_card: parseBRL(closingDebit),
          pix: parseBRL(closingPix),
        },
        countedTotal: amount,
        difference: amount - totals.expected,
      };
      printCashClosingReceipt(closingData).catch(console.error);
    }

    await closeCashRegister.mutateAsync({ id: openRegister.id, closingAmount: amount });
    setIsCloseDialogOpen(false);
    setShowDifferenceAlert(false);
    setClosingCash('');
    setClosingCredit('');
    setClosingDebit('');
    setClosingPix('');
  };

  const allFieldsFilled = [closingCash, closingCredit, closingDebit, closingPix].every(v => v.trim() !== '');

  const handleCloseRegister = async () => {
    if (!openRegister) return;
    if (!allFieldsFilled) {
      toast({ title: 'Preencha todos os campos de valor contado', variant: 'destructive' });
      return;
    }
    const amount = parseBRL(closingAmount);
    if (isNaN(amount) || amount < 0) {
      toast({ title: 'Valor inválido', variant: 'destructive' });
      return;
    }
    // Se houver diferença, mostrar alerta de confirmação
    const difference = amount - totals.expected;
    if (Math.abs(difference) >= 0.01) {
      setShowDifferenceAlert(true);
      return;
    }
    await executeCloseRegister();
  };

  const handleMovement = async () => {
    const amount = parseBRL(movementAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: 'Valor inválido', variant: 'destructive' });
      return;
    }
    if (!movementReason.trim()) {
      toast({ title: 'Informe o motivo', variant: 'destructive' });
      return;
    }
    await addCashMovement.mutateAsync({ type: movementType, amount, reason: movementReason });
  };

  const handlePayment = async () => {
    if (!selectedOrder || !openRegister) return;
    const amount = parseBRL(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ title: 'Valor inválido', variant: 'destructive' });
      return;
    }
    await createPayment.mutateAsync({
      order_id: selectedOrder.id,
      payment_method: paymentMethod,
      amount,
      cash_register_id: openRegister.id
    });
    setIsPaymentDialogOpen(false);
    setSelectedOrder(null);
    setPaymentAmount('');
  };

  const selectOrderForPayment = (order: Order) => {
    setSelectedOrder(order);
    setPaymentAmount((order.total).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    setIsPaymentDialogOpen(true);
  };

  if (isLoading) {
    return (
      <PDVLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </PDVLayout>
    );
  }

  return (
    <PDVLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl xl:text-2xl font-bold">Caixa</h1>
            <p className="text-muted-foreground">
              {openRegister ? 'Caixa aberto - Receba pagamentos e gerencie o fluxo' : 'Abra o caixa para iniciar'}
            </p>
          </div>
          
          {!openRegister ? (
            <Dialog open={isOpenDialogOpen} onOpenChange={setIsOpenDialogOpen}>
              <DialogTrigger asChild>
                <Button size="lg" className="gap-2" disabled={!canOpenCash && !canManage}>
                  <Unlock className="h-5 w-5" />
                  Abrir Caixa
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Abrir Caixa</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Valor Inicial (Fundo de Troco)</Label>
                    <Input
                      type="text"
                      inputMode="numeric"
                      placeholder="0,00"
                      value={openingAmount}
                      onChange={(e) => handleCurrencyInput(e.target.value, setOpeningAmount)}
                    />
                  </div>
                  <Button className="w-full" onClick={handleOpenRegister} disabled={openCashRegister.isPending}>
                    Confirmar Abertura
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          ) : (
            <Dialog open={isCloseDialogOpen} onOpenChange={setIsCloseDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive" size="lg" className="gap-2" disabled={!canCloseCash && !canManage}>
                  <Lock className="h-5 w-5" />
                  Fechar Caixa
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Fechar Caixa</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  {hasClosingPendencies && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertTitle>Não é possível fechar o caixa</AlertTitle>
                      <AlertDescription>
                        <ul className="list-disc pl-4 mt-1 space-y-0.5 text-sm">
                          {closingPendencies.map((p, i) => (
                            <li key={i}>{p}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}
                  <div className="bg-muted p-4 rounded-lg space-y-2">
                    <div className="flex justify-between">
                      <span>Valor de Abertura:</span>
                      <span className="font-medium">{formatCurrency(totals.opening)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Movimentações:</span>
                      <span className={cn("font-medium", totals.movements >= 0 ? "text-accent" : "text-destructive")}>
                        {totals.movements >= 0 ? '+' : ''}{formatCurrency(totals.movements)}
                      </span>
                    </div>
                    {showDifference && (
                      <div className="flex justify-between border-t pt-2">
                        <span className="font-semibold">Valor Esperado:</span>
                        <span className="font-bold text-primary">{formatCurrency(totals.expected)}</span>
                      </div>
                    )}
                  </div>
                  {showDifference && paymentSummary && (
                    <div className="space-y-2 border-t pt-3">
                      <p className="text-sm font-medium text-muted-foreground">Esperado por método:</p>
                      {([
                        { key: 'cash' as const, label: 'Dinheiro', icon: DollarSign },
                        { key: 'credit_card' as const, label: 'Crédito', icon: CreditCard },
                        { key: 'debit_card' as const, label: 'Débito', icon: CreditCard },
                        { key: 'pix' as const, label: 'Pix', icon: Smartphone },
                      ]).map(({ key, label, icon: Icon }) => (
                        <div key={key} className="flex justify-between text-sm">
                          <span className="flex items-center gap-1.5">
                            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                            {label}:
                          </span>
                          <span className="font-medium">{formatCurrency(paymentSummary[key])}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="space-y-3">
                    <Label className="text-base font-semibold">Valor Contado por Método</Label>
                    {([
                      { key: 'cash' as const, label: 'Dinheiro', icon: DollarSign, value: closingCash, setter: setClosingCash },
                      { key: 'credit_card' as const, label: 'Cartão Crédito', icon: CreditCard, value: closingCredit, setter: setClosingCredit },
                      { key: 'debit_card' as const, label: 'Cartão Débito', icon: CreditCard, value: closingDebit, setter: setClosingDebit },
                      { key: 'pix' as const, label: 'Pix', icon: Smartphone, value: closingPix, setter: setClosingPix },
                    ]).map(({ key, label, icon: Icon, value, setter }) => (
                      <div key={key} className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <Label className="text-sm w-28 flex-shrink-0">{label}</Label>
                        <Input
                          type="text"
                          inputMode="numeric"
                          placeholder="0,00"
                          value={value}
                          onChange={(e) => handleCurrencyInput(e.target.value, setter)}
                          className="text-right"
                        />
                      </div>
                    ))}
                    <div className="flex justify-between pt-2 border-t font-semibold">
                      <span>Total Contado:</span>
                      <span className="text-primary">{formatCurrency(parseBRL(closingAmount))}</span>
                    </div>
                  </div>

                  {closingAmount && showDifference && (
                    <div className={cn(
                      "p-3 rounded-lg text-center",
                      parseBRL(closingAmount) === totals.expected 
                        ? "bg-accent/20 text-accent" 
                        : "bg-destructive/20 text-destructive"
                    )}>
                      Diferença: {formatCurrency(parseBRL(closingAmount) - totals.expected)}
                    </div>
                  )}
                  <Button 
                    className="w-full" 
                    variant="destructive"
                    onClick={handleCloseRegister} 
                    disabled={closeCashRegister.isPending || !allFieldsFilled || hasClosingPendencies}
                  >
                    Confirmar Fechamento
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}

          <AlertDialog open={showDifferenceAlert} onOpenChange={setShowDifferenceAlert}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="text-destructive">
                  ⚠️ Atenção — Diferença de Caixa
                </AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="space-y-3">
                    <p>
                      Foi identificada uma <strong className="text-foreground">diferença de {formatCurrency(Math.abs(parseBRL(closingAmount) - totals.expected))}</strong> entre o valor esperado e o valor contado.
                    </p>
                    <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-3 text-sm">
                      <p className="font-medium text-destructive mb-1">Aviso importante:</p>
                      <p>
                        A diferença de caixa (quebra de caixa) está sujeita a desconto em folha de pagamento, 
                        conforme política interna da empresa para colaboradores com função de operador de caixa.
                      </p>
                    </div>
                    <p className="text-sm">
                      Ao confirmar, você declara estar ciente da diferença e aceita as condições acima. 
                      Deseja continuar com o fechamento?
                    </p>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Voltar e Revisar</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  onClick={executeCloseRegister}
                  disabled={closeCashRegister.isPending}
                >
                  Confirmo e Aceito
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {openRegister ? (
          <div className="grid xl:grid-cols-3 gap-6">
            {/* Status Cards */}
            <div className="xl:col-span-2 space-y-6">
              <div className="grid sm:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <DollarSign className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Abertura</p>
                        <p className="text-xl font-bold">{formatCurrency(totals.opening)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-info/10 rounded-lg">
                        <Receipt className="h-5 w-5 text-info" />
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Movimentações</p>
                        <p className={cn("text-xl font-bold", totals.movements >= 0 ? "text-accent" : "text-destructive")}>
                          {totals.movements >= 0 ? '+' : ''}{formatCurrency(totals.movements)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                {showDifference && (
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-accent/10 rounded-lg">
                          <CheckCircle className="h-5 w-5 text-accent" />
                        </div>
                        <div>
                          <p className="text-sm text-muted-foreground">Esperado</p>
                          <p className="text-xl font-bold text-accent">{formatCurrency(totals.expected)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Orders Ready for Payment */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Pedidos Prontos para Pagamento</CardTitle>
                </CardHeader>
                <CardContent>
                  {readyOrders && readyOrders.length > 0 ? (
                    <div className="space-y-2">
                      {readyOrders.map((order) => (
                        <div 
                          key={order.id} 
                          className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                        >
                          <div>
                            <p className="font-medium">
                              {order.table?.number ? `Mesa ${order.table.number}` : 
                               order.customer_name || `#${order.id.slice(0, 8)}`}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {order.order_items?.length || 0} itens
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-lg font-bold">{formatCurrency(order.total)}</span>
                            <Button size="sm" onClick={() => selectOrderForPayment(order)}>
                              Receber
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center py-8 text-muted-foreground">
                      Nenhum pedido pronto para pagamento
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Movements History */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Movimentações do Caixa</CardTitle>
                </CardHeader>
                <CardContent>
                  {movements && movements.length > 0 ? (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {movements.map((m) => (
                        <div 
                          key={m.id} 
                          className="flex items-center justify-between p-3 border-b last:border-0"
                        >
                          <div className="flex items-center gap-3">
                            {m.movement_type === 'supply' ? (
                              <ArrowUpCircle className="h-5 w-5 text-accent" />
                            ) : (
                              <ArrowDownCircle className="h-5 w-5 text-destructive" />
                            )}
                            <div>
                              <p className="font-medium">
                                {m.movement_type === 'supply' ? 'Suprimento' : 'Sangria'}
                              </p>
                              <p className="text-sm text-muted-foreground">{m.reason}</p>
                            </div>
                          </div>
                          <span className={cn(
                            "font-bold",
                            m.movement_type === 'supply' ? "text-accent" : "text-destructive"
                          )}>
                            {m.movement_type === 'supply' ? '+' : '-'}{formatCurrency(Number(m.amount))}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center py-4 text-muted-foreground">
                      Nenhuma movimentação registrada
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Partial Payments History */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Pagamentos Parciais
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {partialPayments && partialPayments.length > 0 ? (
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {partialPayments.map((p: any) => {
                        const Icon = paymentMethodConfig[p.payment_method as PaymentMethod]?.icon || DollarSign;
                        return (
                          <div 
                            key={p.id} 
                            className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                          >
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-primary/10 rounded-lg">
                                <Icon className="h-4 w-4 text-primary" />
                              </div>
                              <div>
                                <p className="font-medium">
                                  {p.order?.table?.number 
                                    ? `Mesa ${p.order.table.number}` 
                                    : p.order?.customer_name || `Pedido #${p.order_id.slice(0, 6)}`}
                                </p>
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {new Date(p.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                  {' - '}
                                  {paymentMethodConfig[p.payment_method as PaymentMethod]?.label || p.payment_method}
                                </p>
                                {p.received_by_profile?.name && (
                                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Users className="h-3 w-3" />
                                    Recebido por: {p.received_by_profile.name}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="text-right">
                              <span className="font-bold text-primary">
                                {formatCurrency(Number(p.amount))}
                              </span>
                              <p className="text-xs text-muted-foreground">
                                de {formatCurrency(Number(p.order?.total || 0))}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-center py-4 text-muted-foreground">
                      Nenhum pagamento parcial registrado
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Actions Panel */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Ações Rápidas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Dialog open={isMovementDialogOpen} onOpenChange={setIsMovementDialogOpen}>
                    {(canWithdraw || canManage) && (
                      <DialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          className="w-full justify-start gap-3"
                          onClick={() => setMovementType('withdrawal')}
                        >
                          <ArrowDownCircle className="h-5 w-5 text-destructive" />
                          Sangria (Retirada)
                        </Button>
                      </DialogTrigger>
                    )}
                    {(canSupply || canManage) && (
                      <DialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          className="w-full justify-start gap-3"
                          onClick={() => setMovementType('supply')}
                        >
                          <ArrowUpCircle className="h-5 w-5 text-accent" />
                          Suprimento (Entrada)
                        </Button>
                      </DialogTrigger>
                    )}
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>
                          {movementType === 'withdrawal' ? 'Registrar Sangria' : 'Registrar Suprimento'}
                        </DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 pt-4">
                        <div className="space-y-2">
                          <Label>Valor</Label>
                          <Input
                            type="text"
                            inputMode="numeric"
                            placeholder="0,00"
                            value={movementAmount}
                            onChange={(e) => handleCurrencyInput(e.target.value, setMovementAmount)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Motivo</Label>
                          <Textarea
                            placeholder={movementType === 'withdrawal' 
                              ? "Ex: Pagamento de fornecedor" 
                              : "Ex: Reforço de troco"}
                            value={movementReason}
                            onChange={(e) => setMovementReason(e.target.value)}
                          />
                        </div>
                        <Button 
                          className="w-full" 
                          onClick={handleMovement}
                          disabled={addCashMovement.isPending}
                        >
                          Confirmar
                        </Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Informações do Caixa</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Aberto em:</span>
                    <span>{new Date(openRegister.opened_at).toLocaleString('pt-BR')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">ID do Caixa:</span>
                    <span className="font-mono">#{openRegister.id.slice(0, 8)}</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <Card>
            <CardContent className="p-12 text-center">
              <Lock className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">Caixa Fechado</h2>
              <p className="text-muted-foreground mb-6">
                Abra o caixa para começar a receber pagamentos e gerenciar o fluxo de dinheiro.
              </p>
              <Button size="lg" onClick={() => setIsOpenDialogOpen(true)}>
                <Unlock className="h-5 w-5 mr-2" />
                Abrir Caixa
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Payment Dialog */}
        <Dialog open={isPaymentDialogOpen} onOpenChange={setIsPaymentDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Receber Pagamento</DialogTitle>
            </DialogHeader>
            {selectedOrder && (
              <div className="space-y-4 pt-4">
                <div className="bg-muted p-4 rounded-lg">
                  <p className="text-sm text-muted-foreground">Pedido</p>
                  <p className="font-semibold">
                    {selectedOrder.table?.number ? `Mesa ${selectedOrder.table.number}` : 
                     selectedOrder.customer_name || `#${selectedOrder.id.slice(0, 8)}`}
                  </p>
                  <p className="text-2xl font-bold text-primary mt-2">
                    {formatCurrency(selectedOrder.total)}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Forma de Pagamento</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {(Object.entries(paymentMethodConfig) as [PaymentMethod, typeof paymentMethodConfig[PaymentMethod]][]).map(([method, config]) => {
                      const Icon = config.icon;
                      return (
                        <Button
                          key={method}
                          variant={paymentMethod === method ? "default" : "outline"}
                          className="h-auto py-3 flex flex-col items-center gap-1"
                          onClick={() => setPaymentMethod(method)}
                        >
                          <Icon className="h-5 w-5" />
                          <span className="text-xs">{config.label}</span>
                        </Button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Valor Recebido</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={paymentAmount}
                    onChange={(e) => handleCurrencyInput(e.target.value, setPaymentAmount)}
                  />
                </div>

                {paymentMethod === 'cash' && paymentAmount && (
                  <div className="bg-accent/10 p-3 rounded-lg">
                    <p className="text-sm text-muted-foreground">Troco</p>
                    <p className="text-xl font-bold text-accent">
                      {formatCurrency(Math.max(0, parseBRL(paymentAmount) - selectedOrder.total))}
                    </p>
                  </div>
                )}

                <Button 
                  className="w-full" 
                  size="lg"
                  onClick={handlePayment}
                  disabled={createPayment.isPending}
                >
                  <CheckCircle className="h-5 w-5 mr-2" />
                  Confirmar Pagamento
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </PDVLayout>
  );
}
