import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { APP_VERSION } from '@/lib/appVersion';

export function AppFooter() {
  const [realtimeStatus, setRealtimeStatus] = useState<'connected' | 'disconnected'>('disconnected');

  useEffect(() => {
    const channel = supabase.channel('footer-health-check');
    
    channel
      .on('presence', { event: 'sync' }, () => {
        setRealtimeStatus('connected');
      })
      .subscribe((status) => {
        setRealtimeStatus(status === 'SUBSCRIBED' ? 'connected' : 'disconnected');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const isProduction = window.location.hostname.includes('lovable.app');

  return (
    <footer className="fixed bottom-0 left-0 w-full bg-sidebar border-t border-sidebar-border text-sidebar-foreground/50 text-[10px] px-4 py-0.5 flex justify-between items-center z-50">
      <div className="flex gap-4 items-center">
        <span><strong>Versão:</strong> {APP_VERSION}</span>
        <span>{isProduction ? 'Produção' : 'Dev'}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <div className={`h-1.5 w-1.5 rounded-full ${realtimeStatus === 'connected' ? 'bg-emerald-500' : 'bg-destructive animate-pulse'}`} />
          <span>{realtimeStatus === 'connected' ? 'Realtime OK' : 'Realtime OFF'}</span>
        </div>
      </div>
    </footer>
  );
}
