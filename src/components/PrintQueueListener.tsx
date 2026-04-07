import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { usePrinterOptional, SectorPrintItem } from '@/contexts/PrinterContext';
import { usePrintQueue, PrintJob } from '@/hooks/usePrintQueue';
import { usePrintSectors, PrintSector } from '@/hooks/usePrintSectors';
import { KitchenTicketData, CustomerReceiptData, CancellationTicketData } from '@/utils/escpos';
import { toast } from 'sonner';

// Generate unique device ID (persisted in localStorage)
function getDeviceId(): string {
  const key = 'print_server_device_id';
  let deviceId = localStorage.getItem(key);
  if (!deviceId) {
    deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem(key, deviceId);
  }
  return deviceId;
}

export function PrintQueueListener() {
  const printer = usePrinterOptional();
  const { data: printSectors } = usePrintSectors();
  const { pendingJobs, markAsPrinted, markAsFailed } = usePrintQueue();
  const [isPrintServer, setIsPrintServer] = useState(() => {
    return localStorage.getItem('is_print_server') === 'true';
  });
  const processingRef = useRef<Set<string>>(new Set());
  const deviceId = useRef(getDeviceId());

  // Persist print server setting
  useEffect(() => {
    localStorage.setItem('is_print_server', isPrintServer.toString());
  }, [isPrintServer]);

  // Subscribe to realtime updates for print_queue
  useEffect(() => {
    if (!isPrintServer) return;

    const channel = supabase
      .channel('print-queue-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'print_queue',
        },
        (payload) => {
          console.log('[PrintQueue] New print job received:', payload.new);
          // Process immediately when new job arrives
          processJob(payload.new as PrintJob);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isPrintServer, printer.isConnected]);

  // Process pending jobs sequentially on mount and when printer connects
  useEffect(() => {
    if (!isPrintServer || !printer.isConnected || !pendingJobs) return;

    // Sequential processing to avoid "Printer is busy" errors
    const processQueueSequentially = async () => {
      for (const job of pendingJobs) {
        if (!processingRef.current.has(job.id) && job.status === 'pending') {
          await processJob(job);
        }
      }
    };

    processQueueSequentially();
  }, [isPrintServer, printer.isConnected, pendingJobs]);

  const processJob = async (job: PrintJob) => {
    // Skip if not print server or printer not connected
    if (!isPrintServer || !printer.isConnected) return;
    
    // Skip if already processing or not pending
    if (processingRef.current.has(job.id) || job.status !== 'pending') return;

    processingRef.current.add(job.id);
    console.log('[PrintQueue] Processing job:', job.id, job.print_type);

    try {
      switch (job.print_type) {
        case 'kitchen_ticket':
          await printer.printKitchenTicket(job.data as unknown as KitchenTicketData);
          break;
        
        case 'kitchen_ticket_sector':
          const sectorData = job.data as unknown as { 
            items: SectorPrintItem[]; 
            orderInfo: Omit<KitchenTicketData, 'items'>;
            duplicate?: boolean;
          };
          if (sectorData.items && sectorData.orderInfo && printSectors) {
            await printer.printKitchenTicketsBySector(
              sectorData.items, 
              sectorData.orderInfo,
              printSectors,
              sectorData.duplicate
            );
          }
          break;
        
        case 'customer_receipt':
          await printer.printCustomerReceipt(job.data as unknown as CustomerReceiptData);
          break;
        
        case 'cancellation_ticket':
          await printer.printCancellationTicket(job.data as unknown as CancellationTicketData);
          break;
        
        default:
          console.warn('[PrintQueue] Unknown job type:', job.print_type);
      }

      // Mark as printed
      await markAsPrinted.mutateAsync({ jobId: job.id, deviceId: deviceId.current });
      console.log('[PrintQueue] Job completed:', job.id);
    } catch (error) {
      console.error('[PrintQueue] Error processing job:', job.id, error);
      await markAsFailed.mutateAsync(job.id);
      toast.error('Erro ao imprimir', {
        description: `Falha ao processar trabalho de impressão: ${job.print_type}`,
      });
    } finally {
      processingRef.current.delete(job.id);
    }
  };

  // Export setter for use in PrinterSettings
  (window as any).__setPrintServer = setIsPrintServer;
  (window as any).__isPrintServer = isPrintServer;

  return null; // This is a listener component, no UI
}

// Hook to toggle print server mode
export function usePrintServerMode() {
  const [isPrintServer, setIsPrintServer] = useState(() => {
    return localStorage.getItem('is_print_server') === 'true';
  });

  const toggle = (value: boolean) => {
    setIsPrintServer(value);
    localStorage.setItem('is_print_server', value.toString());
    // Sync with listener
    if ((window as any).__setPrintServer) {
      (window as any).__setPrintServer(value);
    }
  };

  return { isPrintServer, setIsPrintServer: toggle };
}
