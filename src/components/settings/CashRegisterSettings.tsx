import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useGlobalSettings } from '@/hooks/useGlobalSettings';
import { EyeOff, Info } from 'lucide-react';

export function CashRegisterSettings() {
  const { getSetting, updateSetting, isLoading } = useGlobalSettings();
  
  const blindCashRegister = getSetting('blind_cash_register') === true;

  const handleToggle = async (checked: boolean) => {
    await updateSetting.mutateAsync({ key: 'blind_cash_register', value: checked });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <div className="animate-pulse space-y-4">
              <div className="h-4 bg-muted rounded w-1/3" />
              <div className="h-8 bg-muted rounded w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <EyeOff className="h-5 w-5" />
            Caixa Cego
          </CardTitle>
          <CardDescription>
            Configure o modo de fechamento de caixa
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-1">
              <Label htmlFor="blind-cash" className="text-base font-medium">
                Ativar Caixa Cego
              </Label>
              <p className="text-sm text-muted-foreground">
                Oculta o valor esperado e a diferença para funcionários durante o fechamento do caixa
              </p>
            </div>
            <Switch
              id="blind-cash"
              checked={blindCashRegister}
              onCheckedChange={handleToggle}
              disabled={updateSetting.isPending}
            />
          </div>

          <div className="bg-info/10 border border-info/30 rounded-lg p-4 flex gap-3">
            <Info className="h-5 w-5 text-info flex-shrink-0 mt-0.5" />
            <div className="text-sm space-y-2">
              <p className="font-medium text-info">Como funciona</p>
              <ul className="text-muted-foreground space-y-1 list-disc list-inside">
                <li>Quando ativado, o funcionário informa apenas o valor contado</li>
                <li>O valor esperado e a diferença ficam ocultos</li>
                <li>Gestores com a permissão "Ver diferença de caixa" continuam visualizando normalmente</li>
                <li>Os dados de diferença são registrados e podem ser consultados nos relatórios</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
