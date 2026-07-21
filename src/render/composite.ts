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
  // Pass `tick` as the frame index — providers that don't animate ignore it,
  // providers that do (RospriteProvider) compute their own frame index from it.
  const frame = Math.max(0, Math.floor(opts.tick));

  ctx.save();
  ctx.globalAlpha = opts.alpha ?? 1;

  const L = appearance.layers;

  // Mirror if facing left — but ONLY for placeholder / non-RO layers.
  // ragassets sprites are already pre-oriented via the `direction` parameter
  // in the URL (2 = W / facing left, 6 = E / facing right), so flipping
  // them again would double-mirror and end up wrong.
  const isRoSprite = L.body.startsWith('Body_') || L.body.startsWith('Sprite_');
  if (opts.facing === 'left' && !isRoSprite) {
    ctx.translate(cx, 0);
    ctx.scale(-1, 1);
    ctx.translate(-cx, 0);
  }

  // If the body is a "real" composite sprite (a RO class sprite from
  // ragassets), the body already includes hair, head, and posture — the
  // individual layer keys we have (hair / headTop / weapon / garment /
  // shield) are PLACEHOLDER shapes, and drawing them on top of a real
  // RO body would look like geometric stickers on a portrait.
  //
  // Until the equipment-layer URL plumbing (passing weapon=/headgear=
  // query params to ragassets) lands, we render ONLY the body for these
  // sprites. The placeholder layers continue to work for non-RO bodies
  // (debug shapes, future custom classes).
  const isCompositeRoBody = L.body.startsWith('Body_');

  // Robe first (covers body) — if present.
  if (L.robe) drawLayer(ctx, spriteProvider, L.robe, cx, cyBottom, opts, frame);

  if (!isCompositeRoBody) {
    // Garment (cape) behind body.
    if (L.garment) drawLayer(ctx, spriteProvider, L.garment, cx, cyBottom, opts, frame);
  }

  // Body (always drawn — this is the actual character sprite)
  drawLayer(ctx, spriteProvider, L.body, cx, cyBottom, opts, frame);

  if (!isCompositeRoBody) {
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
  }

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
