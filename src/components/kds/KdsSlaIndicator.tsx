import { useMemo } from 'react';
import { useKdsSettings } from '@/hooks/useKdsSettings';
import { differenceInMinutes } from 'date-fns';
import { cn } from '@/lib/utils';

interface SlaIndicatorProps {
  createdAt: string;
  size?: 'sm' | 'md' | 'lg';
  showTime?: boolean;
  showBackground?: boolean;
}

export function KdsSlaIndicator({ createdAt, size = 'md', showTime = true, showBackground = false }: SlaIndicatorProps) {
  const { getSlaColor } = useKdsSettings();

  const { minutesElapsed, color, bgClass, textClass, bgContainerClass } = useMemo(() => {
    const minutes = differenceInMinutes(new Date(), new Date(createdAt));
    const slaColor = getSlaColor(minutes);

    const colorMap = {
      green: {
        bg: 'bg-green-500',
        text: 'text-green-600',
        ring: 'ring-green-500/30',
        container: 'bg-green-500/10',
      },
      yellow: {
        bg: 'bg-yellow-500',
        text: 'text-yellow-600',
        ring: 'ring-yellow-500/30',
        container: 'bg-yellow-500/10',
      },
      red: {
        bg: 'bg-red-500 animate-pulse',
        text: 'text-red-600',
        ring: 'ring-red-500/30',
        container: 'bg-red-500/10',
      },
    };

    return {
      minutesElapsed: minutes,
      color: slaColor,
      bgClass: colorMap[slaColor].bg,
      textClass: colorMap[slaColor].text,
      ringClass: colorMap[slaColor].ring,
      bgContainerClass: colorMap[slaColor].container,
    };
  }, [createdAt, getSlaColor]);

  const sizeClasses = {
    sm: 'h-2 w-2',
    md: 'h-3 w-3',
    lg: 'h-4 w-4',
  };

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base font-medium',
  };

  const content = (
    <div className="flex items-center gap-1.5">
      <span className={`rounded-full ${bgClass} ${sizeClasses[size]}`} />
      {showTime && (
        <span className={`${textSizeClasses[size]} ${textClass} tabular-nums`}>
          {minutesElapsed}min
        </span>
      )}
    </div>
  );

  if (showBackground) {
    return (
      <div className={cn("flex items-center gap-1.5 px-2 py-1 rounded-full", bgContainerClass)}>
        {content}
      </div>
    );
  }

  return content;
}

export function useSlaColor(createdAt: string): 'green' | 'yellow' | 'red' {
  const { getSlaColor } = useKdsSettings();
  return useMemo(() => {
    const minutes = differenceInMinutes(new Date(), new Date(createdAt));
    return getSlaColor(minutes);
  }, [createdAt, getSlaColor]);
}
