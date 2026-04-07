import { Printer, PrinterCheck, Loader2 } from 'lucide-react';
import { usePrinterOptional } from '@/contexts/PrinterContext';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export function PrinterStatusIndicator() {
  const printer = usePrinterOptional();
  
  // Don't show if printer context not available
  if (!printer) return null;
  
  const { isConnected, connectionStatus, canPrintToKitchen, canPrintToCashier } = printer;
  
  const statusConfig = {
    connected: {
      Icon: PrinterCheck,
      bgClass: 'bg-green-500/20 text-green-600 dark:text-green-400',
      label: 'Impressora',
      tooltip: 'SlimPrint Conectado',
      animate: false,
    },
    connecting: {
      Icon: Loader2,
      bgClass: 'bg-blue-500/20 text-blue-600 dark:text-blue-400',
      label: 'Conectando...',
      tooltip: 'Conectando ao SlimPrint...',
      animate: true,
    },
    disconnected: {
      Icon: Printer,
      bgClass: 'bg-muted text-muted-foreground',
      label: 'Offline',
      tooltip: 'SlimPrint Desconectado',
      animate: false,
    },
  };
  
  const config = statusConfig[connectionStatus];
  const IconComponent = config.Icon;
  
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn(
            "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs cursor-default",
            config.bgClass
          )}>
            <IconComponent className={cn("h-3.5 w-3.5", config.animate && "animate-spin")} />
            <span className="hidden sm:inline">
              {config.label}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <div className="text-xs space-y-1">
            <p className="font-medium">{config.tooltip}</p>
            {isConnected && (
              <>
                <p>Cozinha: {canPrintToKitchen ? '✅ Configurada' : '❌ Não configurada'}</p>
                <p>Caixa: {canPrintToCashier ? '✅ Configurada' : '❌ Não configurada'}</p>
              </>
            )}
            {connectionStatus === 'disconnected' && (
              <p className="text-muted-foreground">
                Vá em Configurações → Impressoras
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
