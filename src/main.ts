/**
 * Main entry point — bootstraps the engine, builds a starting world,
 * wires the renderer, runs the fixed-tick game loop, and mounts the UI.
 */

import './style.css';
import './ui/ui.css';

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
import { Ui } from './ui/state';
import { renderTown } from './ui/town';
import { renderStats } from './ui/stats-panel';
import { renderSkills } from './ui/skills-panel';
import { renderInventory } from './ui/inventory-panel';
import { renderClassChange } from './ui/classchange-panel';

// ============================================================================
// Boot
// ============================================================================

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const hud = document.querySelector<HTMLElement>('#hud')!;
const uiLayer = document.createElement('div');
uiLayer.id = 'ui-layer';
document.body.appendChild(uiLayer);

const sprites = new PlaceholderSpriteProvider();
const renderer = new CanvasRenderer(canvas, sprites);

window.addEventListener('resize', () => renderer.resize());

// ============================================================================
// Build a starter character
// ============================================================================

const player = createCharacter({ jobId: 'Archer', baseLevel: 5, jobLevel: 5 });

function equip(c: Character, slot: 'Weapon' | 'Armor' | 'HeadTop' | 'Shoes' | 'Garment', itemId: string): void {
  const def = ITEMS[itemId];
  if (!def) return;
  c.equipment[slot] = {
    uid: `${slot}-${c.uid}`,
    itemId,
    refine: 0,
    cards: [],
  };
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
player.appearance.layers.hair = 'Hair_3';

player.ammunition = { itemId: 'Item_Ammo_Arrow', count: 5000 };
player.skills = {
  Skill_Archer_OwlsEye: 10,
  Skill_Archer_VulturesEye: 10,
  Skill_Archer_ImproveConcentration: 5,
  Skill_Archer_DoubleStrafe: 10,
  Skill_Archer_ArrowShower: 5,
};
// A few spare stat points to play with in the panel.
player.statPoints = 30;
player.skillPoints = 15;

player.inventory.push({ uid: 'potion-1', itemId: 'Item_Consum_RedPotion', count: 50 });
player.inventory.push({ uid: 'potion-2', itemId: 'Item_Consum_OrangePotion', count: 10 });
// Spare gear to play with in the inventory panel.
player.inventory.push({
  uid: 'gift-bow-1', itemId: 'Item_Weapon_CrossBow', count: 1,
  instance: { uid: 'gift-bow-1', itemId: 'Item_Weapon_CrossBow', refine: 0, cards: [] },
});
player.inventory.push({
  uid: 'gift-hat-1', itemId: 'Item_Hat_Cap', count: 1,
  instance: { uid: 'gift-hat-1', itemId: 'Item_Hat_Cap', refine: 0, cards: [] },
});
player.inventory.push({ uid: 'jellopy-stack', itemId: 'Item_Jellopy', count: 12 });

recomputeCharacterStats(player);
player.hp = player.maxHp;
player.sp = player.maxSp;

// ============================================================================
// Build the world
// ============================================================================

const spawns: MobSpawn[] = [];
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
// AI strategies
// ============================================================================

const strategies = new Map<string, AiStrategy>();
let currentPresetId: keyof typeof PRESETS = 'aggressive';
strategies.set(player.uid, presetStrategy(PRESETS[currentPresetId]));

const rng: RngState = createRng(42);

// ============================================================================
// UI
// ============================================================================

const ui = new Ui(player);

function renderPresetBar(): void {
  hud.innerHTML = `
    <div id="top-bar">
      <button id="town-btn" class="ui-btn ui-btn-primary">🛖 Town</button>
    </div>
    <div id="preset-bar">
      ${Object.values(PRESETS).map((p: { id: string; name: string }) => `
        <button data-preset="${p.id}" class="preset-btn">${p.name}</button>
      `).join('')}
    </div>
    <div id="preset-desc">${PRESETS[currentPresetId].description}</div>
  `;
  hud.querySelector<HTMLButtonElement>('#town-btn')!.addEventListener('click', () => ui.go('town'));
  hud.querySelectorAll<HTMLButtonElement>('.preset-btn').forEach((btn) => {
    if (btn.dataset.preset === currentPresetId) btn.classList.add('active');
    btn.addEventListener('click', () => {
      const id = btn.dataset.preset as keyof typeof PRESETS;
      currentPresetId = id;
      strategies.set(player.uid, presetStrategy(PRESETS[id]));
      hud.querySelector<HTMLElement>('#preset-desc')!.textContent = PRESETS[id].description;
      hud.querySelectorAll('.preset-btn').forEach((b) => b.classList.toggle('active', b === btn));
    });
  });
}
renderPresetBar();

function renderScreens(state: Ui['state']): void {
  while (uiLayer.firstChild) uiLayer.removeChild(uiLayer.firstChild);
  if (state.screen === 'battle') {
    uiLayer.classList.remove('active');
    return;
  }
  uiLayer.classList.add('active');
  switch (state.screen) {
    case 'town':        renderTown(uiLayer, ui); break;
    case 'stats':       renderStats(uiLayer, ui); break;
    case 'skills':      renderSkills(uiLayer, ui); break;
    case 'inventory':   renderInventory(uiLayer, ui); break;
    case 'classchange': renderClassChange(uiLayer, ui); break;
    default: break;
  }
}
ui.subscribe(renderScreens);

// ============================================================================
// Game loop — fixed tick + interpolation render
// ============================================================================

let lastFrame = performance.now();
let accumulator = 0;
let pendingEvents: { kind: string; attackerUid?: string; targetUid?: string; damage?: number; isCrit?: boolean; tick: number }[] = [];

function loop(now: number): void {
  const delta = now - lastFrame;
  lastFrame = now;
  accumulator += delta;
  if (accumulator > 250) accumulator = 250;

  // Step the simulation only when not in a menu.
  if (!ui.state.paused) {
    while (accumulator >= TICK_MS) {
      const events = stepWorld(world, strategies, rng);
      pendingEvents.push(...events);
      accumulator -= TICK_MS;
    }
    if (pendingEvents.length > 120) {
      pendingEvents = pendingEvents.slice(-120);
    }
  } else {
    accumulator = 0;
  }

  renderer.draw(world, pendingEvents);
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
