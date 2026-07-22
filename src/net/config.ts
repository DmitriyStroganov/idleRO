/**
 * Server connection configuration.
 *
 * - Production (same-origin via nginx reverse proxy): leave VITE_API_BASE /
 *   VITE_WS_BASE unset; they default to '' (same-origin) and are appended
 *   with `import.meta.env.BASE_URL` so subpath deploys also work.
 * - Dev: explicit localhost:4000 via env or fallback.
 */

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');   // '' or '/idleRO'

function deriveApiBase(): string {
  if (import.meta.env.VITE_API_BASE) return import.meta.env.VITE_API_BASE as string;
  if (import.meta.env.DEV) return `http://localhost:4000${BASE}`;
  return BASE;   // same-origin in prod
}

function deriveWsBase(): string {
  if (import.meta.env.VITE_WS_BASE) return import.meta.env.VITE_WS_BASE as string;
  if (import.meta.env.DEV) return `ws://localhost:4000${BASE}`;
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.host}${BASE}`;
}

export const API_BASE = deriveApiBase();
export const WS_BASE = deriveWsBase();
