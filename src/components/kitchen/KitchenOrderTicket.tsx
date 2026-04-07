import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { usePrinterOptional } from '@/contexts/PrinterContext';
import { KitchenTicketData } from '@/utils/escpos';
import { escapeHtml } from '@/lib/htmlEscape';
import { supabase } from '@/integrations/supabase/client';

// Sub-item types for per-unit complements
interface SubItemExtra {
  group_name: string;
  option_name: string;
  price: number;
  quantity: number;
}

interface SubItem {
  sub_item_index: number;
  notes: string | null;
  extras: SubItemExtra[];
}

interface OrderItem {
  id: string;
  quantity: number;
  notes?: string | null;
  product?: { name: string };
  variation?: { name: string } | null;
  extras?: { extra_name: string; price: number }[];
  added_by_profile?: { name: string } | null;
  sub_items?: SubItem[];
  fulfillment_type?: string | null;
}

interface KitchenOrderProps {
  orderNumber: string;
  orderType: 'dine_in' | 'takeaway' | 'delivery';
  tableNumber?: number;
  customerName?: string | null;
  pagerNumber?: string | null;
  items: OrderItem[];
  notes?: string | null;
  createdAt: string;
}

// Fetch sub-items for order items
async function fetchSubItemsForItems(items: OrderItem[]): Promise<OrderItem[]> {
  const itemIds = items.map(i => i.id);
  if (itemIds.length === 0) return items;

  // Fetch sub-items
  const { data: subItemsData } = await supabase
    .from('order_item_sub_items')
    .select('id, order_item_id, sub_item_index, notes')
    .in('order_item_id', itemIds);

  if (!subItemsData || subItemsData.length === 0) return items;

  const subItemIds = subItemsData.map(si => si.id);

  // Fetch extras for sub-items
  const { data: extrasData } = await supabase
    .from('order_item_sub_item_extras')
    .select('sub_item_id, group_name, option_name, price, quantity')
    .in('sub_item_id', subItemIds);

  // Build sub-items with extras
  const subItemsMap = new Map<string, SubItem[]>();
  for (const si of subItemsData) {
    const extras = (extrasData || [])
      .filter(e => e.sub_item_id === si.id)
      .map(e => ({
        group_name: e.group_name,
        option_name: e.option_name,
        price: e.price,
        quantity: e.quantity,
      }));

    const existing = subItemsMap.get(si.order_item_id) || [];
    existing.push({
      sub_item_index: si.sub_item_index,
      notes: si.notes,
      extras,
    });
    subItemsMap.set(si.order_item_id, existing);
  }

  // Merge into items
  return items.map(item => ({
    ...item,
    sub_items: subItemsMap.get(item.id)?.sort((a, b) => a.sub_item_index - b.sub_item_index),
  }));
}

// Fallback to browser print
function printWithBrowser(props: KitchenOrderProps) {
  const { orderNumber, orderType, tableNumber, customerName, pagerNumber, items, notes, createdAt } = props;
  
  const orderTypeLabels = {
    dine_in: tableNumber ? `MESA ${tableNumber}` : 'MESA',
    takeaway: 'BALCÃO',
    delivery: 'DELIVERY',
  };

  const printWindow = window.open('', '_blank', 'width=300,height=600');
  if (!printWindow) return;

  const itemsHtml = items.map(item => {
    // Check if item has sub-items (per-unit complements like individual pizzas)
    if (item.sub_items && item.sub_items.length > 0) {
      const totalSubItems = item.sub_items.length;
      const fractionPrefix = totalSubItems > 1 ? `1/${totalSubItems} ` : '';
      const subItemsHtml = item.sub_items.map((si, idx) => {
        const extrasHtml = si.extras.map(e => 
          `<div style="font-size: 12px; color: #333; padding-left: 16px;">• ${fractionPrefix}${e.quantity > 1 ? `${e.quantity}x ` : ''}${escapeHtml(e.option_name)}</div>`
        ).join('');
        
        return `
          <div style="margin-left: 8px; padding: 4px 0; border-left: 2px solid #666; padding-left: 8px; margin-bottom: 4px;">
            <div style="font-weight: bold; font-size: 12px; color: #333;">🍕 PIZZA ${si.sub_item_index}:</div>
            ${extrasHtml}
            ${si.notes ? `<div style="font-size: 11px; color: #c00; margin-top: 2px;">OBS: ${escapeHtml(si.notes)}</div>` : ''}
          </div>
        `;
      }).join('');

      return `
        <div style="margin-bottom: 12px; border-bottom: 1px dashed #999; padding-bottom: 8px;">
          ${item.fulfillment_type === 'takeaway' ? '<div style="background: #f97316; color: white; font-weight: bold; font-size: 12px; text-align: center; padding: 2px 6px; margin-bottom: 4px; border-radius: 4px;">🥡 PARA VIAGEM</div>' : ''}
          <div style="font-weight: bold; font-size: 14px;">
            ${item.quantity}x ${escapeHtml(item.product?.name) || 'Produto'}
          </div>
          ${item.variation ? `<div style="font-size: 12px; color: #666;">▸ ${escapeHtml(item.variation.name)}</div>` : ''}
          ${item.extras && item.extras.length > 0 ? item.extras.map(e => `
            <div style="font-size: 12px; color: #666; padding-left: 8px;">
              • ${escapeHtml(e.extra_name.split(': ').slice(1).join(': ') || e.extra_name)}
            </div>
          `).join('') : ''}
          ${subItemsHtml}
          ${item.notes ? `<div style="font-size: 11px; color: #c00; margin-top: 4px;">OBS GERAL: ${escapeHtml(item.notes)}</div>` : ''}
          ${item.added_by_profile?.name ? `<div style="font-size: 10px; color: #0066cc; margin-top: 2px;">[${escapeHtml(item.added_by_profile.name)}]</div>` : ''}
        </div>
      `;
    }

    // Standard item without sub-items
    return `
      <div style="margin-bottom: 8px; border-bottom: 1px dashed #999; padding-bottom: 8px;">
        ${item.fulfillment_type === 'takeaway' ? '<div style="background: #f97316; color: white; font-weight: bold; font-size: 12px; text-align: center; padding: 2px 6px; margin-bottom: 4px; border-radius: 4px;">🥡 PARA VIAGEM</div>' : ''}
        <div style="font-weight: bold; font-size: 14px;">
          ${item.quantity}x ${escapeHtml(item.product?.name) || 'Produto'}
        </div>
        ${item.variation ? `<div style="font-size: 12px; color: #666;">▸ ${escapeHtml(item.variation.name)}</div>` : ''}
        ${item.extras && item.extras.length > 0 ? item.extras.map(e => `
          <div style="font-size: 12px; color: #666; padding-left: 8px;">
            • ${escapeHtml(e.extra_name.split(': ').slice(1).join(': ') || e.extra_name)}
          </div>
        `).join('') : ''}
        ${item.notes ? `<div style="font-size: 11px; color: #c00; margin-top: 4px;">OBS: ${escapeHtml(item.notes)}</div>` : ''}
        ${item.added_by_profile?.name ? `<div style="font-size: 10px; color: #0066cc; margin-top: 2px;">[${escapeHtml(item.added_by_profile.name)}]</div>` : ''}
      </div>
    `;
  }).join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Comanda</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: 'Courier New', monospace; 
          width: 80mm; 
          padding: 8px;
          font-size: 12px;
        }
        .header { 
          text-align: center; 
          border-bottom: 2px solid #000; 
          padding-bottom: 8px; 
          margin-bottom: 8px;
        }
        .order-type { 
          font-size: 20px; 
          font-weight: bold; 
          margin-bottom: 4px;
        }
        .order-number { 
          font-size: 16px; 
          font-weight: bold;
        }
        .meta { 
          display: flex; 
          justify-content: space-between; 
          margin-bottom: 8px;
          padding-bottom: 8px;
          border-bottom: 1px dashed #999;
        }
        .items { margin-bottom: 8px; }
        .notes { 
          border: 1px solid #c00; 
          padding: 8px; 
          margin-top: 8px;
          background: #fff0f0;
        }
        .notes-title { font-weight: bold; color: #c00; }
        .footer { 
          text-align: center; 
          margin-top: 16px; 
          padding-top: 8px; 
          border-top: 2px solid #000;
          font-size: 10px;
        }
        @media print {
          body { width: 100%; }
          @page { margin: 0; size: 80mm auto; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="order-type">${orderTypeLabels[orderType]}</div>
        <div class="order-number">Pedido #${orderNumber.slice(-6).toUpperCase()}</div>
        ${pagerNumber ? `<div style="background: #f59e0b; color: white; font-size: 24px; font-weight: bold; padding: 8px; margin-top: 8px; border-radius: 8px; text-align: center;">📟 PAGER #${escapeHtml(pagerNumber)}</div>` : ''}
      </div>
      
      <div class="meta">
        <span>${format(new Date(createdAt), "dd/MM HH:mm", { locale: ptBR })}</span>
        ${customerName ? `<span>${escapeHtml(customerName)}</span>` : ''}
      </div>
      
      <div class="items">
        ${itemsHtml}
      </div>
      
      ${notes ? `
        <div class="notes">
          <div class="notes-title">OBSERVAÇÕES GERAIS:</div>
          <div>${escapeHtml(notes)}</div>
        </div>
      ` : ''}
      
      <div class="footer">
        Impresso em ${format(new Date(), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
      </div>
      
      <script>
        window.onload = function() {
          window.print();
          setTimeout(function() { window.close(); }, 500);
        }
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
}

// Convert props to ESC/POS data format
function propsToTicketData(props: KitchenOrderProps): KitchenTicketData {
  return {
    orderNumber: props.orderNumber,
    orderType: props.orderType,
    tableNumber: props.tableNumber,
    customerName: props.customerName,
    pagerNumber: props.pagerNumber,
    items: props.items.map(item => {
      // Build extras array including sub-items
      let extras = item.extras?.map(e => e.extra_name.split(': ').slice(1).join(': ') || e.extra_name) || [];
      
      // Add sub-items as formatted extras
      if (item.sub_items && item.sub_items.length > 0) {
        const totalSubItems = item.sub_items.length;
        const fractionPrefix = totalSubItems > 1 ? `1/${totalSubItems} ` : '';
        for (const si of item.sub_items) {
          extras.push(`🍕 PIZZA ${si.sub_item_index}:`);
          for (const e of si.extras) {
            extras.push(`  ${fractionPrefix}${e.quantity > 1 ? `${e.quantity}x ` : ''}${e.option_name}`);
          }
          if (si.notes) {
            extras.push(`  OBS: ${si.notes}`);
          }
        }
      }
      
      return {
        quantity: item.quantity,
        productName: item.product?.name || 'Produto',
        variation: item.variation?.name,
        extras: extras.length > 0 ? extras : undefined,
        notes: item.notes,
        addedBy: item.added_by_profile?.name,
        fulfillment_type: item.fulfillment_type,
      };
    }),
    notes: props.notes,
    createdAt: props.createdAt,
  };
}

export async function printKitchenOrderTicket(
  props: KitchenOrderProps, 
  printer?: ReturnType<typeof usePrinterOptional>
) {
  // Fetch sub-items for items if they have IDs
  let itemsWithSubItems = props.items;
  const hasItemIds = props.items.some(i => i.id);
  if (hasItemIds) {
    try {
      itemsWithSubItems = await fetchSubItemsForItems(props.items);
    } catch (err) {
      console.error('Failed to fetch sub-items:', err);
    }
  }
  
  const propsWithSubItems = { ...props, items: itemsWithSubItems };
  
  // Try QZ Tray first
  if (printer?.canPrintToKitchen) {
    try {
      const ticketData = propsToTicketData(propsWithSubItems);
      const success = await printer.printKitchenTicket(ticketData);
      if (success) return;
    } catch (err) {
      console.error('QZ Tray print failed, falling back to browser:', err);
    }
  }
  
  // Fallback to browser print
  printWithBrowser(propsWithSubItems);
}

export function KitchenOrderTicketButton({ 
  orderNumber, 
  orderType, 
  tableNumber, 
  customerName, 
  items, 
  notes, 
  createdAt,
  className
}: KitchenOrderProps & { className?: string }) {
  const printer = usePrinterOptional();
  
  const handlePrint = async () => {
    await printKitchenOrderTicket({ orderNumber, orderType, tableNumber, customerName, items, notes, createdAt }, printer);
  };

  return (
    <button 
      onClick={handlePrint}
      className={className}
      title="Imprimir Comanda"
    >
      🖨️
    </button>
  );
}
