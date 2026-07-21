/**
 * Tests for the persistence layer.
 * Uses a localStorage mock since tests run in node.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  saveGame,
  loadGame,
  listSaves,
  deleteSave,
  hasSave,
  loadSettings,
  saveSettings,
  SaveError,
} from '@persistence/save';
import { createCharacter, createWorld, recomputeCharacterStats } from '@engine/sim';
import { ITEMS } from '@data/items';
import type { Character, World } from '@engine/types';

// --- minimal localStorage mock ---
class MemStorage implements Storage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  key(i: number): string | null { return [...this.m.keys()][i] ?? null; }
  getItem(k: string): string | null { return this.m.has(k) ? this.m.get(k)! : null; }
  setItem(k: string, v: string): void { this.m.set(k, String(v)); }
  removeItem(k: string): void { this.m.delete(k); }
  clear(): void { this.m.clear(); }
}

beforeEach(() => {
  const store = new MemStorage();
  (globalThis as any).localStorage = store;
});

describe('persistence', () => {
  it('saves and loads a character+world roundtrip', () => {
    const c = createCharacter({ jobId: 'Archer', baseLevel: 10, jobLevel: 8 });
    c.equipment['Weapon'] = {
      uid: 'w', itemId: 'Item_Weapon_CompositeBow', refine: 5, cards: ['Card_Andre'],
    };
    c.appearance.layers.weapon = ITEMS['Item_Weapon_CompositeBow']!.spriteKey!;
    c.exp = 12345;
    c.zeny = 999;
    recomputeCharacterStats(c);
    c.hp = c.maxHp;

    const world = createWorld({ seed: 7, mapLength: 50, playerStartX: 3, spawns: [] });
    world.players.push(c);

    saveGame('slot1', c, world, 'aggressive');
    expect(hasSave('slot1')).toBe(true);

    const data = loadGame('slot1');
    expect(data.character.jobId).toBe('Archer');
    expect(data.character.baseLevel).toBe(10);
    expect(data.character.exp).toBe(12345);
    expect(data.character.zeny).toBe(999);
    expect(data.character.equipment['Weapon']?.refine).toBe(5);
    expect(data.character.equipment['Weapon']?.cards).toEqual(['Card_Andre']);
    expect(data.presetId).toBe('aggressive');
    expect(data.world.seed).toBe(7);
  });

  it('listSaves returns all saves sorted by recency', () => {
    const c1 = createCharacter({ jobId: 'Novice' });
    const w1 = createWorld({ seed: 1, mapLength: 10, playerStartX: 0, spawns: [] });
    const c2 = createCharacter({ jobId: 'Archer', baseLevel: 30 });
    const w2 = createWorld({ seed: 2, mapLength: 10, playerStartX: 0, spawns: [] });
    saveGame('slot1', c1, w1, 'defensive');
    saveGame('slot2', c2, w2, 'aggressive');
    const saves = listSaves();
    expect(saves).toHaveLength(2);
    expect(saves.map((s) => s.slot)).toContain('slot1');
    expect(saves.map((s) => s.slot)).toContain('slot2');
  });

  it('deleteSave removes a slot', () => {
    const c = createCharacter({ jobId: 'Novice' });
    const w = createWorld({ seed: 1, mapLength: 10, playerStartX: 0, spawns: [] });
    saveGame('slot1', c, w, 'defensive');
    expect(hasSave('slot1')).toBe(true);
    deleteSave('slot1');
    expect(hasSave('slot1')).toBe(false);
  });

  it('loadGame throws SaveError on missing slot', () => {
    expect(() => loadGame('nonexistent')).toThrow(SaveError);
  });

  it('loadGame throws SaveError on corrupt JSON', () => {
    localStorage.setItem('idleRO:save:bad', 'not json {');
    expect(() => loadGame('bad')).toThrow(SaveError);
  });

  it('settings roundtrip', () => {
    const s = { autoSave: false, autoSaveIntervalMs: 60_000 };
    saveSettings(s);
    const loaded = loadSettings();
    expect(loaded.autoSave).toBe(false);
    expect(loaded.autoSaveIntervalMs).toBe(60_000);
  });

  it('preserves nested structure (skill map, inventory instances)', () => {
    const c = createCharacter({ jobId: 'Hunter', baseLevel: 55 });
    c.skills = { Skill_Archer_DoubleStrafe: 10, Skill_Hunter_BlitzBeat: 5 };
    c.inventory.push({
      uid: 'inv-bow-1',
      itemId: 'Item_Weapon_HunterBow',
      count: 1,
      instance: {
        uid: 'inv-bow-1',
        itemId: 'Item_Weapon_HunterBow',
        refine: 7,
        cards: ['Card_Hydra', 'Card_Hydra', null as never],
      },
    });
    const world = createWorld({ seed: 3, mapLength: 10, playerStartX: 0, spawns: [] });
    saveGame('slotX', c, world, 'sniper-kite');

    const loaded = loadGame('slotX');
    expect(loaded.character.skills.Skill_Archer_DoubleStrafe).toBe(10);
    expect(loaded.character.skills.Skill_Hunter_BlitzBeat).toBe(5);
    const bow = loaded.character.inventory[0]!.instance!;
    expect(bow.refine).toBe(7);
    expect(bow.cards[0]).toBe('Card_Hydra');
    expect(bow.cards[1]).toBe('Card_Hydra');
  });
});

void (null as unknown as Character);
void (null as unknown as World);
