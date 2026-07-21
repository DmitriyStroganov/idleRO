/**
 * Character operations — mutating helpers that the UI calls.
 *
 * Each function returns a result indicating success/failure so the UI can
 * show feedback. All mutations flow through here so we keep invariants
 * (e.g. recomputeCharacterStats after equip) consistent.
 */

import type {
  ArmorSlot,
  Character,
  EquipmentInstance,
  InventoryEntry,
  ItemId,
  JobId,
  SkillId,
  StatKey,
} from '@engine/types';
import { ITEMS } from '@data/items';
import { JOBS, JOB_CHANGE_REQUIREMENTS } from '@data/jobs';
import { SKILLS } from '@data/skills';
import { recomputeCharacterStats } from '@engine/sim';
import { statPointCost } from '@engine/formulas/stats';

export type OpResult =
  | { ok: true }
  | { ok: false; reason: string };

// ============================================================================
// Stats
// ============================================================================

export function allocateStat(c: Character, key: StatKey): OpResult {
  if (c.statPoints <= 0) return fail('No stat points left');
  const current = c.stats.base[key];
  if (current >= 99) return fail('Stat already at 99');
  const cost = statPointCost(current);
  if (c.statPoints < cost) return fail(`Need ${cost} stat points`);
  c.stats.base[key] += 1;
  c.statPoints -= cost;
  recomputeCharacterStats(c);
  // Allocating VIT/INT changes max HP/SP — top up current to match.
  c.hp = c.maxHp;
  c.sp = c.maxSp;
  return ok();
}

// ============================================================================
// Skills
// ============================================================================

export function learnSkill(c: Character, skillId: SkillId): OpResult {
  const def = SKILLS[skillId];
  if (!def) return fail('Unknown skill');
  if (c.jobId !== def.job) return fail(`Skill belongs to ${def.job}`);
  const current = c.skills[skillId] ?? 0;
  if (current >= def.maxLevel) return fail('Skill already maxed');
  if (c.skillPoints <= 0) return fail('No skill points left');
  // Check prerequisites
  if (def.prerequisites) {
    for (const [reqId, reqLvl] of Object.entries(def.prerequisites)) {
      const have = c.skills[reqId as SkillId] ?? 0;
      if (have < (reqLvl as number)) {
        return fail(`Requires ${reqId} level ${reqLvl}`);
      }
    }
  }
  c.skills[skillId] = current + 1;
  c.skillPoints -= 1;
  return ok();
}

// ============================================================================
// Inventory & equipment
// ============================================================================

export function equipItem(c: Character, itemUid: string): OpResult {
  const entryIdx = c.inventory.findIndex((e) => e.uid === itemUid);
  if (entryIdx < 0) return fail('Item not in inventory');
  const entry = c.inventory[entryIdx]!;
  if (!entry.instance) return fail('Not equippable');
  const def = ITEMS[entry.itemId];
  if (!def) return fail('Unknown item');
  if (def.type !== 'weapon' && def.type !== 'armor') {
    return fail('Not equippable');
  }
  if (def.requiredJob && !def.requiredJob.includes(c.jobId)) {
    return fail(`Requires job: ${def.requiredJob.join(' or ')}`);
  }
  const slot: ArmorSlot =
    def.type === 'weapon' ? 'Weapon'
    : def.armorSlot ?? 'Armor';
  // Swap existing piece back into inventory.
  const previous = c.equipment[slot];
  c.equipment[slot] = entry.instance;
  // Apply appearance.
  if (def.spriteKey) {
    if (slot === 'Weapon') c.appearance.layers.weapon = def.spriteKey;
    else if (slot === 'Armor') c.appearance.layers.body = def.spriteKey;
    else if (slot === 'HeadTop') c.appearance.layers.headTop = def.spriteKey;
    else if (slot === 'HeadMid') c.appearance.layers.headMid = def.spriteKey;
    else if (slot === 'HeadLow') c.appearance.layers.headLow = def.spriteKey;
    else if (slot === 'Garment') c.appearance.layers.garment = def.spriteKey;
    else if (slot === 'Shoes') c.appearance.layers.body = c.appearance.layers.body; // shoes rarely visible
    else if (slot === 'Shield') c.appearance.layers.shield = def.spriteKey;
  }
  // Remove equipped item from inventory.
  c.inventory.splice(entryIdx, 1);
  // Place previous equipment back into inventory (if any).
  if (previous) {
    const prevDef = ITEMS[previous.itemId];
    c.inventory.push({
      uid: previous.uid,
      itemId: previous.itemId,
      count: 1,
      instance: previous,
    });
    // Strip appearance layer for previous piece if no replacement.
    if (prevDef?.spriteKey) {
      if (slot === 'Weapon') delete c.appearance.layers.weapon;
      else if (slot === 'Armor') c.appearance.layers.body = `Body_${c.jobId}`;
      else if (slot === 'HeadTop') delete c.appearance.layers.headTop;
      else if (slot === 'HeadMid') delete c.appearance.layers.headMid;
      else if (slot === 'HeadLow') delete c.appearance.layers.headLow;
      else if (slot === 'Garment') delete c.appearance.layers.garment;
      else if (slot === 'Shield') delete c.appearance.layers.shield;
    }
  }
  recomputeCharacterStats(c);
  return ok();
}

export function unequipItem(c: Character, slot: ArmorSlot): OpResult {
  const inst = c.equipment[slot];
  if (!inst) return fail('Nothing equipped in that slot');
  const def = ITEMS[inst.itemId];
  c.inventory.push({
    uid: inst.uid,
    itemId: inst.itemId,
    count: 1,
    instance: inst,
  });
  delete c.equipment[slot];
  if (def?.spriteKey) {
    if (slot === 'Weapon') delete c.appearance.layers.weapon;
    else if (slot === 'Armor') c.appearance.layers.body = `Body_${c.jobId}`;
    else if (slot === 'HeadTop') delete c.appearance.layers.headTop;
    else if (slot === 'HeadMid') delete c.appearance.layers.headMid;
    else if (slot === 'HeadLow') delete c.appearance.layers.headLow;
    else if (slot === 'Garment') delete c.appearance.layers.garment;
    else if (slot === 'Shield') delete c.appearance.layers.shield;
  }
  recomputeCharacterStats(c);
  return ok();
}

/** Add an item to inventory (used by the dev/debug gift UI). */
export function giveItem(c: Character, itemId: ItemId, count = 1): OpResult {
  const def = ITEMS[itemId];
  if (!def) return fail('Unknown item');
  if (def.type === 'weapon' || def.type === 'armor') {
    for (let i = 0; i < count; i++) {
      const inst: EquipmentInstance = {
        uid: `gift-${Date.now()}-${i}`,
        itemId,
        refine: 0,
        cards: new Array(def.slots).fill(null),
      };
      const entry: InventoryEntry = {
        uid: inst.uid, itemId, count: 1, instance: inst,
      };
      c.inventory.push(entry);
    }
  } else {
    const existing = c.inventory.find((e) => e.itemId === itemId);
    if (existing) {
      existing.count += count;
    } else {
      c.inventory.push({
        uid: `stack-${Date.now()}`,
        itemId,
        count,
      });
    }
  }
  return ok();
}

// ============================================================================
// Class change
// ============================================================================

export function canChangeJob(c: Character): { ok: boolean; to?: JobId; reason?: string } {
  const req = JOB_CHANGE_REQUIREMENTS[c.jobId];
  if (!req) return { ok: false, reason: 'Already at the top of this branch' };
  if (c.jobLevel < req.jobLevel) {
    return { ok: false, reason: `Need job level ${req.jobLevel} (have ${c.jobLevel})` };
  }
  return { ok: true, to: req.to };
}

export function changeJob(c: Character, to: JobId): OpResult {
  const req = canChangeJob(c);
  if (!req.ok) return fail(req.reason ?? 'Cannot change job');
  if (req.to !== to) return fail('Invalid target job');
  const job = JOBS[to];
  if (!job) return fail('Unknown job');
  c.jobId = to;
  // Reset job level + exp when changing class (classic RO behaviour).
  c.jobLevel = 1;
  c.jobExp = 0;
  // Award 1 skill point per job level lost (simplified — classic gives the
  // job-level skill points back; we just give a flat +40 to cover Novice→1st).
  c.skillPoints += 40;
  // Body sprite changes.
  c.appearance.layers.body = `Body_${to}`;
  recomputeCharacterStats(c);
  c.hp = c.maxHp;
  c.sp = c.maxSp;
  return ok();
}

// ============================================================================
// Helpers
// ============================================================================

function ok(): OpResult { return { ok: true }; }
function fail(reason: string): OpResult { return { ok: false, reason }; }
