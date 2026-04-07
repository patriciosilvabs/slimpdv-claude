import { useGlobalSettings } from '@/hooks/useGlobalSettings';
import { useUserRole } from '@/hooks/useUserRole';

export interface BusinessRulesConfig {
  // Rule 7: Discount limits
  discount_limit_enabled: boolean;
  discount_limit_waiter: number;      // max % for waiter role
  discount_limit_cashier: number;     // max % for cashier role
  discount_limit_manager: number;     // max % for admin role (above this needs password)
  discount_limit_gerente: number;
  discount_limit_supervisor: number;
  // Rule 8: Cancellation authorization
  require_auth_cancellation: boolean; // require manager approval for cancellations
  // Rule 9: Block edit after kitchen
  block_edit_after_kitchen: boolean;
  // Rule 10: Business hours
  business_hours_enabled: boolean;
  business_hours_open: string;        // "08:00"
  business_hours_close: string;       // "23:00"
  // Rule 11: Mandatory withdrawal
  mandatory_withdrawal_enabled: boolean;
  mandatory_withdrawal_amount: number;
  // Rule 13: Divergence limit
  cash_divergence_limit_enabled: boolean;
  cash_divergence_limit_value: number;
  // Rule 19: Block below cost
  block_below_cost_enabled: boolean;
  // Rule 22: Audit log
  audit_log_enabled: boolean;
  // Rule 12: Mandatory cash conference
  mandatory_cash_conference: boolean;
  // Rule 14: Cash register reopen authorization
  require_auth_cash_reopen: boolean;
  // Rule 20: Operator sales target
  min_sales_target_enabled: boolean;
  min_sales_target_amount: number;
  min_sales_target_alert_percent: number;
  // Rule 21: Payment method restrictions
  payment_restrictions_enabled: boolean;
  payment_restricted_methods: string[];
  payment_restriction_start: string;
  payment_restriction_end: string;
  // Rule 23: Supervisor mode
  supervisor_mode_enabled: boolean;
}

const DEFAULT_RULES: BusinessRulesConfig = {
  discount_limit_enabled: false,
  discount_limit_waiter: 5,
  discount_limit_cashier: 15,
  discount_limit_manager: 100,
  discount_limit_gerente: 30,
  discount_limit_supervisor: 10,
  require_auth_cancellation: false,
  block_edit_after_kitchen: false,
  business_hours_enabled: false,
  business_hours_open: '08:00',
  business_hours_close: '23:00',
  mandatory_withdrawal_enabled: false,
  mandatory_withdrawal_amount: 2000,
  cash_divergence_limit_enabled: false,
  cash_divergence_limit_value: 10,
  block_below_cost_enabled: false,
  audit_log_enabled: true,
  mandatory_cash_conference: false,
  require_auth_cash_reopen: false,
  min_sales_target_enabled: false,
  min_sales_target_amount: 500,
  min_sales_target_alert_percent: 50,
  payment_restrictions_enabled: false,
  payment_restricted_methods: [],
  payment_restriction_start: '21:00',
  payment_restriction_end: '08:00',
  supervisor_mode_enabled: false,
};

export function useBusinessRules() {
  const { getSetting, updateSetting, isLoading } = useGlobalSettings();
  const { isAdmin, isCashier, isWaiter, isGerente, isSupervisor } = useUserRole();

  const stored = getSetting('business_rules');
  const rules: BusinessRulesConfig = stored
    ? { ...DEFAULT_RULES, ...(stored as Partial<BusinessRulesConfig>) }
    : DEFAULT_RULES;

  const updateRule = async (key: keyof BusinessRulesConfig, value: unknown) => {
    const newRules = { ...rules, [key]: value };
    await updateSetting.mutateAsync({ key: 'business_rules', value: newRules });
  };

  const updateRules = async (updates: Partial<BusinessRulesConfig>) => {
    const newRules = { ...rules, ...updates };
    await updateSetting.mutateAsync({ key: 'business_rules', value: newRules });
  };

  // Get the discount limit for the current user's role
  const getDiscountLimitForCurrentUser = (): number => {
    if (isAdmin) return rules.discount_limit_manager;
    if (isGerente) return rules.discount_limit_gerente;
    if (isSupervisor) return rules.discount_limit_supervisor;
    if (isCashier) return rules.discount_limit_cashier;
    if (isWaiter) return rules.discount_limit_waiter;
    return rules.discount_limit_waiter; // default for other roles
  };

  const isDiscountAboveLimit = (discountPercent: number): boolean => {
    if (!rules.discount_limit_enabled) return false;
    return discountPercent > getDiscountLimitForCurrentUser();
  };

  // Check if a payment method is currently restricted
  const isPaymentMethodRestricted = (method: string): boolean => {
    if (!rules.payment_restrictions_enabled) return false;
    if (!rules.payment_restricted_methods.includes(method)) return false;
    // Check if current time is within restriction window
    const now = new Date();
    const [startH, startM] = rules.payment_restriction_start.split(':').map(Number);
    const [endH, endM] = rules.payment_restriction_end.split(':').map(Number);
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;
    // Handle overnight restriction (e.g., 21:00 to 08:00)
    if (startMinutes > endMinutes) {
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }
    return currentMinutes >= startMinutes && currentMinutes < endMinutes;
  };

  return {
    rules,
    updateRule,
    updateRules,
    isLoading,
    getDiscountLimitForCurrentUser,
    isDiscountAboveLimit,
    isPaymentMethodRestricted,
    isSaving: updateSetting.isPending,
  };
}
