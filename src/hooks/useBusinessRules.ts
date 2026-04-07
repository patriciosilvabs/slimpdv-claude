import { useGlobalSettings } from '@/hooks/useGlobalSettings';
import { useUserRole } from '@/hooks/useUserRole';

export interface BusinessRulesConfig {
  // Rule 7: Discount limits
  discount_limit_enabled: boolean;
  discount_limit_waiter: number;      // max % for waiter role
  discount_limit_cashier: number;     // max % for cashier role
  discount_limit_manager: number;     // max % for admin role (above this needs password)
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
}

const DEFAULT_RULES: BusinessRulesConfig = {
  discount_limit_enabled: false,
  discount_limit_waiter: 5,
  discount_limit_cashier: 15,
  discount_limit_manager: 100,
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
};

export function useBusinessRules() {
  const { getSetting, updateSetting, isLoading } = useGlobalSettings();
  const { role, isAdmin } = useUserRole();

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
    if (role === 'cashier') return rules.discount_limit_cashier;
    if (role === 'waiter') return rules.discount_limit_waiter;
    return rules.discount_limit_manager; // default for unknown roles
  };

  const isDiscountAboveLimit = (discountPercent: number): boolean => {
    if (!rules.discount_limit_enabled) return false;
    return discountPercent > getDiscountLimitForCurrentUser();
  };

  return {
    rules,
    updateRule,
    updateRules,
    isLoading,
    getDiscountLimitForCurrentUser,
    isDiscountAboveLimit,
    isSaving: updateSetting.isPending,
  };
}
