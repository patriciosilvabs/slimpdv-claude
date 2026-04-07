import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useBusinessRules } from '@/hooks/useBusinessRules';
import { Percent, Trash2, Lock, Clock, Wallet, BarChart3, Shield, Loader2, RefreshCw, Target, CreditCard, Eye } from 'lucide-react';

interface RuleToggleProps {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  badge?: string;
}

function RuleToggle({ label, description, checked, onCheckedChange, badge }: RuleToggleProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="space-y-0.5 flex-1">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium">{label}</Label>
          {badge && <Badge variant="outline" className="text-xs">{badge}</Badge>}
        </div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

interface RuleNumberProps {
  label: string;
  description: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  min?: number;
  max?: number;
  disabled?: boolean;
}

function RuleNumber({ label, description, value, onChange, suffix = '', min = 0, max = 100, disabled }: RuleNumberProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="space-y-0.5 flex-1">
        <Label className="text-sm font-medium">{label}</Label>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="w-24 h-8 text-sm text-right"
          disabled={disabled}
        />
        {suffix && <span className="text-sm text-muted-foreground whitespace-nowrap">{suffix}</span>}
      </div>
    </div>
  );
}

export function BusinessRulesSettings() {
  const { rules, updateRule, isLoading, isSaving } = useBusinessRules();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            Configure as regras operacionais do estabelecimento. Todas as regras são opcionais e configuráveis.
          </p>
        </div>
        {isSaving && (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Salvando...
          </div>
        )}
      </div>

      {/* Rule 7: Discount limits */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Percent className="h-5 w-5 text-amber-500" />
            Regra 7 — Limite de Desconto por Usuário
          </CardTitle>
          <CardDescription>Define o percentual máximo de desconto que cada função pode aplicar sem aprovação do gerente</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          <RuleToggle
            label="Ativar limite de desconto"
            description="Controla o desconto máximo por função. Descontos acima do limite exigem aprovação do gerente."
            checked={rules.discount_limit_enabled}
            onCheckedChange={(v) => updateRule('discount_limit_enabled', v)}
          />
          {rules.discount_limit_enabled && (
            <div className="ml-4 pl-4 border-l-2 border-muted space-y-1 mt-2">
              <RuleNumber
                label="Limite para Garçom/Atendente"
                description="Percentual máximo de desconto sem aprovação"
                value={rules.discount_limit_waiter}
                onChange={(v) => updateRule('discount_limit_waiter', v)}
                suffix="%"
                max={100}
              />
              <RuleNumber
                label="Limite para Caixa"
                description="Percentual máximo de desconto sem aprovação"
                value={rules.discount_limit_cashier}
                onChange={(v) => updateRule('discount_limit_cashier', v)}
                suffix="%"
                max={100}
              />
              <RuleNumber
                label="Limite para Supervisor (%)"
                description="Percentual máximo de desconto sem aprovação"
                value={rules.discount_limit_supervisor ?? 10}
                onChange={(v) => updateRule('discount_limit_supervisor', v)}
                min={0}
                max={100}
                disabled={!rules.discount_limit_enabled}
              />
              <RuleNumber
                label="Limite para Gerente (%)"
                description="Percentual máximo de desconto sem aprovação"
                value={rules.discount_limit_gerente ?? 30}
                onChange={(v) => updateRule('discount_limit_gerente', v)}
                min={0}
                max={100}
                disabled={!rules.discount_limit_enabled}
              />
              <RuleNumber
                label="Limite para Admin/Gerente"
                description="Acima deste valor, mesmo o gerente precisa de senha mestre"
                value={rules.discount_limit_manager}
                onChange={(v) => updateRule('discount_limit_manager', v)}
                suffix="%"
                max={100}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rule 8: Cancellation authorization */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            Regra 8 — Autorização de Cancelamento
          </CardTitle>
          <CardDescription>Cancelamentos de pedidos/itens exigem aprovação do gerente em tempo real</CardDescription>
        </CardHeader>
        <CardContent>
          <RuleToggle
            label="Exigir autorização para cancelar"
            description="Quando ativo, garçons precisam de aprovação do gerente para cancelar pedidos ou itens. Log de auditoria é sempre registrado."
            checked={rules.require_auth_cancellation}
            onCheckedChange={(v) => updateRule('require_auth_cancellation', v)}
          />
        </CardContent>
      </Card>

      {/* Rule 9: Block edit after kitchen */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="h-5 w-5 text-blue-500" />
            Regra 9 — Bloquear Edição Após Envio para Cozinha
          </CardTitle>
          <CardDescription>Evita erros de produção impedindo alterações após o pedido ser enviado</CardDescription>
        </CardHeader>
        <CardContent>
          <RuleToggle
            label="Bloquear edição após envio à cozinha"
            description="Após o pedido entrar em preparo (status: preparing), não permite edição de itens. Só cancela + refaz."
            checked={rules.block_edit_after_kitchen}
            onCheckedChange={(v) => updateRule('block_edit_after_kitchen', v)}
            badge="Em breve"
          />
        </CardContent>
      </Card>

      {/* Rule 10: Business hours */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-5 w-5 text-purple-500" />
            Regra 10 — Horário de Funcionamento
          </CardTitle>
          <CardDescription>Impede abertura de caixa fora do horário configurado</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          <RuleToggle
            label="Respeitar horário de funcionamento"
            description="Bloqueia abertura de caixa e criação de pedidos fora do horário configurado"
            checked={rules.business_hours_enabled}
            onCheckedChange={(v) => updateRule('business_hours_enabled', v)}
            badge="Em breve"
          />
          {rules.business_hours_enabled && (
            <div className="ml-4 pl-4 border-l-2 border-muted mt-2 flex gap-6">
              <div className="space-y-1">
                <Label className="text-xs">Abertura</Label>
                <Input
                  type="time"
                  value={rules.business_hours_open}
                  onChange={(e) => updateRule('business_hours_open', e.target.value)}
                  className="w-32 h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fechamento</Label>
                <Input
                  type="time"
                  value={rules.business_hours_close}
                  onChange={(e) => updateRule('business_hours_close', e.target.value)}
                  className="w-32 h-8 text-sm"
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rule 14: Cash register reopen authorization */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <RefreshCw className="h-5 w-5 text-blue-500" />
            Regra 14 — Reabrir Caixa Só com Autorização
          </CardTitle>
          <CardDescription>Reabertura do caixa exige aprovação do gerente em tempo real</CardDescription>
        </CardHeader>
        <CardContent>
          <RuleToggle
            label="Exigir autorização para abrir caixa"
            description="Quando ativo, a abertura do caixa envia notificação ao gerente que precisa aprovar antes de prosseguir."
            checked={rules.require_auth_cash_reopen}
            onCheckedChange={(v) => updateRule('require_auth_cash_reopen', v)}
          />
        </CardContent>
      </Card>

      {/* Cash register rules */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Wallet className="h-5 w-5 text-green-600" />
            Regras de Caixa (11, 13)
          </CardTitle>
          <CardDescription>Controle financeiro do caixa</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          <RuleToggle
            label="Regra 11 — Sangria obrigatória acima de valor"
            description="Exige retirada quando o caixa acumula acima do valor configurado"
            checked={rules.mandatory_withdrawal_enabled}
            onCheckedChange={(v) => updateRule('mandatory_withdrawal_enabled', v)}
            badge="Em breve"
          />
          {rules.mandatory_withdrawal_enabled && (
            <div className="ml-4 pl-4 border-l-2 border-muted mt-2">
              <RuleNumber
                label="Valor máximo no caixa"
                description="Acima deste valor, o sistema exige uma sangria"
                value={rules.mandatory_withdrawal_amount}
                onChange={(v) => updateRule('mandatory_withdrawal_amount', v)}
                suffix="R$"
                max={99999}
              />
            </div>
          )}

          <Separator />

          <RuleToggle
            label="Regra 13 — Limitar divergência no fechamento"
            description="Bloqueia fechamento se diferença entre contagem e esperado ultrapassar o limite. Acima disso, exige justificativa."
            checked={rules.cash_divergence_limit_enabled}
            onCheckedChange={(v) => updateRule('cash_divergence_limit_enabled', v)}
          />
          {rules.cash_divergence_limit_enabled && (
            <div className="ml-4 pl-4 border-l-2 border-muted mt-2">
              <RuleNumber
                label="Divergência máxima permitida"
                description="Diferença máxima sem necessidade de justificativa"
                value={rules.cash_divergence_limit_value}
                onChange={(v) => updateRule('cash_divergence_limit_value', v)}
                suffix="R$"
                max={9999}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Management rules */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-indigo-500" />
            Regra 19 — Proteção de Margem
          </CardTitle>
          <CardDescription>Evita vendas abaixo do custo de produção</CardDescription>
        </CardHeader>
        <CardContent>
          <RuleToggle
            label="Bloquear vendas abaixo do custo"
            description="Impede que descontos ou promoções levem o preço abaixo do custo cadastrado no produto"
            checked={rules.block_below_cost_enabled}
            onCheckedChange={(v) => updateRule('block_below_cost_enabled', v)}
            badge="Em breve"
          />
        </CardContent>
      </Card>

      {/* Rule 20: Operator sales target */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-5 w-5 text-green-500" />
            Regra 20 — Meta Mínima por Operador
          </CardTitle>
          <CardDescription>Define uma meta de vendas para cada operador durante o turno</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          <RuleToggle
            label="Ativar meta de vendas por turno"
            description="Mostra uma barra de progresso para o operador e alerta quando estiver abaixo da meta."
            checked={rules.min_sales_target_enabled}
            onCheckedChange={(v) => updateRule('min_sales_target_enabled', v)}
          />
          {rules.min_sales_target_enabled && (
            <div className="ml-4 pl-4 border-l-2 border-muted space-y-1 mt-2">
              <RuleNumber
                label="Meta por turno"
                description="Valor de vendas esperado por operador no turno"
                value={rules.min_sales_target_amount}
                onChange={(v) => updateRule('min_sales_target_amount', v)}
                suffix="R$"
                max={99999}
                min={0}
              />
              <RuleNumber
                label="Alertar quando abaixo de"
                description="Exibir alerta visual quando o operador estiver abaixo desta % da meta"
                value={rules.min_sales_target_alert_percent}
                onChange={(v) => updateRule('min_sales_target_alert_percent', v)}
                suffix="% da meta"
                max={100}
                min={10}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rule 21: Payment method restrictions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-purple-500" />
            Regra 21 — Restringir Formas de Pagamento por Horário
          </CardTitle>
          <CardDescription>Bloqueia métodos de pagamento em horários configurados (ex: sem dinheiro à noite)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RuleToggle
            label="Ativar restrição de formas de pagamento"
            description="Bloqueia as formas selecionadas durante o intervalo de horário configurado."
            checked={rules.payment_restrictions_enabled}
            onCheckedChange={(v) => updateRule('payment_restrictions_enabled', v)}
          />
          {rules.payment_restrictions_enabled && (
            <div className="ml-4 pl-4 border-l-2 border-muted mt-2 space-y-4">
              <div>
                <Label className="text-sm font-medium mb-2 block">Métodos bloqueados no intervalo</Label>
                {[
                  { key: 'cash', label: 'Dinheiro' },
                  { key: 'pix', label: 'PIX' },
                  { key: 'credit_card', label: 'Cartão de Crédito' },
                  { key: 'debit_card', label: 'Cartão de Débito' },
                ].map(({ key, label }) => (
                  <div key={key} className="flex items-center justify-between py-1">
                    <Label className="text-sm">{label}</Label>
                    <Switch
                      checked={rules.payment_restricted_methods.includes(key)}
                      onCheckedChange={(checked) => {
                        const current = rules.payment_restricted_methods;
                        const updated = checked
                          ? [...current, key]
                          : current.filter((m: string) => m !== key);
                        updateRule('payment_restricted_methods', updated);
                      }}
                    />
                  </div>
                ))}
              </div>
              <div className="flex gap-6">
                <div className="space-y-1">
                  <Label className="text-xs">Início da restrição</Label>
                  <Input
                    type="time"
                    value={rules.payment_restriction_start}
                    onChange={(e) => updateRule('payment_restriction_start', e.target.value)}
                    className="w-32 h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Fim da restrição</Label>
                  <Input
                    type="time"
                    value={rules.payment_restriction_end}
                    onChange={(e) => updateRule('payment_restriction_end', e.target.value)}
                    className="w-32 h-8 text-sm"
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rule 23: Supervisor mode */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Eye className="h-5 w-5 text-indigo-500" />
            Regra 23 — Modo Supervisão Ativa
          </CardTitle>
          <CardDescription>Gerente vê pedidos, caixa e KDS em tempo real no Dashboard</CardDescription>
        </CardHeader>
        <CardContent>
          <RuleToggle
            label="Ativar supervisão em tempo real"
            description="Habilita uma visão consolidada no Dashboard para gerentes: pedidos ativos, status do caixa, alertas do KDS e ranking de atendentes."
            checked={rules.supervisor_mode_enabled}
            onCheckedChange={(v) => updateRule('supervisor_mode_enabled', v)}
            badge="Dashboard"
          />
        </CardContent>
      </Card>

      {/* Audit */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-5 w-5 text-slate-500" />
            Regra 22 — Auditoria Completa
          </CardTitle>
          <CardDescription>Log detalhado de todas as ações sensíveis do sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <RuleToggle
            label="Ativar auditoria completa"
            description="Registra: quem abriu/fechou caixa, cancelamentos, descontos, aprovações negadas, reaberturas. Visível em Auditoria."
            checked={rules.audit_log_enabled}
            onCheckedChange={(v) => updateRule('audit_log_enabled', v)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
