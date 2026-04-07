import { Badge } from '@/components/ui/badge';

interface Extra {
  extra_name: string;
  price: number;
  kds_category?: string;
}

interface SubItemExtra {
  option_name: string;
  group_name: string;
}

interface SubItem {
  id: string;
  sub_item_index: number;
  extras?: SubItemExtra[];
}

interface OrderItemDetailsProps {
  extras?: Extra[];
  subItems?: SubItem[];
  notes?: string;
  children?: React.ReactNode;
}

const FLAVOR_REGEX = /^\d+\/\d+\s/;

export function OrderItemDetails({ extras, subItems, notes, children }: OrderItemDetailsProps) {
  const isFlavor = (e: Extra) => e.kds_category === 'flavor' || FLAVOR_REGEX.test(e.extra_name);
  const flavorExtras = extras?.filter(isFlavor) || [];
  const normalExtras = extras?.filter(e => !isFlavor(e)) || [];

  const stripGroupPrefix = (name: string) => {
    const parts = name.split(': ');
    return parts.length > 1 ? parts.slice(1).join(': ') : name;
  };

  return (
    <>
      {/* Pizza flavors from integration extras */}
      {flavorExtras.length > 0 && (
        <>
          <Badge variant="outline" className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 border-emerald-500/30 mt-1 inline-block">
            {flavorExtras.length === 1 ? '1 SABOR' : `${flavorExtras.length} SABORES`}
          </Badge>
          <div className="mt-1 border-l-2 border-muted pl-2 space-y-0.5">
            {flavorExtras.map((e, i) => {
              const name = stripGroupPrefix(e.extra_name);
              const fraction = flavorExtras.length > 1 && !FLAVOR_REGEX.test(e.extra_name)
                ? `${i + 1}/${flavorExtras.length} `
                : '';
              return (
                <p key={i} className="text-sm text-muted-foreground">
                  <span className="font-medium">🍕 {fraction}{name}</span>
                </p>
              );
            })}
          </div>
        </>
      )}

      {/* Sub-items from table/store orders */}
      {subItems && subItems.length > 0 && (
        <>
          <Badge variant="outline" className="text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 border-emerald-500/30 mt-1 inline-block">
            {subItems.length === 1 ? '1 SABOR' : `${subItems.length} SABORES`}
          </Badge>
          <div className="mt-1 border-l-2 border-muted pl-2 space-y-0.5">
            {subItems.map((sub, i) => (
              <div key={sub.id || i} className="text-sm text-muted-foreground">
                {subItems.length > 1 && (
                  <span className="font-medium">🍕 {`${i + 1}/${subItems.length}`} </span>
                )}
                {sub.extras?.map((ext, j) => (
                  <span key={j}>
                    {ext.option_name}
                    {j < (sub.extras?.length ?? 0) - 1 ? ', ' : ''}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Normal complements */}
      {normalExtras.length > 0 && (
        <div className="mt-1 space-y-0.5">
          {normalExtras.map((e, i) => (
            <p key={i} className="text-sm text-muted-foreground">
              + {e.extra_name} (R$ {e.price.toFixed(2)})
            </p>
          ))}
        </div>
      )}

      {/* Notes */}
      {notes && (
        <p className="text-xs italic text-muted-foreground mt-0.5">
          Obs: {notes}
        </p>
      )}

      {children}
    </>
  );
}
