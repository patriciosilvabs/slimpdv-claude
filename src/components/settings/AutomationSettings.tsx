import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useOrderSettings } from '@/hooks/useOrderSettings';
import { useCardapioWebIntegration } from '@/hooks/useCardapioWebIntegration';
import { useOrderWebhooks } from '@/hooks/useOrderWebhooks';
import { Zap, Printer, Truck, Monitor, PackageCheck, Loader2, Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface AutomationToggleProps {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
}

function AutomationToggle({ label, description, checked, onCheckedChange, disabled }: AutomationToggleProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="space-y-0.5">
        <Label className="text-sm font-medium">{label}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </div>
  );
}

export function AutomationSettings() {
  const {
    autoAccept,
    autoPrintKitchenTicket,
    autoPrintCustomerReceipt,
    toggleAutoAccept,
    toggleAutoPrintKitchenTicket,
    toggleAutoPrintCustomerReceipt,
    isLoading: printLoading,
  } = useOrderSettings();

  const {
    integration,
    isLoading: integrationLoading,
    saveIntegration,
  } = useCardapioWebIntegration();

  const {
    webhooks,
    isLoading: webhooksLoading,
    updateWebhook,
  } = useOrderWebhooks();

  const isLoading = printLoading || integrationLoading || webhooksLoading;

  const autoPrint = integration?.auto_print ?? true;
  const autoKds = integration?.auto_kds ?? true;
  const hasIntegration = !!integration;

  const activeWebhooks = webhooks.filter(w => w.is_active);
  const anyAutoSend = activeWebhooks.some((w: any) => w.auto_send);

  const handleIntegrationToggle = (field: 'auto_accept' | 'auto_print' | 'auto_kds', value: boolean) => {
    if (!integration) return;
    saveIntegration.mutate({
      api_token: integration.api_token,
      store_id: integration.store_id || undefined,
      webhook_secret: integration.webhook_secret || undefined,
      is_active: integration.is_active ?? true,
      auto_accept: field === 'auto_accept' ? value : autoAccept,
      auto_print: field === 'auto_print' ? value : autoPrint,
      auto_kds: field === 'auto_kds' ? value : autoKds,
    });
  };

  const handleAutoSendToggle = (value: boolean) => {
    activeWebhooks.forEach(w => {
      updateWebhook.mutate({ id: w.id, updates: { auto_send: value } as any });
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Automação de Pedidos
          </CardTitle>
          <CardDescription>
            Configure o que acontece automaticamente quando um pedido chega ao sistema
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {/* Aceite automático */}
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground mb-1">
              <PackageCheck className="h-4 w-4" />
              Quando o pedido chega
            </h3>
            <AutomationToggle
              label="Aceitar automaticamente"
              description="Pedidos entram direto em preparo sem precisar confirmar manualmente"
              checked={autoAccept}
              onCheckedChange={toggleAutoAccept}
            />
          </div>

          <Separator />

          {/* Impressão */}
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground mb-1 pt-2">
              <Printer className="h-4 w-4" />
              Impressão
            </h3>
            <AutomationToggle
              label="Comanda da cozinha"
              description="Imprime automaticamente a comanda para a cozinha"
              checked={autoPrintKitchenTicket}
              onCheckedChange={toggleAutoPrintKitchenTicket}
            />
            <AutomationToggle
              label="Recibo do cliente"
              description="Imprime automaticamente o recibo no caixa"
              checked={autoPrintCustomerReceipt}
              onCheckedChange={toggleAutoPrintCustomerReceipt}
            />
            {hasIntegration && (
              <AutomationToggle
                label="Impressão via integração"
                description="Imprime automaticamente pedidos recebidos por integração"
                checked={autoPrint}
                onCheckedChange={(v) => handleIntegrationToggle('auto_print', v)}
              />
            )}
          </div>

          <Separator />

          {/* Envio delivery */}
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground mb-1 pt-2">
              <Truck className="h-4 w-4" />
              Envio para entrega
            </h3>
            {activeWebhooks.length > 0 ? (
              <AutomationToggle
                label="Enviar ao Delivery Pay"
                description="Envia dados do pedido automaticamente para a plataforma de logística"
                checked={anyAutoSend}
                onCheckedChange={handleAutoSendToggle}
              />
            ) : (
              <p className="text-xs text-muted-foreground italic py-3">
                Nenhum webhook de delivery configurado. Configure em Integrações → Delivery Pay.
              </p>
            )}
          </div>

          <Separator />

          {/* KDS */}
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground mb-1 pt-2">
              <Monitor className="h-4 w-4" />
              KDS (Painel da Cozinha)
            </h3>
            <AutomationToggle
              label="Enviar ao KDS automaticamente"
              description="O pedido aparece no painel da cozinha sem intervenção manual"
              checked={autoKds}
              onCheckedChange={(v) => handleIntegrationToggle('auto_kds', v)}
              disabled={!hasIntegration}
            />
            {!hasIntegration && (
              <p className="text-xs text-muted-foreground italic ml-1 -mt-1">
                Configure a integração CardápioWeb primeiro para ativar
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Estas configurações valem para <strong>todos</strong> os pedidos: mesa, balcão, delivery, CardápioWeb e iFood.
          As mesmas opções continuam disponíveis nas páginas individuais (Impressoras, Integrações, Webhooks).
        </AlertDescription>
      </Alert>
    </div>
  );
}
