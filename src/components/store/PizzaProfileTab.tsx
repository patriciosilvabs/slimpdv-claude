import { useState } from 'react';
import { User, MapPin, Bell, ChevronRight, Package } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';

export function PizzaProfileTab() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  return (
    <div className="flex flex-col">
      <div className="px-4 pt-6 pb-2 max-w-lg mx-auto w-full">
        <h2 className="text-2xl font-extrabold" style={{ color: 'hsl(var(--store-card-foreground))' }}>Perfil</h2>
      </div>

      <div className="px-4 py-4 max-w-lg mx-auto w-full space-y-4">
        {/* Avatar */}
        <div className="flex flex-col items-center py-6">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-[hsl(var(--store-primary))] to-[hsl(20,80%,40%)] flex items-center justify-center shadow-lg">
            <User className="h-10 w-10 text-white" />
          </div>
          <p className="mt-3 text-sm font-bold" style={{ color: 'hsl(var(--store-card-foreground))' }}>{name || 'Visitante'}</p>
          <span className="text-[10px] font-bold px-3 py-0.5 mt-1 rounded-full bg-amber-100 text-amber-700">Cliente</span>
        </div>

        {/* Form */}
        <div className="bg-white rounded-2xl border p-4 space-y-3" style={{ borderColor: 'hsl(var(--store-border))' }}>
          <label className="text-sm font-bold" style={{ color: 'hsl(var(--store-card-foreground))' }}>Dados pessoais</label>
          <Input placeholder="Nome" value={name} onChange={e => setName(e.target.value)} className="h-12 rounded-xl border bg-gray-50 text-sm" />
          <Input placeholder="E-mail" type="email" value={email} onChange={e => setEmail(e.target.value)} className="h-12 rounded-xl border bg-gray-50 text-sm" />
          <Input placeholder="WhatsApp" type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="h-12 rounded-xl border bg-gray-50 text-sm" />
        </div>

        {/* Menu Items */}
        {[
          { icon: MapPin, label: 'Endereços salvos', sub: 'Gerencie seus endereços' },
          { icon: Package, label: 'Meus pedidos', sub: 'Histórico de pedidos' },
        ].map(item => (
          <button key={item.label} className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white border text-left transition-all hover:shadow-sm" style={{ borderColor: 'hsl(var(--store-border))' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'hsl(var(--store-primary-light))' }}>
              <item.icon className="h-5 w-5 text-[hsl(var(--store-primary))]" />
            </div>
            <div className="flex-1">
              <span className="text-sm font-bold block" style={{ color: 'hsl(var(--store-card-foreground))' }}>{item.label}</span>
              <span className="text-xs" style={{ color: 'hsl(var(--store-muted))' }}>{item.sub}</span>
            </div>
            <ChevronRight className="h-4 w-4" style={{ color: 'hsl(var(--store-muted))' }} />
          </button>
        ))}

        {/* Notifications */}
        <div className="bg-white rounded-2xl border p-4 space-y-4" style={{ borderColor: 'hsl(var(--store-border))' }}>
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-[hsl(var(--store-primary))]" />
            <label className="text-sm font-bold" style={{ color: 'hsl(var(--store-card-foreground))' }}>Notificações</label>
          </div>
          {['Status em tempo real', 'Previsão de entrega', 'Cupons e promoções', 'Novidades'].map(item => (
            <div key={item} className="flex items-center justify-between">
              <span className="text-sm" style={{ color: 'hsl(var(--store-card-foreground))' }}>{item}</span>
              <Switch defaultChecked />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
