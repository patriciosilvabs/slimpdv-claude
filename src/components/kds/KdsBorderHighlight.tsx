import { useKdsSettings } from '@/hooks/useKdsSettings';
import { Circle, AlertTriangle } from 'lucide-react';

interface KdsBorderHighlightProps {
  text: string;
  className?: string;
}

export function KdsBorderHighlight({ text, className = '' }: KdsBorderHighlightProps) {
  const { hasSpecialBorder, settings } = useKdsSettings();

  if (!settings.highlightSpecialBorders || !hasSpecialBorder(text)) {
    return null;
  }

  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 bg-amber-500/20 border border-amber-500/50 rounded-md animate-pulse ${className}`}>
      <Circle className="h-3 w-3 fill-amber-500 text-amber-500" />
      <span className="text-xs font-bold text-amber-600 uppercase tracking-wide">
        Borda Especial
      </span>
      <AlertTriangle className="h-3 w-3 text-amber-500" />
    </div>
  );
}

// Versão inline para uso em listas
export function KdsBorderBadge({ text }: { text: string }) {
  const { hasSpecialBorder, settings } = useKdsSettings();

  if (!settings.highlightSpecialBorders || !hasSpecialBorder(text)) {
    return null;
  }

  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-500 text-amber-950 rounded text-[10px] font-bold uppercase animate-pulse">
      <Circle className="h-2 w-2 fill-current" />
      Borda
    </span>
  );
}
