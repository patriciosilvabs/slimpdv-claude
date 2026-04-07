import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';

export interface OfflineOperation {
  id: string;
  action: 'create' | 'update' | 'delete';
  table: string;
  data: any;
  timestamp: number;
}

const DB_NAME = 'pdv-offline-db';
const STORE_NAME = 'offline-queue';
const DB_VERSION = 1;

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function useOfflineSupport() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingOperations, setPendingOperations] = useState<OfflineOperation[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const dbRef = useRef<IDBDatabase | null>(null);
  const { toast } = useToast();

  // Initialize IndexedDB
  const initDB = useCallback((): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      if (dbRef.current) {
        resolve(dbRef.current);
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        dbRef.current = request.result;
        resolve(request.result);
      };
      
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };
    });
  }, []);

  // Load pending operations from IndexedDB
  const loadPendingOperations = useCallback(async () => {
    try {
      const db = await initDB();
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();
      
      request.onsuccess = () => {
        setPendingOperations(request.result || []);
      };
    } catch (error) {
      console.error('Error loading offline operations:', error);
    }
  }, [initDB]);

  // Add operation to queue
  const addToQueue = useCallback(async (operation: Omit<OfflineOperation, 'id' | 'timestamp'>) => {
    const newOperation: OfflineOperation = {
      ...operation,
      id: generateId(),
      timestamp: Date.now(),
    };

    try {
      const db = await initDB();
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      store.add(newOperation);
      
      setPendingOperations(prev => [...prev, newOperation]);
      
      toast({
        title: 'Operação salva offline',
        description: 'Será sincronizada quando a conexão for restaurada.',
      });
    } catch (error) {
      console.error('Error adding to offline queue:', error);
    }
  }, [initDB, toast]);

  // Remove operation from queue
  const removeFromQueue = useCallback(async (id: string) => {
    try {
      const db = await initDB();
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      store.delete(id);
      
      setPendingOperations(prev => prev.filter(op => op.id !== id));
    } catch (error) {
      console.error('Error removing from offline queue:', error);
    }
  }, [initDB]);

  // Clear all operations
  const clearQueue = useCallback(async () => {
    try {
      const db = await initDB();
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      store.clear();
      
      setPendingOperations([]);
    } catch (error) {
      console.error('Error clearing offline queue:', error);
    }
  }, [initDB]);

  // Sync operations with server (to be implemented by consumers)
  const syncOperations = useCallback(async (
    syncFn: (operation: OfflineOperation) => Promise<boolean>
  ) => {
    if (!isOnline || pendingOperations.length === 0) return;

    setIsSyncing(true);
    let successCount = 0;
    let failCount = 0;

    for (const operation of pendingOperations) {
      try {
        const success = await syncFn(operation);
        if (success) {
          await removeFromQueue(operation.id);
          successCount++;
        } else {
          failCount++;
        }
      } catch (error) {
        console.error('Error syncing operation:', error);
        failCount++;
      }
    }

    setIsSyncing(false);

    if (successCount > 0) {
      toast({
        title: 'Sincronização concluída',
        description: `${successCount} operação(ões) sincronizada(s).`,
      });
    }

    if (failCount > 0) {
      toast({
        title: 'Erros na sincronização',
        description: `${failCount} operação(ões) falharam.`,
        variant: 'destructive',
      });
    }
  }, [isOnline, pendingOperations, removeFromQueue, toast]);

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast({
        title: 'Conexão restaurada',
        description: 'Você está online novamente.',
      });
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast({
        title: 'Sem conexão',
        description: 'Operações serão salvas localmente.',
        variant: 'destructive',
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Load pending operations on mount
    loadPendingOperations();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [loadPendingOperations, toast]);

  return {
    isOnline,
    isSyncing,
    pendingOperations,
    addToQueue,
    removeFromQueue,
    clearQueue,
    syncOperations,
  };
}
