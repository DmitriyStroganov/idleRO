/**
 * Real-Ragnarok-Online sprite provider backed by ragassets.
 *
 * URL is computed per (layerKey, animation, facing, frame) via
 * `buildAssetUrl`. The provider keeps an in-memory cache of decoded
 * HTMLImageElements keyed by URL so each unique sprite is fetched once.
 *
 * If ragassets fails for a URL we fall back to:
 *   1. the local PNG manifest (`ro-mob-manifest`) — for the five starter
 *      monsters we ship offline copies.
 *   2. PlaceholderSpriteProvider — for layers we have no asset for at all
 *      (custom weapon layers, hats, etc.).
 */

import type { SpriteAnimation } from '@engine/types';
import type { SpriteProvider, SpriteFrame } from './sprites';
import { PlaceholderSpriteProvider } from './sprites';
import { buildAssetUrl } from './ro-asset-url';
import { RO_MOB_MANIFEST, type MobSpriteDef } from './ro-mob-manifest';

const FRAME_W = 64;
const FRAME_H = 80;
/** Delay between animation frames (ms). */
const FRAME_DELAY_MS = 150;

export class RospriteProvider implements SpriteProvider {
  /** URL → HTMLImageElement. */
  private cache = new Map<string, HTMLImageElement>();
  /** URLs known to have failed (404 / network) — skip future fetches. */
  private failed = new Set<string>();
  /** Local PNG fallback images, keyed by mob SpriteKey. */
  private localImages = new Map<string, HTMLImageElement>();
  private localLoaded = new Set<string>();
  private placeholder = new PlaceholderSpriteProvider();

  constructor() {
    // Preload local PNG fallbacks for the 5 starter mobs.
    for (const key of Object.keys(RO_MOB_MANIFEST)) {
      const def: MobSpriteDef = RO_MOB_MANIFEST[key]!;
      const img = new Image();
      img.onload = () => { this.localLoaded.add(key); };
      img.src = def.src;
      this.localImages.set(key, img);
    }
  }

  has(layerKey: string): boolean {
    return layerKey in RO_MOB_MANIFEST
      || buildAssetUrl(layerKey, 'idle', 'right', 0) !== null
      || this.placeholder.has(layerKey);
  }

  get(
    layerKey: string,
    anim: SpriteAnimation,
    facing: 'left' | 'right',
    frame: number,
  ): SpriteFrame {
    // 1. Try ragassets first.
    const url = buildAssetUrl(layerKey, anim, facing, frame);
    if (url) {
      const img = this.getOrFetch(url);
      if (img && img.complete && img.naturalWidth > 0) {
        return this.buildFitFrame(img);
      }
    }

    // 2. Try local PNG fallback (for the 5 starter mobs).
    const def = RO_MOB_MANIFEST[layerKey];
    if (def && this.localLoaded.has(layerKey)) {
      const img = this.localImages.get(layerKey)!;
      const frameIdx = Math.max(0, Math.floor(frame / FRAME_DELAY_MS)) % def.frames.length;
      const src = def.frames[frameIdx]!;
      return this.buildFitFrame(img, src.sx, src.sy, src.sw, src.sh);
    }

    // 3. Fall back to placeholder shapes.
    return this.placeholder.get(layerKey, anim, facing, frame);
  }

  /** Return cached image, or kick off async fetch (returns null until loaded). */
  private getOrFetch(url: string): HTMLImageElement | null {
    if (this.failed.has(url)) return null;
    const existing = this.cache.get(url);
    if (existing) return existing;

    const img = new Image();
    // ragassets serves `Access-Control-Allow-Origin: *` — set crossOrigin
    // so the canvas stays untainted and we can read pixels back later
    // (post-processing, fog, color grading, screenshots).
    img.crossOrigin = 'anonymous';
    img.onload = () => { /* will be picked up next frame */ };
    img.onerror = () => {
      this.failed.add(url);
      this.cache.delete(url);
    };
    img.src = url;
    this.cache.set(url, img);
    return img;
  }

  /**
   * Scale the (sub-)image into the FRAME_W × FRAME_H target, anchored to
   * bottom-centre. Aspect-preserved.
   */
  private buildFitFrame(
    img: HTMLImageElement,
    sx = 0, sy = 0, sw = img.naturalWidth, sh = img.naturalHeight,
  ): SpriteFrame {
    const aspect = sw / sh;
    let dstW = FRAME_W;
    let dstH = FRAME_H;
    if (aspect > FRAME_W / FRAME_H) {
      dstH = Math.round(FRAME_W / aspect);
    } else {
      dstW = Math.round(FRAME_H * aspect);
    }

    return {
      w: FRAME_W,
      h: FRAME_H,
      draw: (ctx) => {
        ctx.drawImage(
          img,
          sx, sy, sw, sh,
          (FRAME_W - dstW) / 2, FRAME_H - dstH, dstW, dstH,
        );
      },
    };
  }
}
