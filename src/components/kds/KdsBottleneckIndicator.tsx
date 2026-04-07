import { AlertTriangle, TrendingDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { BottleneckInfo } from '@/hooks/useKdsStationLogs';

interface KdsBottleneckIndicatorProps {
  bottlenecks: BottleneckInfo[];
  onOpenDashboard: () => void;
}

const getSeverityStyles = (severity: BottleneckInfo['severity']) => {
  switch (severity) {
    case 'critical':
      return {
        badge: 'bg-red-500 hover:bg-red-600 text-white',
        dot: 'bg-red-500',
        text: 'text-red-600',
      };
    case 'high':
      return {
        badge: 'bg-orange-500 hover:bg-orange-600 text-white',
        dot: 'bg-orange-500',
        text: 'text-orange-600',
      };
    case 'medium':
      return {
        badge: 'bg-yellow-500 hover:bg-yellow-600 text-white',
        dot: 'bg-yellow-500',
        text: 'text-yellow-600',
      };
    default:
      return {
        badge: 'bg-muted hover:bg-muted/80 text-muted-foreground',
        dot: 'bg-muted-foreground',
        text: 'text-muted-foreground',
      };
  }
};

export function KdsBottleneckIndicator({ bottlenecks, onOpenDashboard }: KdsBottleneckIndicatorProps) {
  if (!bottlenecks || bottlenecks.length === 0) return null;

  const criticalCount = bottlenecks.filter(b => b.severity === 'critical').length;
  const highCount = bottlenecks.filter(b => b.severity === 'high').length;
  const totalSignificant = criticalCount + highCount;

  // Determine the highest severity for styling
  const highestSeverity = criticalCount > 0 ? 'critical' : highCount > 0 ? 'high' : 'medium';
  const styles = getSeverityStyles(highestSeverity);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onClick={onOpenDashboard}
            className={cn(
              "gap-1.5 px-2 h-8",
              highestSeverity === 'critical' && "animate-pulse"
            )}
          >
            <Badge 
              className={cn(
                "gap-1 cursor-pointer transition-colors",
                styles.badge
              )}
            >
              <TrendingDown className="h-3.5 w-3.5" />
              {totalSignificant > 0 ? (
                <span>
                  {totalSignificant} gargalo{totalSignificant !== 1 ? 's' : ''}
                </span>
              ) : (
                <span>{bottlenecks.length} atenção</span>
              )}
            </Badge>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-2">
            <p className="font-medium flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4" />
              Praças com gargalo
            </p>
            <div className="space-y-1.5">
              {bottlenecks.slice(0, 5).map((bottleneck) => {
                const itemStyles = getSeverityStyles(bottleneck.severity);
                return (
                  <div 
                    key={bottleneck.stationId} 
                    className="flex items-center gap-2 text-sm"
                  >
                    <span 
                      className={cn("w-2 h-2 rounded-full", itemStyles.dot)} 
                    />
                    <span 
                      className="font-medium"
                      style={{ color: bottleneck.stationColor }}
                    >
                      {bottleneck.stationName}
                    </span>
                    <span className="text-muted-foreground text-xs">
                      {bottleneck.reason}
                    </span>
                  </div>
                );
              })}
              {bottlenecks.length > 5 && (
                <p className="text-xs text-muted-foreground">
                  +{bottlenecks.length - 5} mais...
                </p>
              )}
            </div>
            <p className="text-xs text-muted-foreground border-t pt-2 mt-2">
              Clique para ver detalhes
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}