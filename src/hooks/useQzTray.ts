import { useCallback } from 'react';
import { usePersistentSettings } from './usePersistentSettings';

// Connection status type (used by SlimPrint)
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

// Keep backward compat alias
export type QzConnectionStatus = ConnectionStatus;

export interface PrinterConfig {
  kitchenPrinter: string | null;
  cashierPrinter: string | null;
  paperWidth: '58mm' | '80mm';
  autoConnectOnLogin: boolean;
  slimprintToken: string;
  slimprintUrl: string;
}

// Type for mixed print data (strings or image objects)
export type PrintDataItem = string | {
  type: 'raw';
  format: 'image' | 'base64' | 'command';
  flavor?: 'base64' | 'file' | 'plain';
  data: string;
  options?: {
    language?: string;
    dotDensity?: 'single' | 'double';
  };
};

const DEFAULT_CONFIG: PrinterConfig = {
  kitchenPrinter: null,
  cashierPrinter: null,
  paperWidth: '80mm',
  autoConnectOnLogin: true,
  slimprintToken: '123321',
  slimprintUrl: 'wss://127.0.0.1:9415',
};

export function useQzTray() {
  const { 
    settings: config, 
    updateSettings: updateConfigDb, 
    isLoading: isLoadingConfig 
  } = usePersistentSettings<PrinterConfig>({
    settingsKey: 'printer_config',
    defaults: DEFAULT_CONFIG,
    localStorageKey: 'pdv_printer_config',
  });

  const updateConfig = useCallback((updates: Partial<PrinterConfig>) => {
    updateConfigDb(updates);
  }, [updateConfigDb]);

  return {
    config,
    updateConfig,
    isLoadingConfig,
  };
}
