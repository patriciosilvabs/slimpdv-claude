/**
 * PwaInstallBanner
 *
 * Shows two actions in the app header area:
 *  1. "Instalar App" — prompts the browser's PWA install dialog
 *  2. "Ativar Push"  — subscribes to Web Push (shows when VAPID is configured)
 *
 * The beforeinstallprompt event is captured early in index.html and stored in
 * window.__pwaInstallPrompt so it's never missed even if React mounts late.
 */
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Bell, Loader2, X } from 'lucide-react';
import { usePushSubscription } from '@/hooks/usePushSubscription';

declare global {
  interface Window {
    __pwaInstallPrompt: any;
  }
}

const INSTALL_DISMISSED_KEY = 'pdv_install_banner_dismissed';

export function PwaInstallBanner() {
  const [installPrompt, setInstallPrompt] = useState<any>(
    () => window.__pwaInstallPrompt ?? null
  );
  const [isInstalled, setIsInstalled] = useState(
    () => window.matchMedia('(display-mode: standalone)').matches
  );
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(INSTALL_DISMISSED_KEY) === 'true'
  );

  const push = usePushSubscription();
  const hasToken = !!localStorage.getItem('auth_token');

  useEffect(() => {
    // Pick up the prompt if it arrives after mount
    const onAvailable = () => setInstallPrompt(window.__pwaInstallPrompt);
    const onInstalled = () => { setIsInstalled(true); setInstallPrompt(null); };

    window.addEventListener('pwa-install-available', onAvailable);
    window.addEventListener('pwa-installed', onInstalled);
    window.addEventListener('beforeinstallprompt', onAvailable);
    window.addEventListener('appinstalled', onInstalled);

    // Also check if the prompt is already stored (captured before mount)
    if (window.__pwaInstallPrompt && !installPrompt) {
      setInstallPrompt(window.__pwaInstallPrompt);
    }

    return () => {
      window.removeEventListener('pwa-install-available', onAvailable);
      window.removeEventListener('pwa-installed', onInstalled);
      window.removeEventListener('beforeinstallprompt', onAvailable);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setInstallPrompt(null);
      window.__pwaInstallPrompt = null;
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(INSTALL_DISMISSED_KEY, 'true');
    setDismissed(true);
  };

  if (!hasToken) return null;

  const showInstall = !isInstalled && !dismissed && !!installPrompt;
  const showPush = push.supported && push.vapidAvailable && !push.subscribed;

  if (!showInstall && !showPush) return null;

  return (
    <div className="flex items-center gap-2">
      {/* Install App pill */}
      {showInstall && (
        <div className="flex items-center gap-1.5 bg-primary/10 border border-primary/20 rounded-lg px-2.5 py-1">
          <Download className="h-3.5 w-3.5 text-primary shrink-0" />
          <span className="text-xs font-medium text-primary hidden sm:inline">Instalar App</span>
          <Button
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={handleInstall}
          >
            Instalar
          </Button>
          <button
            onClick={handleDismiss}
            className="text-muted-foreground hover:text-foreground ml-0.5"
            title="Fechar"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Ativar Push button */}
      {showPush && (
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1.5 text-xs"
          onClick={push.subscribe}
          disabled={push.loading}
          title="Receber notificações mesmo com o app fechado"
        >
          {push.loading
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <Bell className="h-3.5 w-3.5 text-amber-500" />}
          <span className="hidden sm:inline">Ativar Push</span>
        </Button>
      )}

      {/* Push ativo — clica para desativar */}
      {push.supported && push.vapidAvailable && push.subscribed && (
        <button
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          onClick={push.unsubscribe}
          disabled={push.loading}
          title="Desativar notificações push"
        >
          {push.loading
            ? <Loader2 className="h-3 w-3 animate-spin" />
            : <Bell className="h-3 w-3 text-green-500" />}
          <span className="hidden sm:inline">Push ativo</span>
        </button>
      )}
    </div>
  );
}
