export function sanitizeFileName(name: string): string {
  return name
    // Normaliza unicode e remove diacríticos (acentos)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    // Substitui espaços por underscore
    .replace(/\s+/g, '_')
    // Remove caracteres especiais (mantém apenas letras, números, underscore, hífen)
    .replace(/[^a-zA-Z0-9_-]/g, '')
    // Remove underscores duplicados
    .replace(/_+/g, '_')
    // Remove underscore do início/fim
    .replace(/^_|_$/g, '');
}
