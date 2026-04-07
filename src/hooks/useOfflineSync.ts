import { useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useOfflineSupport, OfflineOperation } from './useOfflineSupport';
import { useToast } from './use-toast';
import { usePushNotifications } from './usePushNotifications';

export function useOfflineSync() {
  const { 
    isOnline, 
    isSyncing, 
    pendingOperations, 
    syncOperations,
    clearQueue 
  } = useOfflineSupport();
  const { toast } = useToast();
  const {
    notifyPendingSync,
    notifySyncStarted,
    notifySyncComplete,
    notifyOfflineWithPending,
    notifyOldPendingOperations,
  } = usePushNotifications();
  
  const syncAttemptedRef = useRef(false);
  const wasOnlineRef = useRef(true);
  const oldOperationsCheckedRef = useRef(false);

  const processSingleOperation = useCallback(async (operation: OfflineOperation): Promise<boolean> => {
    try {
      const { action, table, data } = operation;

      switch (action) {
        case 'create': {
          const { error } = await supabase
            .from(table as any)
            .insert(data);
          return !error;
        }
        case 'update': {
          const { id, ...updateData } = data;
          const { error } = await supabase
            .from(table as any)
            .update(updateData)
            .eq('id', id);
          return !error;
        }
        case 'delete': {
          const { error } = await supabase
            .from(table as any)
            .delete()
            .eq('id', data.id);
          return !error;
        }
        default:
          return false;
      }
    } catch (error) {
      console.error('Error processing offline operation:', error);
      return false;
    }
  }, []);

  const triggerSync = useCallback(async () => {
    if (!isOnline || pendingOperations.length === 0 || isSyncing) {
      return { success: 0, failed: 0 };
    }

    // Notify sync started
    await notifySyncStarted(pendingOperations.length);

    let successCount = 0;
    let failCount = 0;

    await syncOperations(async (operation) => {
      const result = await processSingleOperation(operation);
      if (result) {
        successCount++;
      } else {
        failCount++;
      }
      return result;
    });

    // Notify sync complete
    await notifySyncComplete(successCount, failCount);

    return { success: successCount, failed: failCount };
  }, [isOnline, pendingOperations.length, isSyncing, syncOperations, processSingleOperation, notifySyncStarted, notifySyncComplete]);

  // Notify when going offline with pending operations
  useEffect(() => {
    if (!isOnline && wasOnlineRef.current && pendingOperations.length > 0) {
      notifyOfflineWithPending(pendingOperations.length);
    }
    wasOnlineRef.current = isOnline;
  }, [isOnline, pendingOperations.length, notifyOfflineWithPending]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && pendingOperations.length > 0 && !syncAttemptedRef.current) {
      syncAttemptedRef.current = true;
      
      // Small delay to ensure connection is stable
      const timer = setTimeout(() => {
        triggerSync();
      }, 2000);

      return () => clearTimeout(timer);
    }

    if (!isOnline) {
      syncAttemptedRef.current = false;
    }
  }, [isOnline, pendingOperations.length, triggerSync]);

  // Check for old pending operations (>1 hour)
  useEffect(() => {
    if (pendingOperations.length === 0) {
      oldOperationsCheckedRef.current = false;
      return;
    }

    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const oldOperations = pendingOperations.filter(op => op.timestamp < oneHourAgo);

    if (oldOperations.length > 0 && !oldOperationsCheckedRef.current) {
      oldOperationsCheckedRef.current = true;
      notifyOldPendingOperations(oldOperations.length);
    }
  }, [pendingOperations, notifyOldPendingOperations]);

  return {
    isOnline,
    isSyncing,
    pendingOperations,
    triggerSync,
    clearQueue,
    pendingCount: pendingOperations.length
  };
}
