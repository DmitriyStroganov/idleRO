/**
 * WebSocket client with reconnect + access-token refresh.
 *
 * Exposes a tiny pub/sub for incoming messages plus `sendCommand(cmd)` for
 * outbound. The renderer subscribes to 'state' / 'events' to drive the
 * canvas; UI panels call sendCommand for any mutation.
 */

import { WS_BASE } from './config';
import { loadAuthState, refresh as refreshAuth } from './auth';
import type { InMessage, OutMessage, Command } from './protocol';

type Listener = (msg: OutMessage) => void;

export class WsClient {
  private ws: WebSocket | null = null;
  private listeners = new Set<Listener>();
  private connectListeners = new Set<(connected: boolean) => void>();
  private reconnectAttempts = 0;
  private reconnectTimer: number | null = null;
  private closed = false;

  start(): void {
    this.closed = false;
    this.connect();
  }

  stop(): void {
    this.closed = true;
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  onMessage(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  onConnectedChange(fn: (connected: boolean) => void): () => void {
    this.connectListeners.add(fn);
    fn(this.isConnected());
    return () => this.connectListeners.delete(fn);
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  sendCommand(command: Command): void {
    const msg: InMessage = { type: 'command', command };
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    } else {
      console.warn('WS not connected, command dropped', command);
    }
  }

  private async connect(): Promise<void> {
    let auth = loadAuthState();
    if (!auth.accessToken) {
      // Try refresh — refresh cookie may still be valid.
      try { auth = await refreshAuth(); } catch { /* ignore */ }
    }
    if (!auth.accessToken) {
      // Not logged in — caller (main.ts) will route to LoginScreen.
      this.fireConnect(false);
      return;
    }

    const url = `${WS_BASE}/ws?token=${encodeURIComponent(auth.accessToken)}`;
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch (err) {
      console.warn('WS connect failed', err);
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;

    ws.addEventListener('open', () => {
      this.reconnectAttempts = 0;
      this.fireConnect(true);
    });

    ws.addEventListener('message', async (ev) => {
      let msg: OutMessage;
      try {
        msg = JSON.parse(ev.data as string) as OutMessage;
      } catch {
        console.warn('bad WS message', ev.data);
        return;
      }
      // Auto-refresh on auth errors.
      if (msg.type === 'error' && msg.error === 'bad_token') {
        try {
          await refreshAuth();
          this.reconnect();
          return;
        } catch {
          /* fall through to listeners */
        }
      }
      for (const fn of this.listeners) fn(msg);
    });

    ws.addEventListener('close', () => {
      this.fireConnect(false);
      if (!this.closed) this.scheduleReconnect();
    });
    ws.addEventListener('error', () => {
      // The close handler will fire next.
    });
  }

  private reconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connect();
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer !== null) return;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30_000);
    this.reconnectAttempts++;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private fireConnect(connected: boolean): void {
    for (const fn of this.connectListeners) fn(connected);
  }
}
