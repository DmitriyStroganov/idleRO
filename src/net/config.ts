/**
 * Server connection configuration.
 *
 * In dev both client and server run on localhost (Vite at :5173, Fastify at
 * :4000). In production they share a domain (Caddy reverse-proxies /api and
 * /ws to the Fastify backend, / * to the static PWA).
 */

function deriveApiBase(): string {
  if (import.meta.env.VITE_API_BASE) return import.meta.env.VITE_API_BASE as string;
  // Same-origin by default (production / Caddy). Dev: explicit localhost.
  if (import.meta.env.DEV) return 'http://localhost:4000';
  return '';
}

function deriveWsBase(): string {
  if (import.meta.env.VITE_WS_BASE) return import.meta.env.VITE_WS_BASE as string;
  if (import.meta.env.DEV) return 'ws://localhost:4000';
  // Same-origin — wss if page is https.
  return `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`;
}

export const API_BASE = deriveApiBase();
export const WS_BASE = deriveWsBase();
