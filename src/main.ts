/**
 * idleRO prototype — client-side .spr/.act rendering.
 * No pre-rendered PNGs, no external services.
 * Sprites are parsed and composited directly in the browser.
 */

import './style.css';
import { RoRenderer } from './ro/renderer';
import { registry } from './ro/registry';

// ============================================================================
// Boot
// ============================================================================

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const hud = document.querySelector<HTMLElement>('#hud')!;
hud.innerHTML = '';
hud.style.display = 'none';

const ctx = canvas.getContext('2d')!;

function resize(): void {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
}
resize();
window.addEventListener('resize', resize);

// ============================================================================
// Constants
// ============================================================================

const WALK_SPEED = 60;
const FRAME_DELAY_MS = 130;
const PLAYER_ATTACK_MS = 800;
const MOB_ATTACK_MS = 1200;
const FIGHT_DISTANCE = 120;
const HP_REGEN_PER_SEC = 2;
const SIZE_MOD = 1 / 1.5;     // global size modifier (1.5x smaller)
const NOVICE_SCALE = 3.0 * SIZE_MOD;
const NOVICE_SHADOW = 28 * SIZE_MOD;
const PORING_SCALE = 2.5 * SIZE_MOD;
const PORING_SHADOW = 28 * SIZE_MOD;
const SPRITE_Y_OFFSET = 40;

// Action indices (animation_type * 8 + direction):
// direction 6 = East (facing right)
const ACT_WALK      = 14;   // 1*8+6
const ACT_STANDBY   = 38;   // 4*8+6
const ACT_ATK_DAG   = 86;   // 10*8+6 (attack variant 1)
const ACT_DEAD      = 70;   // 8*8+6

// Poring actions (direction 6):
const P_ACT_IDLE   = 6;
const P_ACT_WALK   = 14;
const P_ACT_ATK    = 22;   // 2*8+6
const P_ACT_DEAD   = 38;   // 4*8+6

// ============================================================================
// Speed control
// ============================================================================

const SPEED_KEY = 'idlero_speed';
let speedMul = parseFloat(localStorage.getItem(SPEED_KEY) ?? '1') || 1;
let animTime = 0;

const speedSlider = document.createElement('input');
speedSlider.type = 'range';
speedSlider.min = '1';
speedSlider.max = '50';
speedSlider.value = String(speedMul);
speedSlider.step = '1';
speedSlider.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);width:300px;z-index:100;accent-color:#4a90e2;';
const speedLabel = document.createElement('div');
speedLabel.style.cssText = 'position:fixed;bottom:44px;left:50%;transform:translateX(-50%);color:#fff;font:13px monospace;z-index:100;text-shadow:0 0 4px #000;pointer-events:none;';
function updateSpeedLabel(): void { speedLabel.textContent = `Speed ×${speedMul}`; }
speedSlider.addEventListener('input', () => {
  speedMul = parseInt(speedSlider.value, 10);
  localStorage.setItem(SPEED_KEY, String(speedMul));
  updateSpeedLabel();
});
updateSpeedLabel();
document.body.appendChild(speedSlider);
document.body.appendChild(speedLabel);

// ============================================================================
// Renderers
// ============================================================================

const noviceRenderer = new RoRenderer();
const poringRenderer = new RoRenderer();
let loaded = false;

// Equipment state
const WEAPON_KEYS = ['dagger', 'sword', 'axe', 'mace', 'rod'];
let weaponIdx = 0;
let shieldOn = false;
const HEADGEAR_TOP = [null, 'santa_hat'];
const HEADGEAR_MID = [null, 'glasses'];
const HEADGEAR_LOW = [null, 'gas_mask'];
let hgTopIdx = 0, hgMidIdx = 0, hgLowIdx = 0;

async function loadSprites(): Promise<void> {
  // Load core sprites via registry (cached)
  const [body, head, weapon] = await Promise.all([
    registry.fetch('body/novice_male'),
    registry.fetch('head/head2_male'),
    registry.fetch(`weapon/novice_${WEAPON_KEYS[weaponIdx]}`),
  ]);
  noviceRenderer.loadLayer('body', body.spr, body.act);
  noviceRenderer.loadLayer('head', head.spr, head.act);
  noviceRenderer.loadLayer('weapon', weapon.spr, weapon.act);

  const poring = await registry.fetch('mob/poring');
  poringRenderer.loadLayer('body', poring.spr, poring.act);

  loaded = true;
  console.log('Sprites loaded ✓');
}
loadSprites().catch(err => console.error('Sprite load failed:', err));

// ============================================================================
// Equipment switching via registry (lazy-load + cache)
// ============================================================================

async function equipWeapon(key: string): Promise<void> {
  const data = await registry.fetch(`weapon/novice_${key}`);
  noviceRenderer.unloadLayer('weapon');
  noviceRenderer.loadLayer('weapon', data.spr, data.act);
}

async function toggleShield(on: boolean): Promise<void> {
  if (on) {
    const data = await registry.fetch('shield/guard');
    noviceRenderer.loadLayer('shield', data.spr, data.act);
  } else {
    noviceRenderer.unloadLayer('shield');
  }
}

async function setHeadgear(slot: 'top' | 'mid' | 'low', key: string | null): Promise<void> {
  const layerKey = `headgear-${slot}`;
  noviceRenderer.unloadLayer(layerKey);
  if (key) {
    const data = await registry.fetch(`headgear/${key}`);
    noviceRenderer.loadLayer(layerKey, data.spr, data.act);
  }
}

// ============================================================================
// Test buttons
// ============================================================================

function makeBtn(label: string, onClick: () => void): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.textContent = label;
  btn.style.cssText = 'position:fixed;z-index:100;font:12px monospace;padding:5px 10px;background:rgba(0,0,0,0.7);color:#fff;border:1px solid #4a90e2;border-radius:6px;cursor:pointer;';
  btn.addEventListener('click', onClick);
  return btn;
}

// Weapon cycle button
const weaponBtn = makeBtn(`⚔ ${WEAPON_KEYS[weaponIdx]}`, async () => {
  weaponIdx = (weaponIdx + 1) % WEAPON_KEYS.length;
  weaponBtn.textContent = `⚔ ${WEAPON_KEYS[weaponIdx]}...`;
  await equipWeapon(WEAPON_KEYS[weaponIdx]!);
  weaponBtn.textContent = `⚔ ${WEAPON_KEYS[weaponIdx]}`;
});
weaponBtn.style.top = '12px';
weaponBtn.style.right = '12px';
document.body.appendChild(weaponBtn);

// Shield toggle button
const shieldBtn = makeBtn('🛡 off', async () => {
  shieldOn = !shieldOn;
  shieldBtn.textContent = `🛡 ${shieldOn ? 'on...' : 'off'}`;
  await toggleShield(shieldOn);
  shieldBtn.textContent = `🛡 ${shieldOn ? 'on' : 'off'}`;
});
shieldBtn.style.top = '44px';
shieldBtn.style.right = '12px';
document.body.appendChild(shieldBtn);

// Headgear top button
const hgTopBtn = makeBtn(`🎩 top: ${HEADGEAR_TOP[hgTopIdx] ?? 'none'}`, async () => {
  hgTopIdx = (hgTopIdx + 1) % HEADGEAR_TOP.length;
  const key = HEADGEAR_TOP[hgTopIdx];
  hgTopBtn.textContent = `🎩 top: ${key ?? 'none'}...`;
  await setHeadgear('top', key);
  hgTopBtn.textContent = `🎩 top: ${key ?? 'none'}`;
});
hgTopBtn.style.top = '76px';
hgTopBtn.style.right = '12px';
document.body.appendChild(hgTopBtn);

// Headgear mid button
const hgMidBtn = makeBtn(`👓 mid: ${HEADGEAR_MID[hgMidIdx] ?? 'none'}`, async () => {
  hgMidIdx = (hgMidIdx + 1) % HEADGEAR_MID.length;
  const key = HEADGEAR_MID[hgMidIdx];
  hgMidBtn.textContent = `👓 mid: ${key ?? 'none'}...`;
  await setHeadgear('mid', key);
  hgMidBtn.textContent = `👓 mid: ${key ?? 'none'}`;
});
hgMidBtn.style.top = '108px';
hgMidBtn.style.right = '12px';
document.body.appendChild(hgMidBtn);

// Headgear low button
const hgLowBtn = makeBtn(`😷 low: ${HEADGEAR_LOW[hgLowIdx] ?? 'none'}`, async () => {
  hgLowIdx = (hgLowIdx + 1) % HEADGEAR_LOW.length;
  const key = HEADGEAR_LOW[hgLowIdx];
  hgLowBtn.textContent = `😷 low: ${key ?? 'none'}...`;
  await setHeadgear('low', key);
  hgLowBtn.textContent = `😷 low: ${key ?? 'none'}`;
});
hgLowBtn.style.top = '140px';
hgLowBtn.style.right = '12px';
document.body.appendChild(hgLowBtn);

// ============================================================================
// Game State
// ============================================================================

type Phase = 'walking' | 'fighting' | 'mob_dead' | 'player_dead';

interface Fighter {
  hp: number; maxHp: number; sp?: number; maxSp?: number;
  atk: number; nextAttackAt: number; dead: boolean;
}

let worldOffset = 0;
let phase: Phase = 'walking';
let playerAnimAction = ACT_WALK;
let mobAnimAction = P_ACT_WALK;

const player: Fighter = {
  hp: 50, maxHp: 50, sp: 10, maxSp: 10,
  atk: 7, nextAttackAt: 0, dead: false,
};

let mob: Fighter & { screenX: number } = {
  hp: 30, maxHp: 30, atk: 4, nextAttackAt: 0, dead: false, screenX: 0,
};

let phaseTimer = 0;

function spawnMob(): void {
  mob = { hp: 30, maxHp: 30, atk: 4, nextAttackAt: 0, dead: false, screenX: window.innerWidth + 60 };
}
function resetPlayer(): void {
  player.hp = player.maxHp; player.dead = false;
}
spawnMob();

function walkFrame(frameCount: number): number {
  if (frameCount <= 0) return 0;
  return Math.floor(animTime / FRAME_DELAY_MS) % frameCount;
}

// ============================================================================
// Update
// ============================================================================

function update(dt: number, now: number): void {
  if (!loaded) return;
  const sdt = dt * speedMul;
  animTime += sdt * 1000;
  const charX = window.innerWidth / 2;

  switch (phase) {
    case 'walking': {
      worldOffset += WALK_SPEED * sdt;
      playerAnimAction = ACT_WALK;
      mobAnimAction = P_ACT_WALK;
      if (player.hp < player.maxHp) player.hp = Math.min(player.maxHp, player.hp + HP_REGEN_PER_SEC * sdt);
      mob.screenX -= 50 * sdt;
      if (mob.screenX - charX <= FIGHT_DISTANCE) {
        mob.screenX = charX + FIGHT_DISTANCE;
        phase = 'fighting';
        playerAnimAction = ACT_STANDBY;
        mobAnimAction = P_ACT_IDLE;
        player.nextAttackAt = now + 300 / speedMul;
        mob.nextAttackAt = now + 600 / speedMul;
      }
      break;
    }
    case 'fighting': {
      if (!player.dead && now >= player.nextAttackAt) {
        playerAnimAction = ACT_ATK_DAG;
        mob.hp -= player.atk + Math.floor(Math.random() * 3);
        player.nextAttackAt = now + PLAYER_ATTACK_MS / speedMul;
        setTimeout(() => { if (phase === 'fighting' && !player.dead) playerAnimAction = ACT_STANDBY; }, 200 / speedMul);
        if (mob.hp <= 0) { mob.hp = 0; mob.dead = true; mobAnimAction = P_ACT_DEAD; phase = 'mob_dead'; phaseTimer = now + 1200 / speedMul; }
      }
      if (!mob.dead && now >= mob.nextAttackAt) {
        mobAnimAction = P_ACT_ATK;
        player.hp -= mob.atk + Math.floor(Math.random() * 2);
        mob.nextAttackAt = now + MOB_ATTACK_MS / speedMul;
        setTimeout(() => { if (phase === 'fighting' && !mob.dead) mobAnimAction = P_ACT_IDLE; }, 300 / speedMul);
        if (player.hp <= 0) { player.hp = 0; player.dead = true; playerAnimAction = ACT_DEAD; phase = 'player_dead'; phaseTimer = now + 3000 / speedMul; }
      }
      break;
    }
    case 'mob_dead': if (now >= phaseTimer) { spawnMob(); phase = 'walking'; playerAnimAction = ACT_WALK; } break;
    case 'player_dead': if (now >= phaseTimer) { resetPlayer(); spawnMob(); phase = 'walking'; playerAnimAction = ACT_WALK; } break;
  }
}

// ============================================================================
// Drawing helpers
// ============================================================================

function drawHpBar(cx: number, topY: number, frac: number, color: string): void {
  const bw = 50, bh = 5;
  ctx.fillStyle = '#000'; ctx.fillRect(cx - bw/2 - 1, topY - 1, bw + 2, bh + 2);
  ctx.fillStyle = '#400'; ctx.fillRect(cx - bw/2, topY, bw, bh);
  ctx.fillStyle = color; ctx.fillRect(cx - bw/2, topY, bw * Math.max(0, frac), bh);
}

// ============================================================================
// Day/night + background (same as before)
// ============================================================================

let dayPhase = 0;
const DAY_LENGTH_SEC = 60;

interface Star { x: number; y: number; size: number; tw: number; }
let stars: Star[] = [];
let starNight = -1;

function regenStars(): void {
  stars = [];
  for (let i = 0; i < 80; i++) stars.push({ x: Math.random(), y: Math.random() * 0.6, size: 0.5 + Math.random() * 1.5, tw: Math.random() * 6.28 });
}

interface Cloud { x: number; y: number; scale: number; speed: number; puffs: {dx:number;dy:number;r:number}[]; }
const clouds: Cloud[] = [];
for (let i = 0; i < 6; i++) {
  const puffs: {dx:number;dy:number;r:number}[] = [];
  const np = 3 + Math.floor(Math.random() * 3);
  let cx = 0;
  for (let p = 0; p < np; p++) { const r = 12 + Math.random() * 10; puffs.push({ dx: cx, dy: (Math.random()-0.5)*8, r }); cx += r * 0.9; }
  for (const p of puffs) p.dx -= cx / 2;
  clouds.push({ x: Math.random() * 2, y: 0.08 + Math.random() * 0.18, scale: 0.7 + Math.random() * 0.6, speed: 0.003 + Math.random() * 0.005, puffs });
}

function lerpHex(a: string, b: string, t: number): string {
  const pa = [parseInt(a.slice(1,3),16), parseInt(a.slice(3,5),16), parseInt(a.slice(5,7),16)];
  const pb = [parseInt(b.slice(1,3),16), parseInt(b.slice(3,5),16), parseInt(b.slice(5,7),16)];
  return `rgb(${Math.round(pa[0]!+(pb[0]!-pa[0]!)*t)},${Math.round(pa[1]!+(pb[1]!-pa[1]!)*t)},${Math.round(pa[2]!+(pb[2]!-pa[2]!)*t)})`;
}

function skyColours(p: number): { top: string; bottom: string } {
  const keys = [
    { p:0.00,t:'#1a1a3a',b:'#e87b3a' },{ p:0.10,t:'#5a8acc',b:'#f5c89a' },
    { p:0.25,t:'#4a90e2',b:'#a8d8f5' },{ p:0.40,t:'#4a90e2',b:'#b0d8f0' },
    { p:0.50,t:'#d97b3a',b:'#f5d76b' },{ p:0.58,t:'#7a1d3a',b:'#e85a2a' },
    { p:0.65,t:'#0a0a1f',b:'#2a1a3a' },{ p:0.75,t:'#050510',b:'#0d0d20' },
    { p:0.90,t:'#0a0a1f',b:'#1a1530' },{ p:1.00,t:'#1a1a3a',b:'#e87b3a' },
  ];
  for (let i = 0; i < keys.length - 1; i++) {
    if (p >= keys[i]!.p && p <= keys[i+1]!.p) {
      const span = keys[i+1]!.p - keys[i]!.p;
      const t = span > 0 ? (p - keys[i]!.p) / span : 0;
      return { top: lerpHex(keys[i]!.t, keys[i+1]!.t, t), bottom: lerpHex(keys[i]!.b, keys[i+1]!.b, t) };
    }
  }
  return { top: keys[0]!.t, bottom: keys[0]!.b };
}

function darkness(p: number): number {
  if (p < 0.08) return 1 - p / 0.08;
  if (p < 0.48) return 0;
  if (p < 0.62) return (p - 0.48) / 0.14;
  if (p < 0.92) return 1;
  return 1 - (p - 0.92) / 0.08;
}

function drawCelestial(w: number, h: number): void {
  const dk = darkness(dayPhase);
  if (dayPhase > 0.03 && dayPhase < 0.57) {
    const t = (dayPhase - 0.03) / 0.54;
    const sx = w * (0.1 + t * 0.8), sy = h * (0.7 - Math.sin(t * Math.PI) * 0.55);
    const low = t < 0.12 || t > 0.88;
    const gr = low ? 50 : 35;
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, gr * 2);
    const gc = low ? 'rgba(255,140,60,' : 'rgba(255,240,180,';
    grad.addColorStop(0, gc + '0.5)'); grad.addColorStop(0.4, gc + '0.2)'); grad.addColorStop(1, gc + '0)');
    ctx.fillStyle = grad; ctx.fillRect(sx-gr*2, sy-gr*2, gr*4, gr*4);
    ctx.fillStyle = low ? '#ff9944' : '#fff4b8';
    ctx.beginPath(); ctx.arc(sx, sy, low ? 18 : 22, 0, Math.PI*2); ctx.fill();
  }
  if (dayPhase > 0.58 && dayPhase < 1.0) {
    const t = (dayPhase - 0.58) / 0.42;
    const mx = w * (0.1 + t * 0.8), my = h * (0.65 - Math.sin(t * Math.PI) * 0.5);
    const grad = ctx.createRadialGradient(mx, my, 0, mx, my, 60);
    grad.addColorStop(0, 'rgba(220,220,240,0.3)'); grad.addColorStop(1, 'rgba(220,220,240,0)');
    ctx.fillStyle = grad; ctx.fillRect(mx-60, my-60, 120, 120);
    ctx.fillStyle = '#e8e8f0'; ctx.beginPath(); ctx.arc(mx, my, 16, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = 'rgba(160,160,180,0.5)';
    ctx.beginPath(); ctx.arc(mx-5,my-3,3,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(mx+4,my+2,2.5,0,Math.PI*2); ctx.fill();
  }
  const sa = Math.max(0, (dk - 0.3) / 0.7);
  if (sa > 0.01) {
    const cn = Math.floor(dayPhase > 0.5 ? dayPhase * 10 : (dayPhase + 1) * 10);
    if (cn !== starNight) { starNight = cn; regenStars(); }
    for (const s of stars) {
      ctx.globalAlpha = sa * (0.5 + 0.5 * Math.sin(animTime * 0.003 + s.tw));
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(s.x * w, s.y * h, s.size, 0, Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

function drawClouds(w: number, h: number, dt: number): void {
  const dk = darkness(dayPhase);
  const ca = 0.6 * (1 - dk * 0.7);
  for (const c of clouds) {
    c.x += c.speed * dt * speedMul;
    if (c.x > 1.3) c.x = -0.3;
    const cx = c.x * w, cy = c.y * h;
    ctx.fillStyle = `rgba(255,255,255,${ca})`;
    for (const p of c.puffs) { ctx.beginPath(); ctx.arc(cx+p.dx*c.scale, cy+p.dy*c.scale, p.r*c.scale, 0, Math.PI*2); ctx.fill(); }
  }
}

function rand(seed: number): number { const n = Math.sin(seed * 12.9898) * 43758.5453; return n - Math.floor(n); }

function ridgeY(x: number, baseY: number, peakH: number, freq: number, li: number, trees: {x:number;h:number;w:number}[]): number {
  let y = baseY - peakH - Math.sin(x*freq+li*3)*peakH*0.4 - Math.sin(x*freq*2.7+li*7)*peakH*0.2 - Math.sin(x*freq*0.5)*peakH*0.3;
  for (const t of trees) { const dx = x - t.x; if (Math.abs(dx) < t.w) { const sp = t.h*(1-Math.abs(dx)/t.w); y -= Math.max(sp, Math.max(0,sp-t.h*0.35)*0.7+t.h*0.15, Math.max(0,sp-t.h*0.6)*0.5+t.h*0.25); } }
  return y;
}

function drawMountains(w: number, gy: number): void {
  const layers = [
    { baseY:gy-6, peakH:130, freq:0.0035, li:0, fill:'#6b7e96', ridge:'#566b85', treeCount:8, treeMinH:8, treeMaxH:16, treeW:5, parallax:0.125 },
    { baseY:gy-2, peakH:85, freq:0.0055, li:1, fill:'#4f6e5a', ridge:'#3a5745', treeCount:12, treeMinH:12, treeMaxH:24, treeW:8, parallax:0.25 },
    { baseY:gy, peakH:50, freq:0.009, li:2, fill:'#386b3d', ridge:'#274f2e', treeCount:10, treeMinH:18, treeMaxH:36, treeW:14, parallax:0.5 },
  ];
  for (const L of layers) {
    const trees: {x:number;h:number;w:number}[] = [];
    for (let i = 0; i < L.treeCount; i++) trees.push({ x: rand(i*7.3+L.li*100)*w*3, h: L.treeMinH+rand(i*13.7+L.li*50)*(L.treeMaxH-L.treeMinH), w: L.treeW });
    const off = worldOffset * L.parallax;
    ctx.fillStyle = L.fill; ctx.beginPath(); ctx.moveTo(0, L.baseY);
    for (let sx = 0; sx <= w; sx += 2) ctx.lineTo(sx, ridgeY(sx+off, L.baseY, L.peakH, L.freq, L.li, trees));
    ctx.lineTo(w, L.baseY+50); ctx.lineTo(0, L.baseY+50); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = L.ridge; ctx.lineWidth = 1.5; ctx.beginPath();
    let first = true;
    for (let sx = 0; sx <= w; sx += 2) { const y = ridgeY(sx+off, L.baseY, L.peakH, L.freq, L.li, trees); if (first) { ctx.moveTo(sx,y); first=false; } else ctx.lineTo(sx,y); }
    ctx.stroke();
  }
}

// ============================================================================
// Main loop
// ============================================================================

let lastFrame = performance.now();

function loop(now: number): void {
  const dt = (now - lastFrame) / 1000;
  lastFrame = now;

  update(dt, now);

  const w = window.innerWidth, h = window.innerHeight, groundY = h - 80;

  // Day phase
  dayPhase = (dayPhase + dt * speedMul / DAY_LENGTH_SEC) % 1;
  const sc = skyColours(dayPhase);

  // Sky
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, sc.top); grad.addColorStop(0.65, sc.bottom); grad.addColorStop(1, sc.bottom);
  ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);

  drawCelestial(w, h);
  drawClouds(w, h, dt);
  drawMountains(w, groundY);

  // Ground
  ctx.fillStyle = '#4a6f3e'; ctx.fillRect(0, groundY, w, h - groundY);
  ctx.fillStyle = '#5a7f4e'; ctx.fillRect(0, groundY, w, 6);

  // Distance markers
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  const ms = 240;
  for (let mx = Math.floor(worldOffset/ms)*ms; mx < worldOffset+w; mx += ms) ctx.fillRect(mx-worldOffset, groundY, 1, h-groundY);

  // --- Draw entities using RoRenderer ---
  if (loaded) {
    // Mob (Poring)
    if (!mob.dead || phase === 'mob_dead') {
      const pFrameCount = poringRenderer.frameCount(mobAnimAction);
      const pFrame = walkFrame(pFrameCount);
      poringRenderer.draw(ctx, mobAnimAction, pFrame, mob.screenX, groundY + SPRITE_Y_OFFSET, PORING_SCALE, true, PORING_SHADOW);
      if (!mob.dead) {
        const pTop = poringRenderer.getTopY(mobAnimAction, pFrame) * PORING_SCALE;
        drawHpBar(mob.screenX, groundY + SPRITE_Y_OFFSET + pTop - 10, mob.hp / mob.maxHp, '#e33');
      }
    }

    // Player (Novice)
    const charX = w / 2;
    const nFrameCount = noviceRenderer.frameCount(playerAnimAction);
    const nFrame = walkFrame(nFrameCount);
    noviceRenderer.draw(ctx, playerAnimAction, nFrame, charX, groundY + SPRITE_Y_OFFSET, NOVICE_SCALE, false, NOVICE_SHADOW);
    if (!player.dead) {
      const nTop = noviceRenderer.getTopY(playerAnimAction, nFrame) * NOVICE_SCALE;
      drawHpBar(charX, groundY + SPRITE_Y_OFFSET + nTop - 10, player.hp / player.maxHp, '#e44');
    }
  } else {
    // Loading indicator
    ctx.fillStyle = '#fff'; ctx.font = '14px monospace'; ctx.textAlign = 'center';
    ctx.fillText('Loading sprites...', w / 2, h / 2);
    ctx.textAlign = 'start';
  }

  // Phase label
  ctx.fillStyle = '#fff'; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center';
  const label = phase === 'walking' ? '🚶 Exploring...' : phase === 'fighting' ? '⚔ Battle!' : phase === 'mob_dead' ? '💀 Victory!' : '☠ You died — respawning...';
  ctx.fillText(label, w / 2, 30);
  ctx.textAlign = 'start';

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
