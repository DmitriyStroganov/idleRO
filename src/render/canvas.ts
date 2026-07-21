/**
 * Canvas renderer for idleRO.
 *
 * Responsibilities:
 *   - Draw the ground band (terrain)
 *   - Apply camera transform (follow player)
 *   - Draw entities (composite character + monster sprites)
 *   - Draw HP bars, cast bars, floating damage numbers
 *   - Draw DroppedItems as small icons
 *
 * Camera: follow-player along X. Y is fixed (side-scroller style).
 *
 * Cell size: 1 cell = CELL_PX pixels (configurable).
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

const CELL_PX = 48;
const GROUND_BAND_PX = 120;
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

  /** Push a floating damage/heal number at world coordinates. */
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

  /** Main draw call. */
  draw(world: World, eventLog: { kind: string; attackerUid?: string; targetUid?: string; damage?: number; isCrit?: boolean; tick: number }[]): void {
    const player = world.players[0];
    if (player) {
      const targetCamX = player.position.x * CELL_PX;
      // Smooth camera follow.
      this.cameraX += (targetCamX - this.cameraX) * 0.12;
    }

    // Compute floating-text world-space targets from new events.
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
      }
    }

    const ctx = this.ctx;
    ctx.save();

    // Sky / background
    const grad = ctx.createLinearGradient(0, 0, 0, this.viewH);
    grad.addColorStop(0, '#1d2b3a');
    grad.addColorStop(1, '#0f1820');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.viewW, this.viewH);

    // Ground band (fixed height; sits near the bottom).
    const groundY = this.viewH - GROUND_BAND_PX;
    this.drawGround(world, groundY);

    // World transform: translate by camera.
    ctx.translate(-this.cameraX + this.viewW / 2, 0);

    // Dropped items (under entities).
    for (const item of world.droppedItems) {
      this.drawDroppedItem(item, groundY);
    }

    // Monsters
    for (const m of world.monsters) {
      if (m.hp <= 0) continue;
      this.drawMonster(m, world, groundY);
    }

    // Players
    for (const p of world.players) {
      this.drawCharacter(p, world, groundY);
    }

    // Floating texts (in world space).
    this.drawFloatingTexts();

    ctx.restore();

    // HUD overlays (in screen space).
    this.drawHud(world, player);
  }

  private findEntity(world: World, uid: string): { position: { x: number; y: number } } | undefined {
    const p = world.players.find((e) => e.uid === uid);
    if (p) return p;
    const m = world.monsters.find((e) => e.uid === uid);
    return m;
  }

  private drawGround(_world: World, groundY: number): void {
    const ctx = this.ctx;
    // Ground fill
    ctx.fillStyle = '#2c3e2a';
    ctx.fillRect(0, groundY, this.viewW, this.viewH - groundY);
    // Grass strip on top
    ctx.fillStyle = '#3d5a36';
    ctx.fillRect(0, groundY, this.viewW, 12);

    // Distance markers every 5 cells (world space)
    const startX = Math.floor((this.cameraX - this.viewW / 2) / CELL_PX);
    const endX = Math.ceil((this.cameraX + this.viewW / 2) / CELL_PX);
    ctx.save();
    ctx.translate(-this.cameraX + this.viewW / 2, 0);
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    for (let x = startX; x <= endX; x++) {
      if (x % 5 !== 0) continue;
      ctx.fillRect(x * CELL_PX, groundY, 1, this.viewH - groundY);
    }
    ctx.restore();
  }

  private drawDroppedItem(item: DroppedItem, groundY: number): void {
    const ctx = this.ctx;
    const x = item.position.x * CELL_PX;
    const def = ITEMS[item.itemId];
    if (!def) return;
    const isRare = def.type === 'etc' && item.itemId.startsWith('Item_');
    ctx.save();
    ctx.translate(x, groundY);
    // Small glowing dot
    ctx.fillStyle = def.type === 'weapon' || def.type === 'armor' ? '#ffcc33'
      : def.type === 'card' || def.type === 'etc' && def.name.toLowerCase().includes('card') ? '#ff66cc'
      : isRare ? '#88ff88' : '#cccccc';
    ctx.beginPath();
    ctx.arc(0, -6, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  private drawMonster(m: Monster, _world: World, groundY: number): void {
    const ctx = this.ctx;
    const x = m.position.x * CELL_PX;
    const def = MOBS[m.mobId];
    if (!def) return;

    drawComposite(ctx, {
      layers: { body: m.spriteKey },
      hairColor: 0, clothColor: 0, skinColor: 0,
    }, this.sprites, x, groundY, {
      facing: m.sprite.facing,
      animation: m.sprite.animation,
      tick: _world.tick,
    });

    // Name + HP bar above head.
    const barW = 40;
    const barH = 4;
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

  private drawCharacter(p: Character, world: World, groundY: number): void {
    const ctx = this.ctx;
    const x = p.position.x * CELL_PX;

    drawComposite(ctx, p.appearance, this.sprites, x, groundY, {
      facing: p.sprite.facing,
      animation: p.sprite.animation,
      tick: world.tick,
      alpha: p.hp <= 0 ? 0.4 : 1,
    });

    // Name + HP/SP bars above head
    const barW = 56;
    const barH = 4;
    const barX = x - barW / 2;
    const barY = groundY - ENTITY_FRAME_H - 14;
    ctx.fillStyle = '#000';
    ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
    ctx.fillStyle = '#400';
    ctx.fillRect(barX, barY, barW, barH);
    ctx.fillStyle = '#e44';
    ctx.fillRect(barX, barY, barW * Math.max(0, p.hp / p.maxHp), barH);

    // SP under HP
    ctx.fillStyle = '#023';
    ctx.fillRect(barX, barY + barH, barW, barH);
    ctx.fillStyle = '#36f';
    ctx.fillRect(barX, barY + barH, barW * Math.max(0, p.sp / p.maxSp), barH);

    ctx.fillStyle = '#fff';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`${p.jobId} Lv${p.baseLevel}`, x, barY - 4);
    ctx.textAlign = 'start';

    // Cast bar if casting
    if (p.casting) {
      const progress = Math.min(1, (world.tick - p.casting.startedAt) / p.casting.baseCastMs);
      const cbarW = 40;
      const cbarH = 3;
      ctx.fillStyle = '#000';
      ctx.fillRect(x - cbarW / 2 - 1, barY - 10, cbarW + 2, cbarH + 2);
      ctx.fillStyle = '#fc6';
      ctx.fillRect(x - cbarW / 2, barY - 9, cbarW * progress, cbarH);
    }
  }

  private drawFloatingTexts(): void {
    const ctx = this.ctx;
    const now = performance.now();
    this.floatingTexts = this.floatingTexts.filter((t) => now - t.bornAt < t.ttl);
    for (const t of this.floatingTexts) {
      const age = (now - t.bornAt) / t.ttl;
      const x = t.x * CELL_PX;
      const yBottom = (t.y) * 1 - age * 28;
      ctx.save();
      ctx.globalAlpha = 1 - age;
      ctx.fillStyle = t.color;
      ctx.font = 'bold 14px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(t.text, x, yBottom - 60);
      ctx.restore();
    }
    ctx.textAlign = 'start';
  }

  private drawHud(world: World, player?: Character): void {
    const ctx = this.ctx;
    ctx.save();
    // Top-left: HP/SP/EXP
    if (player) {
      const pad = 12;
      const x = pad;
      const y = pad;
      const w = 220;
      const h = 14;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(x - 4, y - 4, w + 8, h * 3 + 12);
      this.drawBar(x, y, w, h, player.hp / player.maxHp, '#e44', `HP ${Math.ceil(player.hp)}/${player.maxHp}`);
      this.drawBar(x, y + h + 4, w, h, player.sp / player.maxSp, '#36f', `SP ${Math.ceil(player.sp)}/${player.maxSp}`);
      const expNeeded = Math.floor(100 * Math.pow(1.18, player.baseLevel - 1));
      this.drawBar(x, y + (h + 4) * 2, w, h, player.exp / expNeeded, '#fc6', `Base Lv ${player.baseLevel} (${Math.floor(player.exp / expNeeded * 100)}%)`);
    }
    // Top-right: tick + entity count
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(this.viewW - 200, 8, 192, 36);
    ctx.fillStyle = '#fff';
    ctx.font = '12px monospace';
    ctx.fillText(`tick ${world.tick} ms`, this.viewW - 192, 24);
    ctx.fillText(`monsters ${world.monsters.filter((m) => m.hp > 0).length}`, this.viewW - 192, 38);
    ctx.restore();
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
