/**
 * PwaInstallBanner
 *
 * Shows two actions in the app header area:
 *  1. "Instalar App" — prompts the browser's PWA install dialog
 *  2. "Ativar Notificações Push" — subscribes to Web Push (shows when VAPID is configured)
 *
 * Both are dismissed once the action is taken and remembered in localStorage.
 */
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Bell, BellOff, X, Loader2 } from 'lucide-react';
import { usePushSubscription } from '@/hooks/usePushSubscription';

const INSTALL_DISMISSED_KEY = 'pdv_install_banner_dismissed';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PwaInstallBanner() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [installDismissed, setInstallDismissed] = useState(
    () => localStorage.getItem(INSTALL_DISMISSED_KEY) === 'true'
  );

  const push = usePushSubscription();
  const hasToken = !!localStorage.getItem('auth_token');

  // Capture install prompt event
  useEffect(() => {
    // Already installed as PWA
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setInstallPrompt(null);
    }
  };

  const dismissInstall = () => {
    localStorage.setItem(INSTALL_DISMISSED_KEY, 'true');
    setInstallDismissed(true);
  };

  // Don't render if not authenticated or if no actions are available
  if (!hasToken) return null;
  const showInstall = !isInstalled && !installDismissed && !!installPrompt;
  const showPush = push.supported && push.vapidAvailable && !push.subscribed;
  if (!showInstall && !showPush) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Install App button */}
      {showInstall && (
        <div className="flex items-center gap-1 bg-primary/10 border border-primary/20 rounded-lg px-3 py-1.5">
          <Download className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium text-primary">Instalar App</span>
          <Button
            size="sm"
            variant="default"
            className="h-6 px-2 text-xs ml-1"
            onClick={handleInstall}
          >
            Instalar
          </Button>
          <button
            onClick={dismissInstall}
            className="ml-1 text-muted-foreground hover:text-foreground"
            title="Fechar"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Push notification toggle */}
      {showPush && (
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1.5 text-xs"
          onClick={push.subscribe}
          disabled={push.loading}
          title="Receber notificações mesmo com o app fechado"
        >
          {push.loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Bell className="h-3.5 w-3.5 text-amber-500" />
          )}
          Ativar Push
        </Button>
      )}

      {/* Subscribed indicator — with unsubscribe option */}
      {push.supported && push.vapidAvailable && push.subscribed && (
        <button
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          onClick={push.unsubscribe}
          title="Desativar notificações push"
          disabled={push.loading}
        >
          {push.loading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Bell className="h-3 w-3 text-green-500" />
          )}
          Push ativo
        </button>
      )}
    </div>
  );
}
