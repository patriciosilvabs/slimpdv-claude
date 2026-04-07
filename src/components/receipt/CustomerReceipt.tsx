import { Order } from '@/hooks/useOrders';
import { Payment } from '@/hooks/useCashRegister';
import { usePrinterOptional } from '@/contexts/PrinterContext';
import { CustomerReceiptData } from '@/utils/escpos';
import { escapeHtml } from '@/lib/htmlEscape';
import { PaymentMethod } from '@/hooks/useCashRegister';

interface CustomerReceiptProps {
  order: Order;
  payments: Payment[];
  discount?: { type: 'percentage' | 'fixed'; value: number; amount: number };
  serviceCharge?: { enabled: boolean; percent: number; amount: number };
  splitBill?: { enabled: boolean; count: number; amountPerPerson: number };
  tableNumber?: number;
  restaurantName?: string;
  restaurantAddress?: string;
  restaurantPhone?: string;
  receiptType?: 'summary' | 'fiscal';
  logoUrl?: string;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatReceiptSubItemName(
  optionName: string | undefined,
  groupName: string | undefined,
  subItemIndex: number,
  totalSubItems: number,
) {
  if (!optionName) return '';

  const isFlavor = groupName?.toLowerCase().includes('sabor');
  if (!isFlavor) return optionName;

  return totalSubItems > 1
    ? `${subItemIndex}/${totalSubItems} ${optionName}`
    : `Sabor: ${optionName}`;
}

// Convert props to ESC/POS CustomerReceiptData
export function propsToReceiptData(props: CustomerReceiptProps): CustomerReceiptData {
  const { order, payments, discount, serviceCharge, splitBill, tableNumber, restaurantName, restaurantAddress, restaurantPhone, receiptType } = props;
  const subtotal = order.subtotal || 0;
  const total = order.total || 0;
  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const change = totalPaid - total;

  return {
    restaurantName: restaurantName || 'Restaurante',
    restaurantAddress,
    restaurantPhone,
    orderNumber: order.id,
    orderType: order.order_type || 'dine_in',
    tableNumber: tableNumber || order.table?.number,
    customerName: order.customer_name,
    items: order.order_items?.map(item => {
      const normalExtras = item.extras?.map(e => ({
        name: e.extra_name?.includes(': ') ? e.extra_name.split(': ').slice(1).join(': ') : (e.extra_name || ''),
        price: e.price || 0,
      })) || [];

      const totalSubItems = item.sub_items?.length || 0;
      const subItemExtras = item.sub_items?.flatMap(si =>
        si.sub_extras?.map(se => ({
          name: formatReceiptSubItemName(se.option_name, se.group_name, si.sub_item_index, totalSubItems),
          price: se.price || 0,
        })) || []
      ) || [];

      return {
        quantity: item.quantity,
        productName: item.product?.name || 'Item',
        variation: item.variation?.name,
        extras: [...normalExtras, ...subItemExtras].filter(e => e.name),
        notes: item.notes,
        totalPrice: item.total_price,
      };
    }) || [],
    subtotal,
    discount: discount?.amount ? {
      type: discount.type,
      value: discount.value,
      amount: discount.amount,
    } : undefined,
    serviceCharge: serviceCharge?.enabled && serviceCharge.amount > 0 ? {
      percent: serviceCharge.percent,
      amount: serviceCharge.amount,
    } : undefined,
    total,
    payments: payments.map(p => ({
      method: p.payment_method,
      amount: Number(p.amount),
    })),
    change: change > 0 ? change : undefined,
    splitBill: splitBill?.enabled && splitBill.count > 1 ? {
      count: splitBill.count,
      amountPerPerson: splitBill.amountPerPerson,
    } : undefined,
    createdAt: order.created_at,
    receiptType,
  };
}

// Fallback to browser print
function printWithBrowser({
  order,
  payments,
  discount,
  serviceCharge,
  splitBill,
  tableNumber,
  restaurantName = 'Restaurante',
  restaurantAddress = '',
  restaurantPhone = '',
  receiptType,
  logoUrl
}: CustomerReceiptProps) {
  const subtotal = order.subtotal || 0;
  const discountAmount = discount?.amount || order.discount || 0;
  const serviceAmount = serviceCharge?.enabled ? serviceCharge.amount : 0;
  const total = order.total || 0;
  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const change = totalPaid - total;

  const orderTypeLabel = order.order_type === 'dine_in' 
    ? `Mesa ${tableNumber || order.table?.number || '-'}`
    : order.order_type === 'takeaway' 
      ? 'Retirada' 
      : 'Delivery';

  const d = new Date(order.created_at);
  const dateStr = `${d.toLocaleDateString('pt-BR')} ${d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;

  function row(label: string, value: string, bold = false, color = '') {
    const style = bold ? 'font-weight:bold;' : '';
    const tdStyle = color ? `color:${color};` : '';
    return `<tr style="${tdStyle}"><td style="${style}">${label}</td><td style="text-align:right;white-space:nowrap;${style}">${value}</td></tr>`;
  }

  function cleanExtra(raw: string): string {
    if (raw.includes('# ')) return (raw.split('# ').pop() || raw).trim();
    if (raw.includes(': ')) return raw.split(': ').slice(1).join(': ').trim();
    return raw.trim();
  }

  const printContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Comprovante - ${order.id.slice(0, 8)}</title>
      <style>
        @page { size: 80mm auto; margin: 0; }
        * { box-sizing: border-box; }
        body {
          width: 72mm;
          font-family: 'Courier New', Courier, monospace;
          font-size: 11px;
          margin: 0;
          padding: 3mm 4mm;
          background: white;
          color: black;
        }
        .center { text-align: center; }
        .sep { border: none; border-top: 1px dashed black; margin: 3mm 0; }
        .sep-solid { border: none; border-top: 1px solid black; margin: 2mm 0; }
        table { width: 100%; border-collapse: collapse; }
        td { vertical-align: top; padding: 0.5mm 0; }
        td.r { text-align: right; white-space: nowrap; padding-left: 2mm; }
        .bold { font-weight: bold; }
        .sm { font-size: 9px; }
        .indent { padding-left: 4mm; font-size: 10px; }
        .banner { background:black; color:white; text-align:center; font-weight:bold; padding:2mm; margin-bottom:2mm; font-size:12px; }
        .note { text-align:center; font-size:9px; font-style:italic; }
        .total-row td { font-weight:bold; font-size:13px; }
      </style>
    </head>
    <body>
      <div class="center">
        ${logoUrl ? `<img src="${logoUrl}" style="max-width:190px;max-height:70px;margin-bottom:2mm;" /><br>` : ''}
        <div class="bold" style="font-size:13px;">${escapeHtml(restaurantName)}</div>
        ${restaurantAddress ? `<div class="sm">${escapeHtml(restaurantAddress)}</div>` : ''}
        ${restaurantPhone ? `<div class="sm">Tel: ${escapeHtml(restaurantPhone)}</div>` : ''}
      </div>

      <hr class="sep">

      ${receiptType ? `
        <div class="banner">${receiptType === 'summary' ? 'RESUMO DA CONTA' : 'CUPOM FISCAL'}</div>
        <div class="note">${receiptType === 'summary' ? '* Nao e um documento fiscal *' : '* Documento sem valor fiscal *'}</div>
        <hr class="sep">
      ` : ''}

      <table>
        <tr><td class="bold">Pedido</td><td class="r bold">#${order.id.slice(0, 8).toUpperCase()}</td></tr>
        <tr><td>${escapeHtml(orderTypeLabel)}</td><td class="r">${order.customer_name ? escapeHtml(order.customer_name) : ''}</td></tr>
        <tr><td>Data</td><td class="r">${dateStr}</td></tr>
      </table>

      <hr class="sep">
      <div class="bold">ITENS</div>
      <hr class="sep-solid">

      ${order.order_items?.map(item => {
        const normalExtras = item.extras?.map(e => ({
          name: cleanExtra(e.extra_name || ''),
          price: e.price || 0,
        })).filter(e => e.name) || [];

        const totalSubItems = item.sub_items?.length || 0;
        const subItemExtras: { name: string; price: number }[] = [];
        item.sub_items?.forEach(si => {
          const prefix = totalSubItems > 1 ? `${si.sub_item_index}/${totalSubItems} ` : '';
          si.sub_extras?.forEach(se => {
            const label = formatReceiptSubItemName(se.option_name, se.group_name, si.sub_item_index, totalSubItems);
            if (label) subItemExtras.push({ name: `${prefix}${label}`, price: se.price || 0 });
          });
        });

        const allExtras = [...normalExtras, ...subItemExtras];

        return `
          <table style="margin-bottom:2mm;">
            <tr>
              <td class="bold">${item.quantity}x ${escapeHtml(item.product?.name || 'Item')}${item.variation?.name ? ` (${escapeHtml(item.variation.name)})` : ''}</td>
              <td class="r bold">${formatCurrency(item.total_price)}</td>
            </tr>
            ${allExtras.map(e => `
              <tr class="indent">
                <td>+ ${escapeHtml(e.name)}</td>
                <td class="r sm">${e.price > 0 ? formatCurrency(e.price) : ''}</td>
              </tr>
            `).join('')}
            ${item.notes ? `<tr><td colspan="2" class="indent" style="font-style:italic;color:#555;">Obs: ${escapeHtml(item.notes)}</td></tr>` : ''}
          </table>
        `;
      }).join('<hr class="sep-solid">') || ''}

      <hr class="sep">
      <table>
        ${subtotal !== total ? row('Subtotal', formatCurrency(subtotal)) : ''}
        ${discountAmount > 0 ? row(`Desconto${discount?.type === 'percentage' ? ` (${discount.value}%)` : ''}`, `-${formatCurrency(discountAmount)}`, false, '#c00') : ''}
        ${serviceAmount > 0 ? row(`Servico (${serviceCharge?.percent}%)`, `+${formatCurrency(serviceAmount)}`, false, '#060') : ''}
      </table>
      <hr class="sep-solid">
      <table class="total-row"><tr><td>TOTAL</td><td class="r">${formatCurrency(total)}</td></tr></table>

      ${payments.length > 0 ? `
        <hr class="sep">
        <div class="bold">PAGAMENTO</div>
        <table style="margin-top:1mm;">
          ${payments.map(p => row(
            p.payment_method === 'cash' ? 'Dinheiro' :
            p.payment_method === 'credit_card' ? 'Credito' :
            p.payment_method === 'debit_card' ? 'Debito' : 'Pix',
            formatCurrency(Number(p.amount))
          )).join('')}
          ${change > 0 ? row('Troco', formatCurrency(change), true) : ''}
        </table>
      ` : ''}

      ${splitBill?.enabled && splitBill.count > 1 ? `
        <hr class="sep">
        <div class="center">
          <div class="bold">DIVISAO (${splitBill.count} pessoas)</div>
          <div style="font-size:13px;font-weight:bold;margin-top:1mm;">${formatCurrency(splitBill.amountPerPerson)} por pessoa</div>
        </div>
      ` : ''}

      <hr class="sep">
      <div class="center">
        ${receiptType === 'summary'
          ? `<div class="bold">Aguardamos seu pagamento!</div>`
          : `<div class="bold">Obrigado pela preferencia!</div><div>Volte sempre!</div>`
        }
        <div class="sm" style="margin-top:2mm;">${new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</div>
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
export async function printCustomerReceipt(
  props: CustomerReceiptProps,
  printer?: ReturnType<typeof usePrinterOptional>
) {
  // Try QZ Tray first
  if (printer?.canPrintToCashier) {
    try {
      const receiptData = propsToReceiptData(props);
      const success = await printer.printCustomerReceipt(receiptData);
      if (success) return;
    } catch (err) {
      console.error('QZ Tray print failed, falling back to browser:', err);
    }
  }
  
  // Fallback to browser print
  printWithBrowser(props);
}

// ============ PARTIAL PAYMENT RECEIPT ============

interface PartialPaymentReceiptProps {
  orderTotal: number;
  paymentAmount: number;
  paymentMethod: PaymentMethod;
  existingPayments: Payment[];
  tableNumber?: number;
  customerName?: string;
  orderId: string;
  coversTotal?: boolean;
  logoUrl?: string;
  items?: { quantity: number; productName: string; variation?: string | null; extras?: string[]; totalPrice: number }[];
}

const paymentMethodLabels: Record<PaymentMethod, string> = {
  cash: 'Dinheiro',
  credit_card: 'Crédito',
  debit_card: 'Débito',
  pix: 'Pix',
};

function printPartialPaymentWithBrowser({
  orderTotal,
  paymentAmount,
  paymentMethod,
  existingPayments,
  tableNumber,
  customerName,
  orderId,
  coversTotal,
  logoUrl,
  items,
}: PartialPaymentReceiptProps) {
  const previousTotal = existingPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const totalPaid = previousTotal + paymentAmount;
  const remainingAmount = orderTotal - totalPaid;

  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR') + ' ' + now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  function row(label: string, value: string, bold = false, big = false): string {
    const style = bold ? 'font-weight:bold;' : '';
    const valStyle = big ? 'font-weight:bold;font-size:13px;' : '';
    return `<tr><td style="${style}">${label}</td><td class="r" style="${style}${valStyle}">${value}</td></tr>`;
  }

  const printContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Comprovante de Pagamento</title>
      <style>
        @page { size: 80mm auto; margin: 0; }
        body {
          width: 72mm;
          font-family: 'Courier New', monospace;
          font-size: 11px;
          margin: 0;
          padding: 4mm;
          background: white;
          color: black;
        }
        table { width: 100%; border-collapse: collapse; }
        td { padding: 0 0 1mm 0; vertical-align: top; }
        td.r { text-align: right; white-space: nowrap; padding-left: 2mm; }
        .center { text-align: center; }
        .bold { font-weight: bold; }
        .sep { border-top: 1px dashed black; margin: 2mm 0; }
        .title { font-size: 14px; font-weight: bold; }
        .highlight { background: #f0f0f0; padding: 2mm; text-align: center; margin: 2mm 0; }
        .highlight .amt { font-size: 16px; font-weight: bold; }
        .footer { text-align: center; font-size: 9px; margin-top: 3mm; padding-top: 2mm; border-top: 1px dashed black; }
        .extra { font-size: 9px; padding-left: 3mm; }
        .total-row td { font-weight: bold; font-size: 13px; border-top: 1px solid black; padding-top: 2mm; }
        .paid-row td { color: green; font-weight: bold; font-size: 13px; border-top: 1px solid black; padding-top: 2mm; }
      </style>
    </head>
    <body>
      <div class="center">
        ${logoUrl ? `<img src="${logoUrl}" style="max-width:200px;max-height:80px;display:block;margin:0 auto 2mm;" />` : ''}
        <div class="title">${coversTotal ? 'PAGAMENTO REALIZADO' : 'PAGAMENTO PARCIAL'}</div>
        <div>${coversTotal ? 'Comprovante de Pagamento' : 'Comprovante de Pagamento Parcial'}</div>
      </div>
      <div class="sep"></div>

      <table>
        ${row('Pedido:', '#' + escapeHtml(orderId.slice(0, 8).toUpperCase()))}
        ${tableNumber ? row('Mesa:', String(tableNumber)) : ''}
        ${customerName ? row('Cliente:', escapeHtml(customerName)) : ''}
        ${row('Data/Hora:', dateStr)}
      </table>

      ${items && items.length > 0 ? `
        <div class="sep"></div>
        <div class="bold" style="margin-bottom:1mm;">ITENS</div>
        <table>
          ${items.map(item => `
            ${row(
              escapeHtml(item.quantity + 'x ' + item.productName + (item.variation ? ' (' + item.variation + ')' : '')),
              formatCurrency(item.totalPrice)
            )}
            ${item.extras && item.extras.length > 0 ? item.extras.map(e => `
              <tr><td colspan="2" class="extra">+ ${escapeHtml(e)}</td></tr>
            `).join('') : ''}
          `).join('')}
        </table>
      ` : ''}

      <div class="sep"></div>
      <div class="highlight">
        <div>Pagamento Registrado</div>
        <div class="amt">${formatCurrency(paymentAmount)}</div>
        <div>${paymentMethodLabels[paymentMethod]}</div>
      </div>

      ${existingPayments.length > 0 ? `
        <div class="sep"></div>
        <div class="bold" style="margin-bottom:1mm;">Pagamentos anteriores:</div>
        <table>
          ${existingPayments.map(p => row(
            paymentMethodLabels[p.payment_method],
            formatCurrency(Number(p.amount))
          )).join('')}
        </table>
      ` : ''}

      <div class="sep"></div>
      <table>
        ${row('Total da Conta:', formatCurrency(orderTotal))}
        ${row('Total Pago:', formatCurrency(totalPaid))}
        <tr class="${remainingAmount <= 0 ? 'paid-row' : 'total-row'}">
          <td>${remainingAmount <= 0 ? 'PAGO' : 'Falta Pagar:'}</td>
          <td class="r">${remainingAmount <= 0 ? '&#10003;' : formatCurrency(remainingAmount)}</td>
        </tr>
      </table>

      <div class="footer">
        <div>*** ${coversTotal ? 'Comprovante de pagamento' : 'Comprovante de pagamento parcial'} ***</div>
        ${coversTotal ? '' : '<div>Mesa continua aberta</div>'}
      </div>
    </body>
    </html>
  `;

  const printWindow = window.open('', '_blank', 'width=400,height=500');
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

export async function printPartialPaymentReceipt(
  props: PartialPaymentReceiptProps,
  printer?: ReturnType<typeof usePrinterOptional>
) {
  // Try QZ Tray first
  if (printer?.canPrintToCashier) {
    try {
      const success = await printer.printPartialPaymentReceipt({
        orderTotal: props.orderTotal,
        paymentAmount: props.paymentAmount,
        paymentMethod: props.paymentMethod,
        existingPayments: props.existingPayments.map(p => ({
          payment_method: p.payment_method,
          amount: Number(p.amount)
        })),
        tableNumber: props.tableNumber,
        customerName: props.customerName,
        orderId: props.orderId,
        coversTotal: props.coversTotal,
        items: props.items,
      });
      if (success) return;
    } catch (err) {
      console.error('QZ Tray print failed, falling back to browser:', err);
    }
  }
  
  // Fallback to browser print
  printPartialPaymentWithBrowser(props);
}
