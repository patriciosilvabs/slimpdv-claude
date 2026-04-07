import { useOperatorSalesTarget } from '@/hooks/useOperatorSalesTarget';
import { useUserRole } from '@/hooks/useUserRole';
import { useBusinessRules } from '@/hooks/useBusinessRules';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Target, TrendingUp } from 'lucide-react';

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function OperatorTargetWidget() {
  const { isAdmin } = useUserRole();
  const { rules } = useBusinessRules();
  const { isEnabled, target, current, percent, isBelowAlert, orderCount } = useOperatorSalesTarget();

  // Only show to non-admins when rule is enabled
  if (!isEnabled || isAdmin) return null;

  return (
    <div className={`fixed bottom-20 left-4 z-40 bg-card border rounded-xl shadow-lg p-3 w-56 transition-all ${isBelowAlert ? 'border-amber-400' : 'border-border'}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Target className={`h-4 w-4 ${isBelowAlert ? 'text-amber-500' : 'text-primary'}`} />
          <span className="text-xs font-semibold">Meta do Turno</span>
        </div>
        <Badge variant={percent >= 100 ? 'default' : isBelowAlert ? 'destructive' : 'secondary'} className="text-xs px-1.5">
          {percent}%
        </Badge>
      </div>
      <Progress value={percent} className={`h-2 mb-2 ${isBelowAlert ? '[&>div]:bg-amber-500' : ''}`} />
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{formatCurrency(current)}</span>
        <span className="text-muted-foreground/60">/</span>
        <span>{formatCurrency(target)}</span>
      </div>
      {isBelowAlert && (
        <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
          <TrendingUp className="h-3 w-3" />
          Atenção: abaixo da meta!
        </p>
      )}
      {percent >= 100 && (
        <p className="text-xs text-green-600 mt-1.5">&#10003; Meta atingida! {orderCount} pedidos</p>
      )}
    </div>
  );
}
