import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  UtensilsCrossed,
  ChefHat,
  ShoppingCart,
  Printer,
  Bell,
  Megaphone,
  Smartphone,
  Users,
  Shield,
  Search,
  X,
  Factory,
  Mail,
  Wallet,
  Plug,
  Target,
  Server,
  Building2,
  Truck,
  Zap,
  Bot,
  LucideIcon
} from 'lucide-react';
import { Input } from '@/components/ui/input';

export type SettingsSection =
  | 'stores'
  | 'tables'
  | 'kds'
  | 'kds-stations'
  | 'kds-devices'
  | 'orders'
  | 'printers'
  | 'cash-register'
  | 'production-targets'
  | 'production-api'
  | 'automation'
  | 'notifications'
  | 'announcements'
  | 'push'
  | 'users'
  | 'roles'
  | 'invitations'
  | 'integrations'
  | 'webhooks'
  | 'delivery-logistics'
  | 'ai-assistant';

// Export section info for reuse (breadcrumb, etc.)
export const SECTION_INFO: Record<SettingsSection, { label: string; icon: LucideIcon }> = {
  stores: { label: 'Lojas', icon: Building2 },
  tables: { label: 'Mesas', icon: UtensilsCrossed },
  kds: { label: 'KDS', icon: ChefHat },
  'kds-stations': { label: 'Praças', icon: Factory },
  'kds-devices': { label: 'Dispositivos', icon: Smartphone },
  orders: { label: 'Pedidos', icon: ShoppingCart },
  printers: { label: 'Impressoras', icon: Printer },
  'cash-register': { label: 'Caixa', icon: Wallet },
  'production-targets': { label: 'Metas de Produção', icon: Target },
  'production-api': { label: 'API de Produção', icon: Server },
  automation: { label: 'Integrações Auto', icon: Zap },
  notifications: { label: 'Volume Geral', icon: Bell },
  announcements: { label: 'Avisos Agendados', icon: Megaphone },
  push: { label: 'Push', icon: Smartphone },
  users: { label: 'Usuários', icon: Users },
  roles: { label: 'Funções', icon: Shield },
  invitations: { label: 'Convites', icon: Mail },
  integrations: { label: 'Integrações', icon: Plug },
  webhooks: { label: 'Delivery Pay', icon: Truck },
  'delivery-logistics': { label: 'Logística Delivery', icon: Truck },
  'ai-assistant': { label: 'IA Assistente', icon: Bot },
};

interface SettingsSidebarProps {
  activeSection: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
}

const sections = [
  {
    group: 'Lojas',
    items: [
      { id: 'stores' as const, label: 'Minhas Lojas', icon: Building2 },
    ],
  },
  {
    group: 'Sistema',
    items: [
      { id: 'tables' as const, label: 'Mesas', icon: UtensilsCrossed },
      { id: 'kds' as const, label: 'KDS', icon: ChefHat },
      { id: 'kds-stations' as const, label: 'Praças', icon: Factory },
      { id: 'kds-devices' as const, label: 'Dispositivos', icon: Smartphone },
      { id: 'orders' as const, label: 'Pedidos', icon: ShoppingCart },
      { id: 'printers' as const, label: 'Impressoras', icon: Printer },
      { id: 'cash-register' as const, label: 'Caixa', icon: Wallet },
      { id: 'production-targets' as const, label: 'Metas de Produção', icon: Target },
      { id: 'production-api' as const, label: 'API de Produção', icon: Server },
      { id: 'automation' as const, label: 'Integrações Auto', icon: Zap },
    ],
  },
  {
    group: 'Notificações',
    items: [
      { id: 'notifications' as const, label: 'Volume Geral', icon: Bell },
      { id: 'announcements' as const, label: 'Avisos Agendados', icon: Megaphone },
      { id: 'push' as const, label: 'Push', icon: Smartphone },
    ],
  },
  {
    group: 'Equipe',
    items: [
      { id: 'users' as const, label: 'Usuários', icon: Users },
      { id: 'roles' as const, label: 'Funções', icon: Shield },
      { id: 'invitations' as const, label: 'Convites', icon: Mail },
    ],
  },
  {
    group: 'Integrações',
    items: [
      { id: 'integrations' as const, label: 'CardápioWeb', icon: Plug },
      { id: 'webhooks' as const, label: 'Delivery Pay', icon: Truck },
      { id: 'delivery-logistics' as const, label: 'Logística Delivery', icon: Truck },
    ],
  },
  {
    group: 'IA',
    items: [
      { id: 'ai-assistant' as const, label: 'IA Assistente', icon: Bot },
    ],
  },
];

// Highlight matching text
const highlightMatch = (text: string, query: string) => {
  if (!query) return text;
  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  return parts.map((part, i) => 
    regex.test(part) ? <mark key={i} className="bg-primary/20 rounded px-0.5">{part}</mark> : part
  );
};

export function SettingsSidebar({ activeSection, onSectionChange }: SettingsSidebarProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter sections based on search
  const filteredSections = sections.map(section => ({
    ...section,
    items: section.items.filter(item => 
      item.label.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(section => section.items.length > 0);

  return (
    <nav className="w-56 flex-shrink-0 space-y-4">
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9 pr-9 h-9"
        />
        {searchQuery && (
          <button 
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* No results */}
      {filteredSections.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Nenhuma configuração encontrada</p>
          <button 
            onClick={() => setSearchQuery('')}
            className="text-xs text-primary hover:underline mt-1"
          >
            Limpar busca
          </button>
        </div>
      )}

      {/* Sections */}
      <div className="space-y-6">
      {filteredSections.map((section) => (
        <div key={section.group}>
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 px-3">
            {section.group}
          </h3>
          <ul className="space-y-1">
            {section.items.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => onSectionChange(item.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-colors',
                    activeSection === item.id
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <item.icon className="h-4 w-4 flex-shrink-0" />
                  <span>{highlightMatch(item.label, searchQuery)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}
      </div>
    </nav>
  );
}
