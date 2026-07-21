/**
 * Composite character drawer.
 *
 * Given a character's `Appearance`, draws each layer back-to-front at the
 * requested (x, y) on the canvas. Used by the canvas renderer.
 *
 * Layer z-order (back to front):
 *   robe (covers almost everything) | garment | body | armor | head-low
 *   | head-mid | hair | head-top | shield | weapon
 *
 * When real RO sprite sheets arrive, this function still orchestrates the
 * stacking — only the per-layer draw call changes (in SpriteProvider).
 */

import type { Appearance, SpriteAnimation } from '@engine/types';
import type { SpriteProvider, SpriteFrame } from './sprites';

export interface DrawOpts {
  facing: 'left' | 'right';
  animation: SpriteAnimation;
  /** Current sim tick (ms) — used to compute frame index for animation. */
  tick: number;
  /** Optional alpha (0..1) for fading. */
  alpha?: number;
}

/**
 * Draw a character at canvas coordinates (cx, cyBottom) where cyBottom is
 * the y of the feet (ground line). Layers are drawn upward from there.
 */
export function drawComposite(
  ctx: CanvasRenderingContext2D,
  appearance: Appearance,
  spriteProvider: SpriteProvider,
  cx: number,
  cyBottom: number,
  opts: DrawOpts,
): void {
  const frame = Math.floor(opts.tick / 200) % 4;

  ctx.save();
  ctx.globalAlpha = opts.alpha ?? 1;

  // Mirror if facing left.
  if (opts.facing === 'left') {
    ctx.translate(cx, 0);
    ctx.scale(-1, 1);
    ctx.translate(-cx, 0);
  }

  const L = appearance.layers;

  // Robe first (covers body) — if present.
  if (L.robe) drawLayer(ctx, spriteProvider, L.robe, cx, cyBottom, opts, frame);

  // Garment (cape) behind body.
  if (L.garment) drawLayer(ctx, spriteProvider, L.garment, cx, cyBottom, opts, frame);

  // Body
  drawLayer(ctx, spriteProvider, L.body, cx, cyBottom, opts, frame);

  // Armor (overrides torso colour).
  if (L.body && L.body.startsWith('Body_') && !L.robe) {
    // skip if armor layer is absent (skin shows through)
  }

  // Shield (left hand — back when facing right).
  if (L.shield) drawLayer(ctx, spriteProvider, L.shield, cx, cyBottom, opts, frame);

  // Head-low (beard, mask)
  if (L.headLow) drawLayer(ctx, spriteProvider, L.headLow, cx, cyBottom, opts, frame);

  // Head-mid (glasses)
  if (L.headMid) drawLayer(ctx, spriteProvider, L.headMid, cx, cyBottom, opts, frame);

  // Hair
  if (L.hair) drawLayer(ctx, spriteProvider, L.hair, cx, cyBottom, opts, frame);

  // Head-top (hat)
  if (L.headTop) drawLayer(ctx, spriteProvider, L.headTop, cx, cyBottom, opts, frame);

  // Weapon (front)
  if (L.weapon) drawLayer(ctx, spriteProvider, L.weapon, cx, cyBottom, opts, frame);

  ctx.restore();
}

function drawLayer(
  ctx: CanvasRenderingContext2D,
  provider: SpriteProvider,
  layerKey: string,
  cx: number,
  cyBottom: number,
  opts: DrawOpts,
  frame: number,
): void {
  if (!provider.has(layerKey)) return;
  const sprite: SpriteFrame = provider.get(layerKey, opts.animation, opts.facing, frame);
  ctx.save();
  ctx.translate(cx - sprite.w / 2, cyBottom - sprite.h);
  sprite.draw(ctx);
  ctx.restore();
}
