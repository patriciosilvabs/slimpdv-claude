interface KdsItemCounterProps {
  currentIndex: number;
  totalItems: number;
  label?: string;
}

export function KdsItemCounter({ currentIndex, totalItems, label = 'Item' }: KdsItemCounterProps) {
  if (totalItems <= 1) return null;

  return (
    <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-muted rounded-full text-xs font-medium text-muted-foreground">
      <span>{label}</span>
      <span className="text-foreground">{currentIndex}</span>
      <span>de</span>
      <span className="text-foreground">{totalItems}</span>
    </div>
  );
}
