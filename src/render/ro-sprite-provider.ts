/**
 * Real-Ragnarok-Online sprite provider.
 *
 * Reads mob spritesheets from /public/sprites/mobs/*.png (downloaded from
 * divine-pride.net) and renders the correct frame based on the current
 * animation tick. For non-mob layers (player body, hair, hat, weapon,
 * garment) it falls back to PlaceholderSpriteProvider.
 */

import type { SpriteAnimation } from '@engine/types';
import type { SpriteProvider, SpriteFrame } from './sprites';
import { PlaceholderSpriteProvider } from './sprites';
import { RO_MOB_MANIFEST, type MobSpriteDef } from './ro-mob-manifest';

/**
 * Target on-canvas frame size for mob rendering. Source frames are scaled
 * (aspect-preserved) to fit within FRAME_W × FRAME_H, anchored to the
 * bottom-centre so the mob "stands" on the ground line.
 */
const FRAME_W = 64;
const FRAME_H = 80;

export class RospriteProvider implements SpriteProvider {
  private images = new Map<string, HTMLImageElement>();
  private loaded = new Set<string>();
  private placeholder = new PlaceholderSpriteProvider();

  constructor() {
    for (const [key, def] of Object.entries(RO_MOB_MANIFEST)) {
      this.preload(key, def);
    }
  }

  private preload(key: string, def: MobSpriteDef): void {
    const img = new Image();
    img.onload = () => { this.loaded.add(key); };
    img.onerror = () => console.warn(`Failed to load RO sprite: ${def.src}`);
    img.src = def.src;
    this.images.set(key, img);
  }

  has(layerKey: string): boolean {
    return layerKey in RO_MOB_MANIFEST || this.placeholder.has(layerKey);
  }

  get(
    layerKey: string,
    anim: SpriteAnimation,
    facing: 'left' | 'right',
    frame: number,
  ): SpriteFrame {
    const def = RO_MOB_MANIFEST[layerKey];
    if (def && this.loaded.has(layerKey)) {
      const img = this.images.get(layerKey)!;
      // `frame` is actually a sim-tick value in ms (see composite.ts).
      // Cycle through the manifest's frames at the manifest's delay.
      const animFrame = def.frames.length > 1
        ? Math.floor(frame / def.frameDelayMs) % def.frames.length
        : 0;
      // Suppress death-animation cycle unless the entity is actually dying
      // (heuristic: only Savage uses multi-frame for now and only the
      // standing frame should cycle when alive — so cap at frame 0 unless
      // animation is 'dead' or 'hurt').
      let frameIdx = animFrame;
      if (def.frames.length > 1 && anim !== 'dead' && anim !== 'hurt') {
        frameIdx = 0;  // alive → just the standing frame
      } else if (def.frames.length > 1 && anim === 'dead') {
        // death animation → play frames in order, frozen on last
        frameIdx = Math.min(def.frames.length - 1, Math.floor(frame / def.frameDelayMs));
      }
      const src = def.frames[frameIdx]!;
      return this.buildFrame(img, src, anim);
    }
    return this.placeholder.get(layerKey, anim, facing, frame);
  }

  private buildFrame(
    img: HTMLImageElement,
    src: { sx: number; sy: number; sw: number; sh: number },
    _anim: SpriteAnimation,
  ): SpriteFrame {
    const aspect = src.sw / src.sh;
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
          src.sx, src.sy, src.sw, src.sh,
          (FRAME_W - dstW) / 2, FRAME_H - dstH, dstW, dstH,
        );
      },
    };
  }
}
