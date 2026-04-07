/**
 * Utilitário para migrar configurações legadas do localStorage para o banco de dados.
 * Esta migração é executada automaticamente pelo hook usePersistentSettings,
 * mas este arquivo fornece funções auxiliares para migrações manuais se necessário.
 */

// Chaves de localStorage que devem ser migradas
export const LEGACY_STORAGE_KEYS = {
  PRINTER_CONFIG: 'pdv_printer_config',
  NOTIFICATION_SETTINGS: 'pdv-notification-settings',
  KDS_DEVICE_SETTINGS: 'kds-device-settings',
} as const;

// Chaves correspondentes no banco (global_settings.key)
export const DB_SETTINGS_KEYS = {
  PRINTER_CONFIG: 'printer_config',
  NOTIFICATION_SETTINGS: 'notification_settings',
  KDS_DEVICE_SETTINGS: 'kds_device_settings',
} as const;

/**
 * Lê dados legados do localStorage
 */
export function readLegacySettings<T>(key: string): T | null {
  try {
    const stored = localStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.warn(`[settingsMigration] Erro ao ler ${key}:`, error);
  }
  return null;
}

/**
 * Verifica se uma chave já foi migrada
 */
export function isMigrated(key: string): boolean {
  const migratedKey = `_migrated_${key}`;
  return localStorage.getItem(migratedKey) === 'true';
}

/**
 * Marca uma chave como migrada
 */
export function markAsMigrated(key: string): void {
  const migratedKey = `_migrated_${key}`;
  localStorage.setItem(migratedKey, 'true');
}

/**
 * Limpa dados legados do localStorage após migração bem-sucedida
 * (opcional - pode manter como backup)
 */
export function clearLegacySettings(key: string): void {
  try {
    const backupKey = `_backup_${key}`;
    const data = localStorage.getItem(key);
    if (data) {
      // Faz backup antes de limpar
      localStorage.setItem(backupKey, data);
    }
    // Não remove o original para manter compatibilidade com versões antigas
    // localStorage.removeItem(key);
  } catch (error) {
    console.warn(`[settingsMigration] Erro ao limpar ${key}:`, error);
  }
}

/**
 * Faz merge inteligente entre settings salvos e defaults.
 * Usa 'in' operator para preservar valores explícitos (mesmo se null/undefined).
 */
export function smartMergeSettings<T extends Record<string, any>>(
  saved: Partial<T> | null,
  defaults: T
): T {
  if (!saved) return defaults;
  
  const result = { ...defaults };
  
  for (const key of Object.keys(defaults) as (keyof T)[]) {
    if (key in saved) {
      const savedValue = saved[key];
      const defaultValue = defaults[key];
      
      // Se ambos são objetos (não arrays), faz merge recursivo
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
}

/**
 * Versiona as configurações para permitir migrações futuras
 */
export interface VersionedSettings<T> {
  _version: number;
  data: T;
}

export function wrapWithVersion<T>(data: T, version: number): VersionedSettings<T> {
  return { _version: version, data };
}

export function unwrapVersioned<T>(wrapped: VersionedSettings<T> | T): { data: T; version: number } {
  if (typeof wrapped === 'object' && wrapped !== null && '_version' in wrapped && 'data' in wrapped) {
    return { data: (wrapped as VersionedSettings<T>).data, version: (wrapped as VersionedSettings<T>)._version };
  }
  // Formato legado sem versão
  return { data: wrapped as T, version: 0 };
}
