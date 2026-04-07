import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface StoreCategoriesProps {
  categories: Array<{ id: string; name: string; icon: string | null }>;
  selected: string | null;
  onSelect: (id: string | null) => void;
}

export function StoreCategories({ categories, selected, onSelect }: StoreCategoriesProps) {
  if (categories.length === 0) return null;

  return (
    <div className="sticky top-[58px] z-20 bg-card/95 backdrop-blur-md border-b border-border">
      <div className="max-w-4xl mx-auto">
        <ScrollArea className="w-full">
          <div className="flex gap-1 px-4 py-2">
            <button
              onClick={() => onSelect(null)}
              className={cn(
                "flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap",
                !selected
                  ? "bg-amber-500 text-white shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              Todos
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => onSelect(cat.id)}
                className={cn(
                  "flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap",
                  selected === cat.id
                    ? "bg-amber-500 text-white shadow-sm"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                {cat.icon && <span className="mr-1.5">{cat.icon}</span>}
                {cat.name}
              </button>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>
    </div>
  );
}
