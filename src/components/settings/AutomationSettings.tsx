import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useCardapioWebIntegration } from '@/hooks/useCardapioWebIntegration';
import { useOrderWebhooks } from '@/hooks/useOrderWebhooks';
import { useOrderSettings } from '@/hooks/useOrderSettings';
import { Zap, Truck, Monitor, Loader2, Info, Plug } from 'lucide-react';
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
  const { autoAccept } = useOrderSettings();

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

  const isLoading = integrationLoading || webhooksLoading;

  const autoPrint = integration?.auto_print ?? true;
  const autoKds = integration?.auto_kds ?? true;
  const hasIntegration = !!integration;

  const activeWebhooks = webhooks.filter(w => w.is_active);
  const anyAutoSend = activeWebhooks.some((w: any) => w.auto_send);

  const handleIntegrationToggle = (field: 'auto_print' | 'auto_kds', value: boolean) => {
    if (!integration) return;
    saveIntegration.mutate({
      api_token: integration.api_token,
      store_id: integration.store_id || undefined,
      webhook_secret: integration.webhook_secret || undefined,
      is_active: integration.is_active ?? true,
      auto_accept: autoAccept,
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
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          <strong>Aceite automático</strong> e <strong>impressão automática</strong> foram movidos para
          {' '}<strong>Pedidos</strong>. Sons de alerta estão em cada seção correspondente (Mesas, KDS, Pedidos).
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plug className="h-5 w-5 text-primary" />
            Integrações Externas
          </CardTitle>
          <CardDescription>
            Automação específica para pedidos recebidos via CardápioWeb e Delivery Pay
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {/* CardápioWeb */}
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground mb-1">
              <Monitor className="h-4 w-4" />
              CardápioWeb / iFood
            </h3>
            <AutomationToggle
              label="Impressão via integração"
              description="Imprime automaticamente pedidos recebidos por integração"
              checked={autoPrint}
              onCheckedChange={(v) => handleIntegrationToggle('auto_print', v)}
              disabled={!hasIntegration}
            />
            <AutomationToggle
              label="Enviar ao KDS automaticamente"
              description="O pedido aparece no painel da cozinha sem intervenção manual"
              checked={autoKds}
              onCheckedChange={(v) => handleIntegrationToggle('auto_kds', v)}
              disabled={!hasIntegration}
            />
            {!hasIntegration && (
              <p className="text-xs text-muted-foreground italic ml-1">
                Configure a integração CardápioWeb primeiro para ativar
              </p>
            )}
          </div>

          <Separator />

          {/* Delivery */}
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
        </CardContent>
      </Card>
    </div>
  );
}
