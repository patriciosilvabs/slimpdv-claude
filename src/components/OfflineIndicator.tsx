import { Wifi, WifiOff, RefreshCw, AlertCircle, CheckCircle2, Download } from "lucide-react";
import { Link } from "react-router-dom";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { SyncProgressDialog } from "./SyncProgressDialog";
import { useOfflineSyncContext } from "@/contexts/OfflineSyncContext";
import { useInstallPWA } from "@/hooks/useInstallPWA";

export function OfflineIndicator() {
  const { 
    isOnline, 
    isSyncing, 
    pendingOperations, 
    triggerSync,
    clearQueue 
  } = useOfflineSyncContext();
  const { canInstall, isInstalled, isStandalone } = useInstallPWA();
  const [dialogOpen, setDialogOpen] = useState(false);
  
  const showInstallLink = canInstall && !isInstalled && !isStandalone;

  const getStatusConfig = () => {
    if (!isOnline) {
      return {
        icon: WifiOff,
        label: "Offline",
        description: "Sem conexão com a internet. Operações serão salvas localmente.",
        variant: "destructive" as const,
        iconClass: "text-destructive"
      };
    }
    
    if (isSyncing) {
      return {
        icon: RefreshCw,
        label: "Sincronizando...",
        description: "Enviando operações pendentes para o servidor.",
        variant: "secondary" as const,
        iconClass: "text-primary animate-spin"
      };
    }
    
    if (pendingOperations.length > 0) {
      return {
        icon: AlertCircle,
        label: "Pendente",
        description: `${pendingOperations.length} operação(ões) aguardando sincronização.`,
        variant: "secondary" as const,
        iconClass: "text-yellow-500"
      };
    }
    
    return {
      icon: CheckCircle2,
      label: "Online",
      description: "Conectado e sincronizado.",
      variant: "outline" as const,
      iconClass: "text-green-500"
    };
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <>
      <div className="flex items-center gap-1">
        {showInstallLink && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2 h-9"
                  asChild
                >
                  <Link to="/install">
                    <Download className="h-4 w-4 text-primary" />
                    <span className="hidden sm:inline text-xs">Instalar</span>
                  </Link>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Instalar app para acesso offline</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
        
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="gap-2 h-9"
                onClick={() => pendingOperations.length > 0 && setDialogOpen(true)}
              >
                <Icon className={`h-4 w-4 ${config.iconClass}`} />
                <span className="hidden sm:inline text-xs">{config.label}</span>
                {pendingOperations.length > 0 && (
                  <Badge variant={config.variant} className="h-5 px-1.5 text-xs">
                    {pendingOperations.length}
                  </Badge>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{config.description}</p>
              {pendingOperations.length > 0 && isOnline && !isSyncing && (
                <p className="text-xs text-muted-foreground mt-1">
                  Clique para ver detalhes
                </p>
              )}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <SyncProgressDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        pendingOperations={pendingOperations}
        isSyncing={isSyncing}
        onSync={triggerSync}
        onClear={clearQueue}
      />
    </>
  );
}
