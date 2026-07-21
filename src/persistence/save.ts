/**
 * Persistence — save / load to localStorage.
 *
 * Saves are full snapshots of (Character, World, currentPreset). Schema is
 * versioned; load runs the migration chain if needed.
 *
 * Why snapshot instead of incremental: the world is small enough that JSON
 * fits comfortably in localStorage (a few KB), and snapshots are far easier
 * to reason about when implementing PvP arena replays later.
 */

import type { Character, World } from '@engine/types';

const SCHEMA_VERSION = 1;
const STORAGE_PREFIX = 'idleRO:save:';
const SETTINGS_KEY = 'idleRO:settings';

export interface SaveSlot {
  slot: string;
  name: string;
  savedAt: number;          // epoch ms
  schemaVersion: number;
  baseLevel: number;
  jobId: string;
  playtimeMs: number;
}

export interface SaveData {
  schemaVersion: number;
  savedAt: number;
  name: string;
  playtimeMs: number;
  presetId: string;
  character: Character;
  world: World;
}

export class SaveError extends Error {
  constructor(public code: 'quota' | 'corrupt' | 'mismatch' | 'missing' | 'unknown', message: string) {
    super(message);
    this.name = 'SaveError';
  }
}

// ============================================================================
// Save
// ============================================================================

export function saveGame(
  slot: string,
  character: Character,
  world: World,
  presetId: string,
  name?: string,
  playtimeMs = 0,
): SaveSlot {
  const data: SaveData = {
    schemaVersion: SCHEMA_VERSION,
    savedAt: Date.now(),
    name: name ?? `${character.jobId} Lv${character.baseLevel}`,
    playtimeMs,
    presetId,
    character: deepClone(character),
    world: deepClone(world),
  };
  try {
    localStorage.setItem(STORAGE_PREFIX + slot, JSON.stringify(data));
  } catch (e: unknown) {
    if (isQuotaError(e)) {
      throw new SaveError('quota', 'localStorage quota exceeded');
    }
    throw new SaveError('unknown', `Failed to save: ${(e as Error).message}`);
  }
  return {
    slot,
    name: data.name,
    savedAt: data.savedAt,
    schemaVersion: SCHEMA_VERSION,
    baseLevel: character.baseLevel,
    jobId: character.jobId,
    playtimeMs,
  };
}

// ============================================================================
// Load
// ============================================================================

export function loadGame(slot: string): SaveData {
  const raw = localStorage.getItem(STORAGE_PREFIX + slot);
  if (!raw) throw new SaveError('missing', `No save in slot ${slot}`);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new SaveError('corrupt', `Slot ${slot} is not valid JSON`);
  }
  return migrate(parsed as SaveData);
}

// ============================================================================
// Slot listing / deletion
// ============================================================================

export function listSaves(): SaveSlot[] {
  const out: SaveSlot[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(STORAGE_PREFIX)) continue;
    const slot = key.slice(STORAGE_PREFIX.length);
    try {
      const raw = localStorage.getItem(key);
      const data = raw ? JSON.parse(raw) as Partial<SaveData> : {};
      out.push({
        slot,
        name: data.name ?? slot,
        savedAt: data.savedAt ?? 0,
        schemaVersion: data.schemaVersion ?? 0,
        baseLevel: data.character?.baseLevel ?? 0,
        jobId: data.character?.jobId ?? 'Unknown',
        playtimeMs: data.playtimeMs ?? 0,
      });
    } catch {
      // skip corrupt slot
    }
  }
  out.sort((a, b) => b.savedAt - a.savedAt);
  return out;
}

export function deleteSave(slot: string): void {
  localStorage.removeItem(STORAGE_PREFIX + slot);
}

export function hasSave(slot: string): boolean {
  return localStorage.getItem(STORAGE_PREFIX + slot) !== null;
}

// ============================================================================
// Settings (separate from saves — display prefs, etc.)
// ============================================================================

export interface Settings {
  autoSave: boolean;
  autoSaveIntervalMs: number;
}

const DEFAULT_SETTINGS: Settings = {
  autoSave: true,
  autoSaveIntervalMs: 30_000,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) as Partial<Settings> };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

// ============================================================================
// Migration
// ============================================================================

function migrate(data: SaveData): SaveData {
  if (data.schemaVersion === SCHEMA_VERSION) return data;
  let current = data;
  for (let v = current.schemaVersion; v < SCHEMA_VERSION; v++) {
    const migrator = MIGRATIONS[v];
    if (!migrator) {
      throw new SaveError(
        'mismatch',
        `No migration from schema v${v}; current is v${SCHEMA_VERSION}`,
      );
    }
    current = migrator(current);
  }
  return current;
}

// Map of "from version → migrator to next version". Empty for v1.
const MIGRATIONS: Record<number, (d: SaveData) => SaveData> = {
  // Example for the future:
  // 1: (d) => ({ ...d, schemaVersion: 2, /* transform fields */ }),
};

// ============================================================================
// Helpers
// ============================================================================

function deepClone<T>(v: T): T {
  if (typeof structuredClone === 'function') return structuredClone(v);
  return JSON.parse(JSON.stringify(v)) as T;
}

function isQuotaError(e: unknown): boolean {
  if (!(e instanceof DOMException)) return false;
  return e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED';
}
