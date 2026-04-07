import { forwardRef } from 'react';
import { Order } from '@/hooks/useOrders';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { usePrinterOptional } from '@/contexts/PrinterContext';
import { KitchenTicketData } from '@/utils/escpos';
import { escapeHtml } from '@/lib/htmlEscape';

interface KitchenReceiptProps {
  order: Order;
  paperWidth?: '58mm' | '80mm';
}

const KitchenReceipt = forwardRef<HTMLDivElement, KitchenReceiptProps>(
  ({ order, paperWidth = '80mm' }, ref) => {
    const width = paperWidth === '58mm' ? '48mm' : '72mm';

    return (
      <div 
        ref={ref} 
        className="kitchen-receipt"
        style={{ 
          width,
          fontFamily: 'monospace',
          fontSize: '12px',
          backgroundColor: 'white',
          color: 'black',
          padding: '4mm',
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', borderBottom: '1px dashed black', paddingBottom: '2mm', marginBottom: '2mm' }}>
          <div style={{ fontSize: '16px', fontWeight: 'bold' }}>COZINHA</div>
          <div style={{ fontSize: '20px', fontWeight: 'bold', margin: '2mm 0' }}>
            {order.table?.number ? `MESA ${order.table.number}` : 
             order.order_type === 'takeaway' ? 'RETIRADA' : 'DELIVERY'}
          </div>
          {order.customer_name && (
            <div style={{ fontSize: '14px' }}>{order.customer_name}</div>
          )}
        </div>

        {/* Order Info */}
        <div style={{ borderBottom: '1px dashed black', paddingBottom: '2mm', marginBottom: '2mm' }}>
          <div>Pedido: #{order.id.slice(0, 8).toUpperCase()}</div>
          <div>Data: {format(new Date(order.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</div>
        </div>

        {/* Items */}
        <div style={{ marginBottom: '2mm' }}>
            <div style={{ fontWeight: 'bold', borderBottom: '1px solid black', paddingBottom: '1mm', marginBottom: '2mm' }}>
              ITENS DO PEDIDO
            </div>
            {order.order_items?.map((item, index) => (
              <div key={item.id} style={{ marginBottom: '3mm' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 'bold', fontSize: '14px' }}>
                    {item.quantity}x
                  </span>
                  <span style={{ flex: 1, marginLeft: '2mm', fontSize: '14px', fontWeight: 'bold' }}>
                    {item.product?.name}
                  </span>
                </div>
                {item.variation && (
                  <div style={{ marginLeft: '5mm', fontSize: '11px', color: '#666' }}>
                    ▸ {item.variation.name}
                  </div>
                )}
                {item.extras && item.extras.length > 0 && item.extras.map((e, ei) => (
                  <div key={ei} style={{ marginLeft: '5mm', fontSize: '11px', color: '#333' }}>
                    • {e.extra_name.split(': ').slice(1).join(': ') || e.extra_name}
                  </div>
                ))}
                {item.sub_items && item.sub_items.length > 0 && item.sub_items.map((si) => (
                  <div key={si.id} style={{ marginLeft: '5mm', paddingLeft: '2mm', borderLeft: '2px solid #666', marginTop: '1mm', marginBottom: '1mm' }}>
                    <div style={{ fontWeight: 'bold', fontSize: '11px' }}>🍕 PIZZA {si.sub_item_index}:</div>
                    {si.sub_extras?.map((se, sei) => (
                      <div key={sei} style={{ fontSize: '11px', marginLeft: '3mm' }}>
                        • {se.quantity > 1 ? `${se.quantity}x ` : ''}{se.option_name}
                      </div>
                    ))}
                    {si.notes && (
                      <div style={{ fontSize: '10px', color: '#c00', marginTop: '1mm' }}>OBS: {si.notes}</div>
                    )}
                  </div>
                ))}
                {item.notes && (
                  <div style={{ 
                    marginLeft: '5mm', 
                    fontSize: '11px', 
                    fontStyle: 'italic',
                    backgroundColor: '#f0f0f0',
                    padding: '1mm 2mm',
                    marginTop: '1mm'
                  }}>
                    OBS: {item.notes}
                  </div>
                )}
                {item.added_by_profile?.name && (
                  <div style={{ 
                    marginLeft: '5mm', 
                    fontSize: '10px', 
                    color: '#0066cc',
                    marginTop: '1mm'
                  }}>
                    [{item.added_by_profile.name}]
                  </div>
                )}
                {index < (order.order_items?.length || 0) - 1 && (
                  <div style={{ borderBottom: '1px dotted #ccc', marginTop: '2mm' }} />
                )}
              </div>
            ))}
        </div>

        {/* Notes */}
        {order.notes && (
          <div style={{ borderTop: '1px dashed black', paddingTop: '2mm', marginTop: '2mm' }}>
            <div style={{ fontWeight: 'bold' }}>OBSERVAÇÕES GERAIS:</div>
            <div style={{ fontSize: '11px' }}>{order.notes}</div>
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', borderTop: '1px dashed black', paddingTop: '2mm', marginTop: '4mm' }}>
          <div style={{ fontSize: '10px' }}>
            Impresso em: {format(new Date(), "dd/MM/yyyy HH:mm:ss", { locale: ptBR })}
          </div>
        </div>
      </div>
    );
  }
);

KitchenReceipt.displayName = 'KitchenReceipt';

export default KitchenReceipt;

// Convert Order to ESC/POS KitchenTicketData
function orderToTicketData(order: Order): KitchenTicketData {
  const rawPayload = (order as any).external_raw_payload as any;
  return {
    orderNumber: order.id,
    orderType: order.order_type || 'dine_in',
    tableNumber: order.table?.number,
    customerName: order.customer_name,
    items: order.order_items?.map(item => {
      const flavorExts = (item.extras || []).filter((e: any) => e.kds_category === 'flavor');
      const otherExts = (item.extras || []).filter((e: any) => e.kds_category !== 'flavor');
      let extras = otherExts.map(e => e.extra_name.split(': ').slice(1).join(': ') || e.extra_name);
      if (flavorExts.length > 0) {
        const fraction = flavorExts.length > 1 ? `1/${flavorExts.length} ` : '';
        for (const e of flavorExts) {
          const name = e.extra_name.split(': ').slice(1).join(': ') || e.extra_name;
          extras.push(`🍕 ${fraction}${name}`);
        }
      }
      
      if (item.sub_items && item.sub_items.length > 0) {
        for (const si of item.sub_items) {
          extras.push(`🍕 PIZZA ${si.sub_item_index}:`);
          for (const e of si.sub_extras || []) {
            extras.push(`  ${e.quantity > 1 ? `${e.quantity}x ` : ''}${e.option_name}`);
          }
          if (si.notes) {
            extras.push(`  OBS: ${si.notes}`);
          }
        }
      }

      // Fallback: if no structured extras/sub_items, use raw payload
      if (extras.length === 0 && rawPayload?.items) {
        const itemName = item.product?.name ?? (item as any).product_name ?? '';
        const extItemId = (item as any).external_item_id;
        const rawItem = rawPayload.items.find((ri: any) => {
          if (extItemId && ri.order_item_id != null && String(ri.order_item_id) === extItemId) return true;
          return ri.name === itemName;
        });
        if (rawItem?.options?.length) {
          for (const opt of rawItem.options) {
            const name = (opt.name || '').replace(/\s*\([A-Z]+\)\s*$/, '').trim();
            if (name) extras.push(name);
          }
        }
      }
      
      return {
        quantity: item.quantity,
        productName: item.product?.name || (item as any).product_name || 'Produto',
        variation: item.variation?.name,
        extras: extras.length > 0 ? extras : undefined,
        notes: item.notes,
        addedBy: item.added_by_profile?.name,
      };
    }) || [],
    notes: order.notes,
    createdAt: order.created_at,
  };
}

// Fallback to browser print
function printWithBrowser(order: Order, paperWidth: '58mm' | '80mm' = '80mm') {
  const width = paperWidth === '58mm' ? '48mm' : '72mm';
  
  const printContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Comanda - ${order.table?.number ? `Mesa ${order.table.number}` : order.id.slice(0, 8)}</title>
      <style>
        @page {
          size: ${paperWidth} auto;
          margin: 0;
        }
        body {
          width: ${width};
          font-family: 'Courier New', monospace;
          font-size: 12px;
          margin: 0;
          padding: 4mm;
          background: white;
          color: black;
        }
        .header {
          text-align: center;
          border-bottom: 1px dashed black;
          padding-bottom: 2mm;
          margin-bottom: 2mm;
        }
        .title {
          font-size: 16px;
          font-weight: bold;
        }
        .table-number {
          font-size: 20px;
          font-weight: bold;
          margin: 2mm 0;
        }
        .info {
          border-bottom: 1px dashed black;
          padding-bottom: 2mm;
          margin-bottom: 2mm;
        }
        .items-header {
          font-weight: bold;
          border-bottom: 1px solid black;
          padding-bottom: 1mm;
          margin-bottom: 2mm;
        }
        .item {
          margin-bottom: 3mm;
        }
        .item-line {
          display: flex;
          justify-content: space-between;
        }
        .quantity {
          font-weight: bold;
          font-size: 14px;
        }
        .product-name {
          flex: 1;
          margin-left: 2mm;
          font-size: 14px;
          font-weight: bold;
        }
        .notes {
          margin-left: 5mm;
          font-size: 11px;
          font-style: italic;
          background-color: #f0f0f0;
          padding: 1mm 2mm;
          margin-top: 1mm;
        }
        .item-separator {
          border-bottom: 1px dotted #ccc;
          margin-top: 2mm;
        }
        .general-notes {
          border-top: 1px dashed black;
          padding-top: 2mm;
          margin-top: 2mm;
        }
        .footer {
          text-align: center;
          border-top: 1px dashed black;
          padding-top: 2mm;
          margin-top: 4mm;
          font-size: 10px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="title">COZINHA</div>
        <div class="table-number">
          ${order.table?.number ? `MESA ${order.table.number}` : 
            order.order_type === 'takeaway' ? 'RETIRADA' : 'DELIVERY'}
        </div>
        ${order.customer_name ? `<div style="font-size: 14px">${escapeHtml(order.customer_name)}</div>` : ''}
      </div>
      
      <div class="info">
        <div>Pedido: #${order.id.slice(0, 8).toUpperCase()}</div>
        <div>Data: ${new Date(order.created_at).toLocaleString('pt-BR')}</div>
      </div>
      
      <div>
        <div class="items-header">ITENS DO PEDIDO</div>
        ${order.order_items?.map((item, index) => {
          const variationHtml = item.variation ? `<div style="margin-left: 5mm; font-size: 11px; color: #666">▸ ${escapeHtml(item.variation.name)}</div>` : '';
          const extrasHtml = (item.extras || []).map(e => 
            `<div style="margin-left: 5mm; font-size: 11px; color: #333">• ${escapeHtml(e.extra_name.split(': ').slice(1).join(': ') || e.extra_name)}</div>`
          ).join('');
          const subItemsHtml = (item.sub_items || []).map(si => {
            const seHtml = (si.sub_extras || []).map(se => 
              `<div style="font-size: 11px; margin-left: 3mm">• ${se.quantity > 1 ? `${se.quantity}x ` : ''}${escapeHtml(se.option_name)}</div>`
            ).join('');
            return `
              <div style="margin-left: 5mm; padding-left: 2mm; border-left: 2px solid #666; margin: 1mm 0;">
                <div style="font-weight: bold; font-size: 11px">🍕 PIZZA ${si.sub_item_index}:</div>
                ${seHtml}
                ${si.notes ? `<div style="font-size: 10px; color: #c00; margin-top: 1mm">OBS: ${escapeHtml(si.notes)}</div>` : ''}
              </div>`;
          }).join('');
          return `
          <div class="item">
            <div class="item-line">
              <span class="quantity">${item.quantity}x</span>
              <span class="product-name">${escapeHtml(item.product?.name) || 'Item'}</span>
            </div>
            ${variationHtml}
            ${extrasHtml}
            ${subItemsHtml}
            ${item.notes ? `<div class="notes">OBS: ${escapeHtml(item.notes)}</div>` : ''}
            ${item.added_by_profile?.name ? `<div style="font-size: 10px; color: #0066cc; margin-left: 5mm; margin-top: 1mm">[${escapeHtml(item.added_by_profile.name)}]</div>` : ''}
            ${index < (order.order_items?.length || 0) - 1 ? '<div class="item-separator"></div>' : ''}
          </div>`;
        }).join('') || ''}
      </div>
      
      ${order.notes ? `
        <div class="general-notes">
          <div style="font-weight: bold">OBSERVAÇÕES GERAIS:</div>
          <div style="font-size: 11px">${escapeHtml(order.notes)}</div>
        </div>
      ` : ''}
      
      <div class="footer">
        Impresso em: ${new Date().toLocaleString('pt-BR')}
      </div>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank', 'width=400,height=600');
  if (printWindow) {
    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  }
}

// Print function with QZ Tray support
export async function printKitchenReceipt(
  order: Order, 
  paperWidth: '58mm' | '80mm' = '80mm',
  printer?: ReturnType<typeof usePrinterOptional>
) {
  // Try QZ Tray first
  if (printer?.canPrintToKitchen) {
    try {
      const ticketData = orderToTicketData(order);
      const success = await printer.printKitchenTicket(ticketData);
      if (success) return;
    } catch (err) {
      console.error('QZ Tray print failed, falling back to browser:', err);
    }
  }
  
  // Fallback to browser print
  printWithBrowser(order, paperWidth);
}
