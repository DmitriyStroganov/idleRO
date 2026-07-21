/**
 * Main entry point — bootstraps the engine, builds a starting world,
 * wires the renderer, runs the fixed-tick game loop, and mounts the UI.
 */

import './style.css';
import './ui/ui.css';

import { createCharacter, createWorld, stepWorld, recomputeCharacterStats } from '@engine/sim';
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
import { renderRefine } from './ui/refine-panel';
import { renderCardSocket } from './ui/card-panel';
import { renderSettings, type SaveActions } from './ui/settings-panel';
import {
  renderAiEditor,
  setInitialConfig,
  type AiEditorActions,
} from './ui/ai-editor';
import {
  saveGame,
  loadGame,
  deleteSave,
  loadSettings,
  saveSettings,
  type Settings,
} from '@persistence/save';
import { priorityListStrategy, type PriorityListConfig } from '@ai/priority-list';
import { presetStrategy } from '@ai/preset-executor';
import { PRESETS } from '../src/ai/strategy';
import type { AiStrategy } from '../src/ai/strategy';

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
//
// Default: pure Novice Lv1/Job1 with starter gear only (Novice Knife +
// Cotton Shirt + 10 Red Potions). No skills, no allocated stat points.
// The player learns skills and changes class via the Town NPCs.
//
// For development / quick testing, append ?demo=archer|hunter|sniper to the
// URL to start with a pre-levelled character. Demo mode is just a function
// call — safe to remove once we're happy with the fresh-start experience.

type DemoKind = 'archer' | 'hunter' | 'sniper';
const demoParam = new URLSearchParams(window.location.search).get('demo');
const DEMO_MODE: DemoKind | null =
  demoParam === 'archer' || demoParam === 'hunter' || demoParam === 'sniper' ? demoParam : null;

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

const player = createCharacter({
  jobId: DEMO_MODE ?? 'Novice',
  baseLevel: DEMO_MODE === 'sniper' ? 80 : DEMO_MODE === 'hunter' ? 55 : DEMO_MODE === 'archer' ? 20 : 1,
  jobLevel: DEMO_MODE === 'sniper' ? 50 : DEMO_MODE === 'hunter' ? 40 : DEMO_MODE === 'archer' ? 20 : 1,
});
player.appearance.layers.hair = 'Hair_3';

if (DEMO_MODE) {
  applyDemoSetup(player, DEMO_MODE);
} else {
  // Fresh Novice start — gear only, no skills, no allocated points.
  equip(player, 'Weapon', 'Item_Weapon_NoviceKnife');
  equip(player, 'Armor', 'Item_Armor_CottonShirt');
  player.inventory.push({ uid: 'potion-starter', itemId: 'Item_Consum_RedPotion', count: 10 });
  player.zeny = 500;
}

recomputeCharacterStats(player);
player.hp = player.maxHp;
player.sp = player.maxSp;

function applyDemoSetup(c: Character, kind: DemoKind): void {
  c.statPoints = 60;
  c.skillPoints = kind === 'sniper' ? 50 : kind === 'hunter' ? 30 : 20;
  c.zeny = 50_000;
  c.appearance.layers.hair = 'Hair_3';

  // Pre-allocate DEX/AGI for ranged damage.
  c.stats.base.DEX = kind === 'sniper' ? 80 : kind === 'hunter' ? 60 : 40;
  c.stats.base.AGI = kind === 'sniper' ? 70 : kind === 'hunter' ? 50 : 30;
  c.stats.base.VIT = 20;
  c.stats.base.STR = 1;
  c.stats.base.INT = 1;
  c.stats.base.LUK = kind === 'sniper' ? 40 : 10;

  // Equipment appropriate to the tier.
  if (kind === 'sniper') {
    equip(c, 'Weapon', 'Item_Weapon_HunterBow');
  } else if (kind === 'hunter') {
    equip(c, 'Weapon', 'Item_Weapon_GakkungBow');
  } else {
    equip(c, 'Weapon', 'Item_Weapon_CompositeBow');
  }
  equip(c, 'Armor', kind === 'archer' ? 'Item_Armor_LeatherJacket' : 'Item_Armor_Tights');
  equip(c, 'HeadTop', 'Item_Hat_Sakkat');
  equip(c, 'Shoes', 'Item_Armor_Sandals');
  equip(c, 'Garment', 'Item_Armor_Hood');
  c.ammunition = { itemId: 'Item_Ammo_Arrow', count: 5000 };

  // Skills the player would plausibly have learned by this tier.
  c.skills = {
    Skill_Archer_OwlsEye: 10,
    Skill_Archer_VulturesEye: 10,
    Skill_Archer_ImproveConcentration: 10,
    Skill_Archer_DoubleStrafe: 10,
    Skill_Archer_ArrowShower: 5,
  };
  if (kind === 'hunter' || kind === 'sniper') {
    c.skills.Skill_Hunter_BlitzBeat = 5;
    c.skills.Skill_Hunter_AnkleSnare = 5;
    c.skills.Skill_Hunter_SteelCrow = 10;
  }
  if (kind === 'sniper') {
    c.skills.Skill_Sniper_TrueSight = 10;
    c.skills.Skill_Sniper_FalconEyes = 5;
    c.skills.Skill_Sniper_FocusedArrowStrike = 5;
    c.skills.Skill_Sniper_Sharpshooting = 5;
  }

  // Some consumables + a spare carded bow to play with in the inventory panel.
  c.inventory.push({ uid: 'potion-1', itemId: 'Item_Consum_RedPotion', count: 50 });
  c.inventory.push({ uid: 'potion-2', itemId: 'Item_Consum_OrangePotion', count: 10 });
  c.inventory.push({
    uid: 'gift-bow-1', itemId: 'Item_Weapon_CrossBow', count: 1,
    instance: {
      uid: 'gift-bow-1', itemId: 'Item_Weapon_CrossBow', refine: 4,
      cards: ['Card_Hydra', 'Card_Hydra', 'Card_SkeletonWorker'],
    },
  });
  c.inventory.push({ uid: 'gift-card', itemId: 'Card_Andre', count: 3 });
  c.inventory.push({ uid: 'jellopy-stack', itemId: 'Item_Jellopy', count: 12 });
}

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

function applyBehavior(): void {
  if (player.behavior?.kind === 'priorityList') {
    strategies.set(player.uid, priorityListStrategy(player.behavior.config));
    setInitialConfig(player.behavior.config);
  } else {
    const pid = (player.behavior?.kind === 'preset' ? player.behavior.presetId : currentPresetId) as keyof typeof PRESETS;
    currentPresetId = pid;
    strategies.set(player.uid, presetStrategy(PRESETS[pid]));
  }
}
applyBehavior();

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
      // Switching back to a preset wipes the priority-list behavior.
      player.behavior = { kind: 'preset', presetId: id };
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
    case 'refine':      renderRefine(uiLayer, ui); break;
    case 'cards':       renderCardSocket(uiLayer, ui); break;
    case 'ai':          renderAiEditor(uiLayer, ui, aiEditorActions); break;
    case 'settings':    renderSettings(uiLayer, ui, settingsActions, settings); break;
    default: break;
  }
}

const settings: Settings = loadSettings();

const settingsActions: SaveActions = {
  saveToSlot: (slot: string) => {
    saveGame(slot, player, world, currentPresetId);
    flash(`Saved to ${slot}`);
    ui.refresh();
  },
  loadFromSlot: (slot: string) => {
    const data = loadGame(slot);
    // Mutate live player/world in place so existing references stay valid.
    Object.assign(player, data.character);
    // World is replaced wholesale — also need to keep `player` reference.
    data.world.players[0] = player;
    Object.assign(world, data.world);
    currentPresetId = data.presetId as keyof typeof PRESETS;
    applyBehavior();
    ui.go('battle');
    flash(`Loaded ${data.name}`);
  },
  updateSettings: (s: Settings) => {
    Object.assign(settings, s);
    saveSettings(s);
  },
  resetGame: () => {
    for (const s of ['slot1', 'slot2', 'slot3']) deleteSave(s);
    location.reload();
  },
};

function flash(msg: string): void {
  const toast = document.createElement('div');
  toast.className = 'toast toast-success';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 1500);
}

const aiEditorActions: AiEditorActions = {
  apply: (config: PriorityListConfig) => {
    player.behavior = { kind: 'priorityList', config };
    strategies.set(player.uid, priorityListStrategy(config));
  },
  save: (config: PriorityListConfig) => {
    player.behavior = { kind: 'priorityList', config };
    strategies.set(player.uid, priorityListStrategy(config));
    try {
      saveGame('autosave', player, world, currentPresetId);
    } catch {
      // ignore — Settings panel surfaces quota errors
    }
  },
};

ui.subscribe(renderScreens);

// ============================================================================
// Auto-save
// ============================================================================

let lastAutoSaveAt = 0;
function maybeAutoSave(): void {
  if (!settings.autoSave) return;
  const now = Date.now();
  if (now - lastAutoSaveAt < settings.autoSaveIntervalMs) return;
  lastAutoSaveAt = now;
  try {
    saveGame('autosave', player, world, currentPresetId);
  } catch (e) {
    // ignore quota errors silently — they surface via the Settings panel
  }
}

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
    maybeAutoSave();
  } else {
    accumulator = 0;
  }

  renderer.draw(world, pendingEvents);
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
