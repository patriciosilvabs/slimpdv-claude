// Version is injected at build time by Vite (see vite.config.ts define)
// Format: v1, v2, v3... (sequential, from version.json)
declare const __BUILD_VERSION__: string;

export const APP_VERSION = typeof __BUILD_VERSION__ !== 'undefined' 
  ? __BUILD_VERSION__ 
  : 'dev';
