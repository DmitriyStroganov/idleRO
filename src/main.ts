/**
 * Main entry point — bootstraps the engine, builds a starting world,
 * wires the renderer, and runs the fixed-tick game loop.
 */

import './style.css';

import { createCharacter, createWorld, stepWorld, recomputeCharacterStats } from '@engine/sim';
import { PRESETS } from '../src/ai/strategy';
import { presetStrategy } from '../src/ai/preset-executor';
import type { AiStrategy } from '../src/ai/strategy';
import { CanvasRenderer } from '@render/canvas';
import { PlaceholderSpriteProvider } from '@render/sprites';
import { TICK_MS } from '@engine/types';
import { ITEMS } from '@data/items';
import type { Character, MobSpawn } from '@engine/types';
import { createRng, type RngState } from '@engine/rng';

// ============================================================================
// Boot
// ============================================================================

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const hud = document.querySelector<HTMLElement>('#hud')!;

const sprites = new PlaceholderSpriteProvider();
const renderer = new CanvasRenderer(canvas, sprites);

window.addEventListener('resize', () => renderer.resize());

// ============================================================================
// Build a starter character
// ============================================================================

const player = createCharacter({ jobId: 'Archer', baseLevel: 5, jobLevel: 5 });

// Equip starter gear so combat math has real inputs.
function equip(c: Character, slot: 'Weapon' | 'Armor' | 'HeadTop' | 'Shoes' | 'Garment', itemId: string, cards: string[] = []): void {
  const def = ITEMS[itemId];
  if (!def) return;
  c.equipment[slot] = {
    uid: `${slot}-${c.uid}`,
    itemId,
    refine: 0,
    cards,
  };
  // Apply appearance from item spriteKey
  if (def.spriteKey) {
    if (slot === 'Weapon') c.appearance.layers.weapon = def.spriteKey;
    if (slot === 'Armor') c.appearance.layers.body = def.spriteKey;
    if (slot === 'HeadTop') c.appearance.layers.headTop = def.spriteKey;
    if (slot === 'Garment') c.appearance.layers.garment = def.spriteKey;
  }
}

equip(player, 'Weapon', 'Item_Weapon_CompositeBow');
equip(player, 'Armor', 'Item_Armor_LeatherJacket');
equip(player, 'HeadTop', 'Item_Hat_Sakkat');
equip(player, 'Shoes', 'Item_Armor_Sandals');
equip(player, 'Garment', 'Item_Armor_Hood');

// Give starter appearance extras.
player.appearance.layers.hair = 'Hair_3';

// Arrows
player.ammunition = { itemId: 'Item_Ammo_Arrow', count: 5000 };

// Learn core Archer skills.
player.skills = {
  Skill_Archer_OwlsEye: 10,
  Skill_Archer_VulturesEye: 10,
  Skill_Archer_ImproveConcentration: 5,
  Skill_Archer_DoubleStrafe: 10,
  Skill_Archer_ArrowShower: 5,
};

// Potions
player.inventory.push({ uid: 'potion-1', itemId: 'Item_Consum_RedPotion', count: 50 });
player.inventory.push({ uid: 'potion-2', itemId: 'Item_Consum_OrangePotion', count: 10 });

recomputeCharacterStats(player);
player.hp = player.maxHp;
player.sp = player.maxSp;

// ============================================================================
// Build the world
// ============================================================================

const spawns: MobSpawn[] = [];
// Sprinkle Lunatics, Spores, Wolves, Savages along the lane.
const mobPool = [
  { mobId: 'Mob_Lunatic' as const, count: 12, range: [3, 60] as const },
  { mobId: 'Mob_Spore' as const, count: 10, range: [30, 120] as const },
  { mobId: 'Mob_Wolf' as const, count: 8, range: [80, 200] as const },
  { mobId: 'Mob_Savage' as const, count: 6, range: [150, 280] as const },
  { mobId: 'Mob_Eddga' as const, count: 1, range: [280, 281] as const },
];
for (const group of mobPool) {
  for (let i = 0; i < group.count; i++) {
    const x = group.range[0] + Math.floor(Math.random() * (group.range[1] - group.range[0]));
    spawns.push({
      x,
      mobId: group.mobId,
      respawnMs: 10_000,
      maxAlive: 3,
      dynamicSpawn: false,
    });
  }
}

const world = createWorld({
  seed: 1234,
  mapLength: 320,
  playerStartX: 2,
  spawns,
});
world.players.push(player);
player.position.x = world.map.playerStartX;

// ============================================================================
// AI strategies per character
// ============================================================================

const strategies = new Map<string, AiStrategy>();
let currentPresetId: keyof typeof PRESETS = 'aggressive';
let strategy = presetStrategy(PRESETS[currentPresetId]);
strategies.set(player.uid, strategy);

const rng: RngState = createRng(42);

// ============================================================================
// HUD: preset switcher
// ============================================================================

hud.innerHTML = `
  <div id="preset-bar">
    ${Object.values(PRESETS).map((p: { id: string; name: string }) => `
      <button data-preset="${p.id}" class="preset-btn">${p.name}</button>
    `).join('')}
  </div>
  <div id="preset-desc">${PRESETS[currentPresetId].description}</div>
`;

hud.querySelectorAll<HTMLButtonElement>('.preset-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const id = btn.dataset.preset as keyof typeof PRESETS;
    currentPresetId = id;
    strategy = presetStrategy(PRESETS[id]);
    strategies.set(player.uid, strategy);
    hud.querySelector<HTMLElement>('#preset-desc')!.textContent = PRESETS[id].description;
    hud.querySelectorAll('.preset-btn').forEach((b) => b.classList.toggle('active', b === btn));
  });
});

const firstBtn = hud.querySelector<HTMLButtonElement>('.preset-btn');
firstBtn?.classList.add('active');

// ============================================================================
// Game loop — fixed tick + interpolation render
// ============================================================================

let lastFrame = performance.now();
let accumulator = 0;
let pendingEvents: any[] = [];

function loop(now: number): void {
  const delta = now - lastFrame;
  lastFrame = now;
  accumulator += delta;

  // Cap catch-up to avoid spiral-of-death after tab switch.
  if (accumulator > 250) accumulator = 250;

  while (accumulator >= TICK_MS) {
    const events = stepWorld(world, strategies, rng);
    pendingEvents.push(...events);
    accumulator -= TICK_MS;
  }

  // Trim event log to last ~60 events (renderer only consumes recent ones).
  if (pendingEvents.length > 120) {
    pendingEvents = pendingEvents.slice(-120);
  }

  renderer.draw(world, pendingEvents);
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
