/**
 * Client-side state store. Holds the latest Character + World received from
 * the server (read-only) and a tiny pub/sub for the renderer / UI.
 *
 * This is NOT a source of truth — every mutation goes through `WsClient`
 * → server → state update. The store only mirrors what the server says.
 */

import type { Character, World } from '@engine/types';

export interface ClientState {
  connected: boolean;
  paused: boolean;
  character: Character | null;
  world: World | null;
  username: string | null;
  userId: number | null;
}

type Listener = (s: ClientState) => void;

class Store {
  private state: ClientState = {
    connected: false,
    paused: false,
    character: null,
    world: null,
    username: null,
    userId: null,
  };
  private listeners = new Set<Listener>();

  get(): ClientState {
    return this.state;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.state);
    return () => this.listeners.delete(fn);
  }

  setConnected(connected: boolean): void {
    if (this.state.connected === connected) return;
    this.state = { ...this.state, connected };
    this.emit();
  }

  setPaused(paused: boolean): void {
    if (this.state.paused === paused) return;
    this.state = { ...this.state, paused };
    this.emit();
  }

  setState(character: Character, world: World): void {
    this.state = { ...this.state, character, world };
    this.emit();
  }

  setUser(user: { id: number; username: string } | null): void {
    this.state = {
      ...this.state,
      userId: user?.id ?? null,
      username: user?.username ?? null,
    };
    this.emit();
  }

  clear(): void {
    this.state = {
      connected: false,
      paused: false,
      character: null,
      world: null,
      username: null,
      userId: null,
    };
    this.emit();
  }

  private emit(): void {
    for (const fn of this.listeners) fn(this.state);
  }
}

export const store = new Store();
