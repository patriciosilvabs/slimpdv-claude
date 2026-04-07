import { useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { client as apiClient } from '@/integrations/api/client';

interface PersistentSettingsOptions<T> {
  /** Unique key for the setting in the database */
  settingsKey: string;
  /** Default values for the settings */
  defaults: T;
  /** Local storage key for caching (optional) */
  localStorageKey?: string;
  /** Version number for migration purposes */
  version?: number;
}

/**
 * Hook para sincronizar configurações entre banco de dados e localStorage.
 * Usa a API local (/api/settings/:key) como fonte de verdade.
 * localStorage é usado como cache para leitura imediata na inicialização.
 */
export function usePersistentSettings<T extends Record<string, any>>({
  settingsKey,
  defaults,
  localStorageKey,
  version = 1,
}: PersistentSettingsOptions<T>) {
  const queryClient = useQueryClient();
  const storageKey = localStorageKey || `pdv_${settingsKey}`;

  // Helper para merge inteligente
  const smartMerge = useCallback((saved: Partial<T> | null, defaultValues: T): T => {
    if (!saved) return defaultValues;

    const result = { ...defaultValues };

    for (const key of Object.keys(defaultValues) as (keyof T)[]) {
      if (key in saved) {
        const savedValue = saved[key];
        const defaultValue = defaultValues[key];

        if (
          savedValue !== null &&
          defaultValue !== null &&
          typeof savedValue === 'object' &&
          typeof defaultValue === 'object' &&
          !Array.isArray(savedValue) &&
          !Array.isArray(defaultValue)
        ) {
          result[key] = { ...defaultValue, ...savedValue } as T[keyof T];
        } else {
          result[key] = savedValue as T[keyof T];
        }
      }
    }

    return result;
  }, []);

  const readFromLocalStorage = useCallback((): { data: Partial<T> | null; version: number } => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (typeof parsed === 'object' && '_version' in parsed && 'data' in parsed) {
          return { data: parsed.data, version: parsed._version };
        }
        return { data: parsed, version: 0 };
      }
    } catch {
      // ignore
    }
    return { data: null, version: 0 };
  }, [storageKey]);

  const saveToLocalStorage = useCallback((data: T) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ _version: version, data }));
    } catch {
      // ignore
    }
  }, [storageKey, version]);

  // Query: lê do banco via API, com fallback para localStorage
  const { data: queryData, isLoading } = useQuery({
    queryKey: ['persistent-settings', settingsKey],
    queryFn: async () => {
      try {
        const response = await apiClient.get<{ value: Partial<T> | null }>(`/settings/${settingsKey}`);
        if (response.value) {
          const merged = smartMerge(response.value, defaults);
          saveToLocalStorage(merged);
          return { settings: merged, fromApi: true };
        }
      } catch (err) {
        // API indisponível ou erro — usar localStorage
        console.warn(`[usePersistentSettings] API error for ${settingsKey}, falling back to localStorage`, err);
      }

      // Fallback: localStorage
      const { data: localData } = readFromLocalStorage();
      return { settings: smartMerge(localData, defaults), fromApi: false };
    },
    staleTime: 1000 * 60 * 5, // 5 minutos
  });

  const settings = queryData?.settings ?? defaults;

  // Mutation: salva no banco E no localStorage
  const saveMutation = useMutation({
    mutationFn: async (newSettings: T) => {
      // Sempre salva no localStorage primeiro (imediato)
      saveToLocalStorage(newSettings);

      // Salva no banco via API
      try {
        await apiClient.put(`/settings/${settingsKey}`, { value: newSettings });
      } catch (err) {
        console.warn(`[usePersistentSettings] Failed to save ${settingsKey} to API:`, err);
        // Não lança erro — localStorage já foi salvo
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['persistent-settings', settingsKey] });
    },
  });

  // Sincroniza localStorage quando settings mudam
  useEffect(() => {
    if (!isLoading && settings) {
      saveToLocalStorage(settings);
    }
  }, [settings, isLoading, saveToLocalStorage]);

  const updateSettings = useCallback((updates: Partial<T>) => {
    const newSettings = { ...settings, ...updates };
    saveMutation.mutate(newSettings);
  }, [settings, saveMutation]);

  const setSettings = useCallback((newSettings: T) => {
    saveMutation.mutate(newSettings);
  }, [saveMutation]);

  return {
    settings,
    isLoading,
    isSaving: saveMutation.isPending,
    updateSettings,
    setSettings,
    tenantId: null, // compatibilidade — não usado mais
  };
}
