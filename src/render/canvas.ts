/**
 * Canvas renderer for idleRO — side-scroller with day-night cycle.
 *
 * Layer order (back to front):
 *   1. Sky gradient (vertical)
 *   2. Celestial body (sun / moon) + glow
 *   3. Stars (visible at night / dawn / dusk)
 *   4. Parallax silhouettes (3 layers)
 *   5. Weather (back particles — snow, leaves)
 *   6. Ground band
 *   7. World-space layer (after camera transform):
 *        - dropped items
 *        - entity shadows
 *        - entities (monsters + player) with phase tint
 *        - cast bars + HP/SP bars + names
 *        - floating damage texts
 *   8. Weather (front particles — rain)
 *   9. HUD (top-left HP/SP/EXP, top-right tick/monsters)
 *  10. Twilight flash overlay (level-up)
 *
 * The "time of day" is derived from EXP progress to next level:
 *   0%   = dawn
 *   50%  = noon
 *   95%  = sunset
 *   99%  = twilight (about to level up)
 *   → level up fires a brief purple/gold flash, then back to dawn.
 */

import type {
  Character,
  DroppedItem,
  Monster,
  World,
} from '@engine/types';
import type { SpriteProvider } from './sprites';
import { drawComposite } from './composite';
import { MOBS } from '@data/mobs';
import { ITEMS } from '@data/items';
import { nextBaseLevelExp } from '@data/jobs';
import { computePhase, STARS, type DayPhase } from './sky';
import { drawParallax } from './parallax';
import { drawEntityShadow, applyEntityTint, drawTwilightFlash } from './lighting';
import { Weather } from './weather';

const CELL_PX = 48;
const ENTITY_FRAME_H = 64;

export interface FloatingText {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  bornAt: number;
  ttl: number;
}

export class CanvasRenderer {
  private ctx: CanvasRenderingContext2D;
  private viewW = 0;
  private viewH = 0;
  private cameraX = 0;
  private floatingTexts: FloatingText[] = [];
  private nextFloatingId = 1;
  private lastLevelSeen: number | null = null;
  private levelFlashAt = 0;
  private readonly LEVEL_FLASH_TTL = 1800;
  private weather = new Weather('clear', 0, 7);
  private lastFrameTime = performance.now();

  constructor(
    private canvas: HTMLCanvasElement,
    private sprites: SpriteProvider,
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D context unavailable');
    this.ctx = ctx;
    this.resize();
  }

  resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.viewW = w;
    this.viewH = h;
  }

  pushFloatingText(worldX: number, worldYBottom: number, text: string, color: string): void {
    this.floatingTexts.push({
      id: this.nextFloatingId++,
      x: worldX,
      y: worldYBottom,
      text,
      color,
      bornAt: performance.now(),
      ttl: 900,
    });
  }

  /** Public so callers can override per-map weather. */
  setWeather(kind: 'clear' | 'rain' | 'snow' | 'leaves', intensity = 0.5): void {
    this.weather.setWeather(kind, intensity);
  }

  draw(world: World, eventLog: { kind: string; attackerUid?: string; targetUid?: string; damage?: number; isCrit?: boolean; whoUid?: string; newLevel?: number; tick: number }[]): void {
    const player = world.players[0];
    const now = performance.now();
    const dt = now - this.lastFrameTime;
    this.lastFrameTime = now;

    // Detect level-up flash.
    if (player) {
      if (this.lastLevelSeen !== null && player.baseLevel > this.lastLevelSeen) {
        this.levelFlashAt = now;
      }
      this.lastLevelSeen = player.baseLevel;
    }

    // Smooth camera follow.
    if (player) {
      const targetCamX = player.position.x * CELL_PX;
      this.cameraX += (targetCamX - this.cameraX) * 0.12;
    }

    // Compute day-night phase.
    let progress = 0;
    if (player) {
      const needed = nextBaseLevelExp(player.baseLevel);
      progress = needed > 0 ? Math.min(1, player.exp / needed) : 0;
    }
    const phase = computePhase(progress);

    // Spawn floating texts from new attack events.
    for (const ev of eventLog) {
      if (ev.kind === 'attack' && ev.targetUid && ev.damage !== undefined) {
        const target = this.findEntity(world, ev.targetUid);
        if (target) {
          this.pushFloatingText(
            target.position.x,
            target.position.y + 1,
            String(ev.damage),
            ev.isCrit ? '#ff5555' : '#ffffff',
          );
        }
      } else if (ev.kind === 'miss' && ev.targetUid) {
        const target = this.findEntity(world, ev.targetUid);
        if (target) {
          this.pushFloatingText(target.position.x, target.position.y + 1, 'Miss', '#aaaaaa');
        }
      } else if (ev.kind === 'levelUp' && ev.whoUid) {
        const target = this.findEntity(world, ev.whoUid);
        if (target) {
          this.pushFloatingText(
            target.position.x,
            target.position.y + 1,
            `Lv ${ev.newLevel ?? ''}!`,
            '#f1c40f',
          );
        }
      }
    }

    const ctx = this.ctx;
    ctx.save();

    this.drawSky(phase);
    this.drawCelestialBody(phase);
    this.drawStars(phase);
    drawParallax(ctx, this.viewW, this.viewH, this.cameraX, phase);

    // Background weather (snow / leaves drift behind entities).
    this.weather.tick(dt, this.viewW, this.viewH);
    if (this.weather.kind !== 'rain') this.weather.draw(ctx);

    this.drawGround(phase);

    // World-space (camera-transformed)
    ctx.save();
    ctx.translate(-this.cameraX + this.viewW / 2, 0);

    for (const item of world.droppedItems) this.drawDroppedItem(item);
    for (const m of world.monsters) {
      if (m.hp <= 0) continue;
      this.drawMonster(m, world, phase);
    }
    for (const p of world.players) this.drawCharacter(p, world, phase);
    this.drawFloatingTexts();

    ctx.restore();

    // Foreground weather (rain in front of entities).
    if (this.weather.kind === 'rain') this.weather.draw(ctx);

    this.drawHud(world, player, phase);

    // Twilight flash on level-up.
    const flashAge = now - this.levelFlashAt;
    if (flashAge < this.LEVEL_FLASH_TTL) {
      drawTwilightFlash(ctx, this.viewW, this.viewH, flashAge, this.LEVEL_FLASH_TTL);
    }

    ctx.restore();
  }

  // ===========================================================================
  // Sky + celestial
  // ===========================================================================

  private drawSky(phase: DayPhase): void {
    const ctx = this.ctx;
    const grad = ctx.createLinearGradient(0, 0, 0, this.viewH);
    grad.addColorStop(0, phase.skyTop);
    grad.addColorStop(1, phase.skyBottom);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.viewW, this.viewH);
  }

  private drawCelestialBody(phase: DayPhase): void {
    const ctx = this.ctx;
    const cx = phase.celestialPos.x * this.viewW;
    const cy = phase.celestialPos.y * this.viewH;
    const r = phase.sunRadius;

    // Sun (visible by day) — soft warm glow.
    if (phase.daylight > 0.3) {
      const dayOpacity = (phase.daylight - 0.3) / 0.7;
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 4);
      glow.addColorStop(0, withAlpha(phase.sunColor, 0.8 * dayOpacity));
      glow.addColorStop(0.3, withAlpha(phase.sunColor, 0.4 * dayOpacity));
      glow.addColorStop(1, withAlpha(phase.sunColor, 0));
      ctx.fillStyle = glow;
      ctx.fillRect(cx - r * 4, cy - r * 4, r * 8, r * 8);

      ctx.fillStyle = phase.sunColor;
      ctx.globalAlpha = dayOpacity;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Moon (visible at night) — opposite side of the sun's arc.
    if (phase.daylight < 0.4) {
      const moonOpacity = (0.4 - phase.daylight) / 0.4;
      const mx = (1 - phase.celestialPos.x) * this.viewW;
      const my = phase.celestialPos.y * this.viewH;
      ctx.fillStyle = '#e8e8f5';
      ctx.globalAlpha = moonOpacity * 0.9;
      ctx.beginPath();
      ctx.arc(mx, my, r * 0.7, 0, Math.PI * 2);
      ctx.fill();
      // Subtle crater shadow
      ctx.fillStyle = '#9999aa';
      ctx.globalAlpha = moonOpacity * 0.3;
      ctx.beginPath();
      ctx.arc(mx - r * 0.2, my - r * 0.1, r * 0.15, 0, Math.PI * 2);
      ctx.arc(mx + r * 0.15, my + r * 0.2, r * 0.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  private drawStars(phase: DayPhase): void {
    if (phase.starOpacity <= 0) return;
    const ctx = this.ctx;
    const now = performance.now();
    ctx.save();
    ctx.globalAlpha = phase.starOpacity;
    ctx.fillStyle = '#ffffff';
    for (const star of STARS) {
      const x = star.x * this.viewW;
      const y = star.y * this.viewH;
      // Twinkle.
      const twinkle = 0.6 + 0.4 * Math.sin(now * 0.003 + star.twinkle * 6.283);
      ctx.globalAlpha = phase.starOpacity * twinkle;
      ctx.beginPath();
      ctx.arc(x, y, star.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ===========================================================================
  // Ground
  // ===========================================================================

  private drawGround(phase: DayPhase): void {
    const ctx = this.ctx;
    const groundY = this.viewH - 120;
    // Ground fill uses the phase ground color (greens by day, desaturated by dusk).
    ctx.fillStyle = phase.groundColor;
    ctx.fillRect(0, groundY, this.viewW, this.viewH - groundY);
    // Lighter top edge
    const grad = ctx.createLinearGradient(0, groundY, 0, groundY + 20);
    grad.addColorStop(0, withAlpha(phase.skyBottom, 0.5));
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, groundY, this.viewW, 20);
  }

  // ===========================================================================
  // Entities
  // ===========================================================================

  private findEntity(world: World, uid: string): { position: { x: number; y: number } } | undefined {
    const p = world.players.find((e) => e.uid === uid);
    if (p) return p;
    const m = world.monsters.find((e) => e.uid === uid);
    return m;
  }

  private drawDroppedItem(item: DroppedItem): void {
    const ctx = this.ctx;
    const x = item.position.x * CELL_PX;
    const def = ITEMS[item.itemId];
    if (!def) return;
    ctx.save();
    ctx.translate(x, this.viewH - 120);
    ctx.fillStyle = def.type === 'weapon' || def.type === 'armor' ? '#ffcc33'
      : def.type === 'etc' && def.name.toLowerCase().includes('card') ? '#ff66cc'
      : '#cccccc';
    ctx.beginPath();
    ctx.arc(0, -6, 5, 0, Math.PI * 2);
    ctx.fill();
    // subtle glow
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, -6, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawMonster(m: Monster, world: World, phase: DayPhase): void {
    const ctx = this.ctx;
    const x = m.position.x * CELL_PX;
    const def = MOBS[m.mobId];
    if (!def) return;
    const groundY = this.viewH - 120;
    const dir = m.sprite.facing === 'right' ? 1 : -1;

    drawEntityShadow(ctx, x, groundY, phase, dir, 14);

    drawComposite(ctx, {
      layers: { body: m.spriteKey },
      hairColor: 0, clothColor: 0, skinColor: 0,
    }, this.sprites, x, groundY, {
      facing: m.sprite.facing,
      animation: m.sprite.animation,
      tick: world.tick,
    });

    applyEntityTint(ctx, x, groundY, 48, ENTITY_FRAME_H, phase);

    // Name + HP bar
    const barW = 40, barH = 4;
    const barX = x - barW / 2;
    const barY = groundY - ENTITY_FRAME_H - 14;
    ctx.fillStyle = '#000';
    ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
    ctx.fillStyle = '#600';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = '#e33';
    ctx.fillRect(barX, barY, barW * Math.max(0, m.hp / m.maxHp), barH);
    ctx.fillStyle = '#fff';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(def.name, x, barY - 4);
    ctx.textAlign = 'start';
  }

  private drawCharacter(p: Character, world: World, phase: DayPhase): void {
    const ctx = this.ctx;
    const x = p.position.x * CELL_PX;
    const groundY = this.viewH - 120;
    const dir = p.sprite.facing === 'right' ? 1 : -1;

    drawEntityShadow(ctx, x, groundY, phase, dir, 18);

    drawComposite(ctx, p.appearance, this.sprites, x, groundY, {
      facing: p.sprite.facing,
      animation: p.sprite.animation,
      tick: world.tick,
      alpha: p.hp <= 0 ? 0.4 : 1,
    });

    applyEntityTint(ctx, x, groundY, 48, ENTITY_FRAME_H, phase);

    // Name + HP/SP bars
    const barW = 56, barH = 4;
    const barX = x - barW / 2;
    const barY = groundY - ENTITY_FRAME_H - 14;
    ctx.fillStyle = '#000';
    ctx.fillRect(barX - 1, barY - 1, barW + 2, barH * 2 + 2);
    ctx.fillStyle = '#400';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = '#e44';
    ctx.fillRect(barX, barY, barW * Math.max(0, p.hp / p.maxHp), barH);
    ctx.fillStyle = '#023';
    ctx.fillRect(barX, barY + barH, barW, barH);
    ctx.fillStyle = '#36f';
    ctx.fillRect(barX, barY + barH, barW * Math.max(0, p.sp / p.maxSp), barH);

    ctx.fillStyle = '#fff';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${p.jobId} Lv${p.baseLevel}`, x, barY - 4);
    ctx.textAlign = 'start';

    if (p.casting) {
      const progress = Math.min(1, (world.tick - p.casting.startedAt) / p.casting.baseCastMs);
      const cbarW = 40, cbarH = 3;
      ctx.fillStyle = '#000';
      ctx.fillRect(x - cbarW / 2 - 1, barY - 10, cbarW + 2, cbarH + 2);
      ctx.fillStyle = '#fc6';
      ctx.fillRect(x - cbarW / 2, barY - 9, cbarW * progress, cbarH);
    }
  }

  // ===========================================================================
  // Floating texts (world space)
  // ===========================================================================

  private drawFloatingTexts(): void {
    const ctx = this.ctx;
    const now = performance.now();
    this.floatingTexts = this.floatingTexts.filter((t) => now - t.bornAt < t.ttl);
    for (const t of this.floatingTexts) {
      const age = (now - t.bornAt) / t.ttl;
      const x = t.x * CELL_PX;
      const yBottom = t.y - age * 28;
      ctx.save();
      ctx.globalAlpha = 1 - age;
      ctx.fillStyle = t.color;
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      // Outline for readability against varying sky.
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.lineWidth = 3;
      ctx.strokeText(t.text, x, yBottom - 60);
      ctx.fillText(t.text, x, yBottom - 60);
      ctx.restore();
    }
    ctx.textAlign = 'start';
  }

  // ===========================================================================
  // HUD
  // ===========================================================================

  private drawHud(world: World, player: Character | undefined, phase: DayPhase): void {
    if (!player) return;
    const ctx = this.ctx;
    ctx.save();

    const pad = 12;
    const x = pad;
    const y = pad;
    const w = 220;
    const h = 14;

    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x - 4, y - 4, w + 8, h * 3 + 12);
    this.drawBar(x, y, w, h, player.hp / player.maxHp, '#e44', `HP ${Math.ceil(player.hp)}/${player.maxHp}`);
    this.drawBar(x, y + h + 4, w, h, player.sp / player.maxSp, '#36f', `SP ${Math.ceil(player.sp)}/${player.maxSp}`);
    const expNeeded = nextBaseLevelExp(player.baseLevel);
    this.drawBar(x, y + (h + 4) * 2, w, h, player.exp / expNeeded, '#fc6', `Base Lv ${player.baseLevel} (${Math.floor(player.exp / expNeeded * 100)}%)`);

    // Day phase indicator (top centre)
    ctx.font = '11px monospace';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    const phaseLabel = this.phaseLabel(phase.progress);
    ctx.fillText(phaseLabel, this.viewW / 2, 18);
    ctx.textAlign = 'start';

    // Tick + monster count (top right)
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(this.viewW - 200, 8, 192, 36);
    ctx.fillStyle = '#fff';
    ctx.font = '12px monospace';
    ctx.fillText(`tick ${world.tick} ms`, this.viewW - 192, 24);
    ctx.fillText(`monsters ${world.monsters.filter((m) => m.hp > 0).length}`, this.viewW - 192, 38);

    ctx.restore();
  }

  private phaseLabel(progress: number): string {
    if (progress < 0.05) return '🌅 dawn';
    if (progress < 0.25) return '🌄 morning';
    if (progress < 0.55) return '☀ noon';
    if (progress < 0.78) return '🌤 afternoon';
    if (progress < 0.93) return '🌇 golden hour';
    if (progress < 0.99) return '🌆 sunset';
    return '🌆 twilight';
  }

  private drawBar(x: number, y: number, w: number, h: number, frac: number, color: string, label: string): void {
    const ctx = this.ctx;
    ctx.fillStyle = '#000';
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x + 1, y + 1, (w - 2) * Math.max(0, Math.min(1, frac)), h - 2);
    ctx.fillStyle = '#fff';
    ctx.font = '10px monospace';
    ctx.fillText(label, x + 4, y + h - 3);
  }
}

// ============================================================================
// Helpers
// ============================================================================

function withAlpha(hex: string, alpha: number): string {
  // Accepts #rrggbb. Returns rgba(r, g, b, alpha).
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
