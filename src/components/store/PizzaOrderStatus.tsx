import { useEffect, useRef } from 'react';
import { Check, Clock, ChefHat, Bike, PartyPopper, Package } from 'lucide-react';
import { cn } from '@/lib/utils';
import { usePublicOrderStatus } from '@/hooks/usePublicStore';
import { toast } from 'sonner';

interface PizzaOrderStatusProps {
  storeName: string;
  isTable: boolean;
  orderType?: 'delivery' | 'takeaway';
  orderId: string | null;
  slug: string;
  onNewOrder: () => void;
}

const STATUS_ORDER = ['pending', 'preparing', 'ready', 'delivering', 'delivered'];

function getStepIndex(status: string): number {
  const idx = STATUS_ORDER.indexOf(status);
  return idx >= 0 ? idx : 0;
}

const STATUS_MESSAGES: Record<string, { delivery: string; takeaway: string }> = {
  preparing: { delivery: 'Seu pedido está sendo preparado! 🍕', takeaway: 'Seu pedido está sendo preparado! 🍕' },
  ready: { delivery: 'Seu pedido saiu para entrega! 🛵', takeaway: 'Você já pode retirar seu pedido! 📦' },
  delivering: { delivery: 'Seu pedido está a caminho! 🛵', takeaway: 'Você já pode retirar seu pedido! 📦' },
  delivered: { delivery: 'Pedido entregue! Bom apetite! 🎉', takeaway: 'Pedido retirado! Bom apetite! 🎉' },
};

export function PizzaOrderStatus({ storeName, isTable, orderType = 'delivery', orderId, slug, onNewOrder }: PizzaOrderStatusProps) {
  const { data: orderStatus } = usePublicOrderStatus(slug, orderId);
  const prevStatusRef = useRef<string | null>(null);

  const currentStatus = orderStatus?.status || 'pending';
  const stepIdx = getStepIndex(currentStatus);

  // Notify on status change
  useEffect(() => {
    if (!prevStatusRef.current) {
      prevStatusRef.current = currentStatus;
      return;
    }
    if (prevStatusRef.current !== currentStatus) {
      prevStatusRef.current = currentStatus;
      const msg = STATUS_MESSAGES[currentStatus];
      if (msg) {
        const type = orderType === 'takeaway' ? 'takeaway' : 'delivery';
        toast.success(msg[type]);
        // Try browser notification
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(storeName, { body: msg[type] });
        } else if ('Notification' in window && Notification.permission === 'default') {
          Notification.requestPermission();
        }
      }
    }
  }, [currentStatus, orderType, storeName]);

  const deliverySteps = [
    { label: 'Pedido recebido', icon: Check, done: stepIdx >= 0 },
    { label: 'Em preparo', icon: ChefHat, done: stepIdx >= 1 },
    { label: 'Saiu para entrega', icon: Bike, done: stepIdx >= 2 },
    { label: 'Entregue', icon: PartyPopper, done: stepIdx >= 4 },
  ];

  const takeawaySteps = [
    { label: 'Pedido recebido', icon: Check, done: stepIdx >= 0 },
    { label: 'Em preparo', icon: ChefHat, done: stepIdx >= 1 },
    { label: 'Você já pode retirar seu pedido', icon: Package, done: stepIdx >= 2 },
    { label: 'Retirado', icon: PartyPopper, done: stepIdx >= 4 },
  ];

  const steps = orderType === 'takeaway' ? takeawaySteps : deliverySteps;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 py-12" style={{ background: 'hsl(var(--store-bg))' }}>
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-xl border p-8 space-y-8" style={{ borderColor: 'hsl(var(--store-border))' }}>
        {/* Success Icon */}
        <div className="flex flex-col items-center text-center">
          <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mb-4">
            <Check className="h-10 w-10 text-green-600" strokeWidth={3} />
          </div>
          <h1 className="text-2xl font-extrabold" style={{ color: 'hsl(var(--store-card-foreground))' }}>Pedido Enviado!</h1>
          <p className="text-sm mt-2" style={{ color: 'hsl(var(--store-muted))' }}>
            {isTable ? 'Seu pedido foi recebido pela cozinha.' : 'Acompanhe o status abaixo.'}
          </p>
        </div>

        {/* Timeline */}
        {!isTable && (
          <div className="space-y-0 pl-2">
            {steps.map((step, i) => {
              const Icon = step.icon;
              const isLast = i === steps.length - 1;
              return (
                <div key={step.label} className="flex gap-4">
                  <div className="flex flex-col items-center">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center",
                      step.done ? "bg-[hsl(var(--store-primary))]" : "bg-gray-100"
                    )}>
                      <Icon className={cn("h-5 w-5", step.done ? "text-white" : "text-gray-400")} />
                    </div>
                    {!isLast && (
                      <div className={cn("w-0.5 h-8", step.done ? "bg-[hsl(var(--store-primary))]" : "bg-gray-200")} />
                    )}
                  </div>
                  <div className="pt-2.5">
                    <span className={cn("text-sm font-semibold", step.done ? "text-[hsl(var(--store-card-foreground))]" : "text-gray-400")}>
                      {step.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Estimated time */}
        <div className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-amber-50 border border-amber-200">
          <Clock className="h-4 w-4 text-amber-600" />
          <span className="text-sm font-semibold text-amber-700">Previsão: ~35 min</span>
        </div>

        {/* New Order Button */}
        <button
          onClick={onNewOrder}
          className="w-full h-14 rounded-2xl bg-[hsl(var(--store-primary))] text-white font-bold text-base shadow-lg hover:shadow-xl transition-all active:scale-[0.97]"
        >
          Fazer novo pedido
        </button>
      </div>
    </div>
  );
}
