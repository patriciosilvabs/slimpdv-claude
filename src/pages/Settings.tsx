import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import PDVLayout from '@/components/layout/PDVLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RequireRole } from '@/components/auth/RequireRole';
import { NotificationSettings } from '@/components/NotificationSettings';
import { PushNotificationSettings } from '@/components/PushNotificationSettings';
import { ScheduledAnnouncementsSettings } from '@/components/ScheduledAnnouncementsSettings';
import { PrinterSettings } from '@/components/PrinterSettings';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Crown, Sparkles, AlertTriangle, Settings as SettingsIcon } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/hooks/useTenant';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

// Settings components
import { SettingsSidebar, SettingsSection, SECTION_INFO } from '@/components/settings/SettingsSidebar';
import { TablesSettings } from '@/components/settings/TablesSettings';
import { KdsSettingsSection } from '@/components/settings/KdsSettingsSection';
import { KdsStationsSettings } from '@/components/settings/KdsStationsSettings';
import { OrderSettingsSection } from '@/components/settings/OrderSettingsSection';
import { UsersSettings } from '@/components/settings/UsersSettings';
import { RolesSettings } from '@/components/settings/RolesSettings';
import { InvitationsSettings } from '@/components/settings/InvitationsSettings';
import { CashRegisterSettings } from '@/components/settings/CashRegisterSettings';
import { CardapioWebSettings } from '@/components/settings/CardapioWebSettings';
import { ProductionTargetsSettings } from '@/components/settings/ProductionTargetsSettings';
import { ProductionApiSettings } from '@/components/settings/ProductionApiSettings';
import { StoresSettings } from '@/components/settings/StoresSettings';
import { KdsDevicesSettings } from '@/components/settings/KdsDevicesSettings';
import { WebhooksSettings } from '@/components/settings/WebhooksSettings';
import { DeliveryLogisticsSettings } from '@/components/settings/DeliveryLogisticsSettings';
import { AutomationSettings } from '@/components/settings/AutomationSettings';
import { AiAssistantSettings } from '@/components/settings/AiAssistantSettings';
import { BusinessRulesSettings } from '@/components/settings/BusinessRulesSettings';
const VALID_SECTIONS: SettingsSection[] = ['stores', 'tables', 'kds', 'kds-stations', 'kds-devices', 'orders', 'printers', 'cash-register', 'production-targets', 'production-api', 'automation', 'notifications', 'announcements', 'push', 'users', 'roles', 'invitations', 'integrations', 'webhooks', 'delivery-logistics', 'ai-assistant', 'business-rules'];

// Hook to check if current tenant has any admins
function useHasAdmins(tenantId: string | null) {
  return useQuery({
    queryKey: ['has-admins', tenantId],
    queryFn: async () => {
      if (!tenantId) return true; // Default to true (don't show bootstrap) if no tenant
      const { data, error } = await supabase
        .from('user_roles')
        .select('id')
        .eq('role', 'admin')
        .eq('tenant_id', tenantId)
        .limit(1);
      
      if (error) throw error;
      return (data?.length || 0) > 0;
    },
    enabled: !!tenantId,
  });
}

export default function Settings() {
  const { section } = useParams<{ section?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { tenantId } = useTenant();
  const { data: hasAdmins, isLoading: checkingAdmins, refetch: refetchAdmins } = useHasAdmins(tenantId);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  
  // Validate section from URL or default to 'stores'
  const activeSection: SettingsSection = VALID_SECTIONS.includes(section as SettingsSection) 
    ? (section as SettingsSection) 
    : 'stores';

  // Redirect to valid URL if section is missing or invalid
  useEffect(() => {
    if (!section || !VALID_SECTIONS.includes(section as SettingsSection)) {
      navigate('/settings/stores', { replace: true });
    }
  }, [section, navigate]);

  const handleSectionChange = (newSection: SettingsSection) => {
    navigate(`/settings/${newSection}`, { replace: true });
  };

  // Check if current user can bootstrap (no admins exist)
  const canBootstrap = !checkingAdmins && hasAdmins === false && user?.id;

  const handleBootstrapAdmin = async () => {
    if (!user?.id || !canBootstrap) return;
    
    setIsBootstrapping(true);
    try {
      const { data: memberData } = await supabase
        .from('tenant_members')
        .select('tenant_id')
        .eq('user_id', user.id)
        .limit(1)
        .single();
      const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: user.id, role: 'admin', tenant_id: memberData?.tenant_id ?? null });
      
      if (error) throw error;
      
      toast({ 
        title: 'Parabéns! 🎉', 
        description: 'Você agora é o administrador do sistema!' 
      });
      
      refetchAdmins();
      queryClient.invalidateQueries({ queryKey: ['user-roles'] });
      queryClient.invalidateQueries({ queryKey: ['has-admins'] });
    } catch (error: any) {
      toast({ 
        title: 'Erro ao se tornar admin', 
        description: error.message, 
        variant: 'destructive' 
      });
    } finally {
      setIsBootstrapping(false);
    }
  };

  if (canBootstrap) {
    return (
      <PDVLayout>
        <div className="max-w-2xl mx-auto space-y-6 pt-8">
          <Card className="border-primary/50 bg-gradient-to-br from-primary/5 to-primary/10">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <Crown className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">Bem-vindo ao PDV Pizzaria!</CardTitle>
              <CardDescription className="text-base">
                Você é o primeiro usuário do sistema. Configure-se como administrador para começar.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-warning/10 border border-warning/30 rounded-lg p-4 flex gap-3">
                <AlertTriangle className="h-5 w-5 text-warning flex-shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-warning">Atenção</p>
                  <p className="text-muted-foreground">
                    Como administrador, você terá acesso total ao sistema e poderá gerenciar outros usuários.
                    Esta ação só pode ser feita uma vez.
                  </p>
                </div>
              </div>
              
              <Button 
                className="w-full" 
                size="lg"
                onClick={handleBootstrapAdmin}
                disabled={isBootstrapping}
              >
                <Sparkles className="h-5 w-5 mr-2" />
                {isBootstrapping ? 'Configurando...' : 'Tornar-me Administrador'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </PDVLayout>
    );
  }

  const renderContent = () => {
    switch (activeSection) {
      case 'stores':
        return <StoresSettings />;
      case 'tables':
        return <TablesSettings />;
      case 'kds':
        return <KdsSettingsSection />;
      case 'kds-stations':
        return <KdsStationsSettings />;
      case 'kds-devices':
        return <KdsDevicesSettings />;
      case 'orders':
        return <OrderSettingsSection />;
      case 'printers':
        return <PrinterSettings />;
      case 'cash-register':
        return <CashRegisterSettings />;
      case 'production-targets':
        return <ProductionTargetsSettings />;
      case 'production-api':
        return <ProductionApiSettings />;
      case 'automation':
        return <AutomationSettings />;
      case 'notifications':
        return <NotificationSettings />;
      case 'announcements':
        return <ScheduledAnnouncementsSettings />;
      case 'push':
        return <PushNotificationSettings />;
      case 'users':
        return <UsersSettings />;
      case 'roles':
        return <RolesSettings />;
      case 'invitations':
        return <InvitationsSettings />;
      case 'integrations':
        return <CardapioWebSettings />;
      case 'webhooks':
        return <WebhooksSettings />;
      case 'delivery-logistics':
        return <DeliveryLogisticsSettings />;
      case 'ai-assistant':
        return <AiAssistantSettings />;
      case 'business-rules':
        return <BusinessRulesSettings />;
      default:
        return <StoresSettings />;
    }
  };

  return (
    <PDVLayout>
      <RequireRole roles={['admin']}>
        <div className="space-y-6">
          {/* Breadcrumb header */}
          <div>
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink 
                    href="/settings/stores" 
                    className="flex items-center gap-2 hover:text-foreground"
                    onClick={(e) => {
                      e.preventDefault();
                      handleSectionChange('stores');
                    }}
                  >
                    <SettingsIcon className="h-4 w-4" />
                    Configurações
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage className="flex items-center gap-2">
                    {React.createElement(SECTION_INFO[activeSection].icon, { className: "h-4 w-4" })}
                    {SECTION_INFO[activeSection].label}
                  </BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <p className="text-muted-foreground mt-1">Gerencie usuários, permissões e mesas do sistema</p>
          </div>

          <div className="flex gap-6">
            {/* Sidebar */}
            <div className="hidden md:block">
              <SettingsSidebar 
                activeSection={activeSection} 
                onSectionChange={handleSectionChange} 
              />
            </div>

            {/* Mobile select */}
            <div className="md:hidden w-full">
              <select 
                value={activeSection}
                onChange={(e) => handleSectionChange(e.target.value as SettingsSection)}
                className="w-full p-3 rounded-lg border bg-card text-card-foreground mb-4"
              >
                <optgroup label="Lojas">
                  <option value="stores">Minhas Lojas</option>
                </optgroup>
                <optgroup label="Sistema">
                  <option value="tables">Mesas</option>
                  <option value="kds">KDS</option>
                  <option value="kds-stations">Praças</option>
                  <option value="kds-devices">Dispositivos</option>
                  <option value="orders">Pedidos</option>
                  <option value="printers">Impressoras</option>
                  <option value="cash-register">Caixa</option>
                  <option value="production-targets">Metas de Produção</option>
                  <option value="production-api">API de Produção</option>
                  <option value="automation">Automação</option>
                  <option value="business-rules">Regras de Negócio</option>
                </optgroup>
                <optgroup label="Notificações">
                  <option value="notifications">Sons</option>
                  <option value="announcements">Avisos Agendados</option>
                  <option value="push">Push</option>
                </optgroup>
                <optgroup label="Equipe">
                  <option value="users">Usuários</option>
                  <option value="roles">Funções</option>
                  <option value="invitations">Convites</option>
                </optgroup>
                <optgroup label="Integrações">
                  <option value="integrations">CardápioWeb</option>
                  <option value="webhooks">Webhooks</option>
                  <option value="delivery-logistics">Logística Delivery</option>
                </optgroup>
              </select>
            </div>

            {/* Content with transition animation */}
            <div className="flex-1 min-w-0">
              <div key={activeSection} className="animate-fade-in">
                {renderContent()}
              </div>
            </div>
          </div>
        </div>
      </RequireRole>
    </PDVLayout>
  );
}
