import { usePrinter, SectorPrintItem } from '@/contexts/PrinterContext';
import { usePrintQueue } from '@/hooks/usePrintQueue';
import { usePrintSectors } from '@/hooks/usePrintSectors';
import { useGlobalSettings } from '@/hooks/useGlobalSettings';
import { KitchenTicketData, CustomerReceiptData, CancellationTicketData, CashClosingReceiptData } from '@/utils/escpos';
import { useCallback } from 'react';

/**
 * Hook that provides unified printing functions.
 * If this device is NOT the print server and a print server exists,
 * it will queue jobs for centralized printing.
 * Otherwise, it prints directly.
 */
export function useCentralizedPrinting() {
  const printer = usePrinter();
  const { addPrintJob } = usePrintQueue();
  const { data: printSectors } = usePrintSectors();
  const { usePrintQueue: usePrintQueueSetting } = useGlobalSettings();

  const isPrintServer = localStorage.getItem('is_print_server') === 'true';

  // Should we queue instead of printing directly?
  // If this device has a printer connected, always print directly (even if queue is enabled)
  // If this device is a print server but printer is disconnected and queue is enabled, use queue as fallback
  const hasLocalPrinter = printer?.isConnected === true;
  const shouldQueue = usePrintQueueSetting && !hasLocalPrinter;

  const printKitchenTicket = useCallback(async (ticketData: KitchenTicketData): Promise<boolean> => {
    if (shouldQueue) {
      try {
        await addPrintJob.mutateAsync({
          print_type: 'kitchen_ticket',
          data: ticketData as unknown as Record<string, unknown>,
        });
        return true;
      } catch (err) {
        console.error('[CentralizedPrint] Failed to queue kitchen ticket:', err);
        return false;
      }
    } else if (printer?.canPrintToKitchen) {
      return printer.printKitchenTicket(ticketData);
    }
    console.warn('[CentralizedPrint] No print path for kitchen ticket (queue:', usePrintQueueSetting, 'local:', hasLocalPrinter, 'canPrint:', printer?.canPrintToKitchen, ')');
    return false;
  }, [shouldQueue, addPrintJob, printer, usePrintQueueSetting, hasLocalPrinter]);

  const printKitchenTicketsBySector = useCallback(async (
    items: SectorPrintItem[],
    orderInfo: Omit<KitchenTicketData, 'items'>,
    duplicate: boolean = false
  ): Promise<boolean> => {
    if (shouldQueue) {
      try {
        const printIndividualItems = localStorage.getItem('pdv_print_individual_items') === 'true';

        if (printIndividualItems) {
          // Queue one job per item
          for (const item of items) {
            await addPrintJob.mutateAsync({
              print_type: 'kitchen_ticket_sector',
              data: {
                items: [item],
                orderInfo,
                duplicate,
              } as unknown as Record<string, unknown>,
            });
          }
        } else {
          await addPrintJob.mutateAsync({
            print_type: 'kitchen_ticket_sector',
            data: {
              items,
              orderInfo,
              duplicate,
            } as unknown as Record<string, unknown>,
          });
        }
        return true;
      } catch (err) {
        console.error('[CentralizedPrint] Failed to queue sector tickets:', err);
        return false;
      }
    } else if (printer?.canPrintToKitchen && printSectors) {
      const activeSectors = printSectors.filter(s => s?.is_active !== false && s?.printer_name);
      return printer.printKitchenTicketsBySector(items, orderInfo, activeSectors, duplicate);
    }
    console.warn('[CentralizedPrint] No print path for sector tickets');
    return false;
  }, [shouldQueue, addPrintJob, printer, printSectors]);

  const printCustomerReceipt = useCallback(async (receiptData: CustomerReceiptData): Promise<boolean> => {
    if (shouldQueue) {
      try {
        await addPrintJob.mutateAsync({
          print_type: 'customer_receipt',
          data: receiptData as unknown as Record<string, unknown>,
        });
        return true;
      } catch (err) {
        console.error('[CentralizedPrint] Failed to queue customer receipt:', err);
        return false;
      }
    } else if (printer?.canPrintToCashier) {
      return printer.printCustomerReceipt(receiptData);
    }
    console.warn('[CentralizedPrint] No print path for customer receipt');
    return false;
  }, [shouldQueue, addPrintJob, printer]);

  const printCancellationTicket = useCallback(async (ticketData: CancellationTicketData): Promise<boolean> => {
    if (shouldQueue) {
      try {
        await addPrintJob.mutateAsync({
          print_type: 'cancellation_ticket',
          data: ticketData as unknown as Record<string, unknown>,
        });
        return true;
      } catch (err) {
        console.error('[CentralizedPrint] Failed to queue cancellation ticket:', err);
        return false;
      }
    } else if (printer?.canPrintToKitchen) {
      return printer.printCancellationTicket(ticketData);
    }
    console.warn('[CentralizedPrint] No print path for cancellation ticket');
    return false;
  }, [shouldQueue, addPrintJob, printer]);

  const printCashClosingReceipt = useCallback(async (receiptData: CashClosingReceiptData): Promise<boolean> => {
    if (shouldQueue) {
      try {
        await addPrintJob.mutateAsync({
          print_type: 'cash_closing_receipt',
          data: receiptData as unknown as Record<string, unknown>,
        });
        return true;
      } catch (err) {
        console.error('[CentralizedPrint] Failed to queue cash closing receipt:', err);
        return false;
      }
    } else if (printer?.canPrintToCashier) {
      return printer.printCashClosingReceipt(receiptData);
    }
    console.warn('[CentralizedPrint] No print path for cash closing receipt');
    return false;
  }, [shouldQueue, addPrintJob, printer]);

  return {
    // Unified print functions
    printKitchenTicket,
    printKitchenTicketsBySector,
    printCustomerReceipt,
    printCancellationTicket,
    printCashClosingReceipt,
    // State
    isPrintServer,
    shouldQueue,
    canPrintToKitchen: shouldQueue || printer?.canPrintToKitchen,
    canPrintToCashier: shouldQueue || printer?.canPrintToCashier,
    // Direct printer access (for UI status)
    printer,
  };
}
