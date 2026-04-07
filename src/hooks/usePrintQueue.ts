import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/hooks/useTenant';

export type PrintJobType = 'kitchen_ticket' | 'customer_receipt' | 'cancellation_ticket' | 'kitchen_ticket_sector' | 'cash_closing_receipt';
export type PrintJobStatus = 'pending' | 'printed' | 'failed';

export interface PrintJob {
  id: string;
  print_type: PrintJobType;
  data: Record<string, unknown>;
  status: PrintJobStatus;
  created_by: string | null;
  created_at: string;
  printed_at: string | null;
  printed_by_device: string | null;
}

export function usePrintQueue() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { tenantId, isLoading: tenantLoading } = useTenant();

  const isPrintServer = typeof window !== 'undefined' && localStorage.getItem('is_print_server') === 'true';

  // Get pending print jobs - only poll on print server devices
  const { data: pendingJobs } = useQuery({
    queryKey: ['print-queue', 'pending', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      
      const { data, error } = await supabase
        .from('print_queue')
        .select('*')
        .eq('status', 'pending')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return (data || []).map(item => ({
        ...item,
        data: item.data as Record<string, unknown>,
      })) as PrintJob[];
    },
    enabled: !!tenantId && !tenantLoading && isPrintServer,
    refetchInterval: isPrintServer ? 5000 : false,
  });

  // Add job to queue
  const addPrintJob = useMutation({
    mutationFn: async (job: { print_type: PrintJobType; data: any }) => {
      const { data, error } = await supabase
        .from('print_queue')
        .insert({
          print_type: job.print_type,
          data: job.data,
          created_by: user?.id,
          tenant_id: tenantId
        })
        .select()
        .single();

      if (error) throw error;
      return {
        ...data,
        data: data.data as Record<string, unknown>,
      } as PrintJob;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['print-queue'] });
    },
  });

  // Mark job as printed
  const markAsPrinted = useMutation({
    mutationFn: async ({ jobId, deviceId }: { jobId: string; deviceId: string }) => {
      const { error } = await supabase
        .from('print_queue')
        .update({
          status: 'printed',
          printed_at: new Date().toISOString(),
          printed_by_device: deviceId,
        })
        .eq('id', jobId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['print-queue'] });
    },
  });

  // Mark job as failed
  const markAsFailed = useMutation({
    mutationFn: async (jobId: string) => {
      const { error } = await supabase
        .from('print_queue')
        .update({ status: 'failed' })
        .eq('id', jobId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['print-queue'] });
    },
  });

  return {
    pendingJobs,
    addPrintJob,
    markAsPrinted,
    markAsFailed,
  };
}
