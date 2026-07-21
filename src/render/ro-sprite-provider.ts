/**
 * Real-Ragnarok-Online sprite provider.
 *
 * Sources mob spritesheets from /public/sprites/mobs/*.png (downloaded from
 * divine-pride.net's public CDN). Each PNG is a full spritesheet; for now
 * we draw the FIRST frame (top-left cell) — animation extraction comes later.
 *
 * For any layer key we don't have a real asset for (player body, hair, hat,
 * weapon, garment) we fall back to the PlaceholderSpriteProvider so the
 * visual still renders coherently.
 */

import type { SpriteAnimation } from '@engine/types';
import type { SpriteProvider, SpriteFrame } from './sprites';
import { PlaceholderSpriteProvider } from './sprites';

/** Map of in-engine SpriteKey → PNG file under /public/sprites/mobs/. */
const MOB_ASSETS: Record<string, string> = {
  'Sprite_Lunatic': 'sprites/mobs/lunatic.png',
  'Sprite_Spore':   'sprites/mobs/spore.png',
  'Sprite_Wolf':    'sprites/mobs/wolf.png',
  'Sprite_Savage':  'sprites/mobs/savage.png',
  'Sprite_Eddga':   'sprites/mobs/eddga.png',
};

/**
 * Target on-canvas frame size for mob rendering. Source sprites get scaled
 * (preserving aspect ratio) to fit within FRAME_W × FRAME_H, anchored to
 * the bottom-centre (so the mob "stands" on the ground line).
 */
const FRAME_W = 64;
const FRAME_H = 80;

export class RospriteProvider implements SpriteProvider {
  private images = new Map<string, HTMLImageElement>();
  private placeholder = new PlaceholderSpriteProvider();

  constructor() {
    // Kick off async loads immediately; get() will use them once complete.
    for (const [key, src] of Object.entries(MOB_ASSETS)) {
      const img = new Image();
      img.src = src;
      img.onload = () => { /* loaded */ };
      img.onerror = () => console.warn(`Failed to load RO sprite: ${src}`);
      this.images.set(key, img);
    }
  }

  has(layerKey: string): boolean {
    return layerKey in MOB_ASSETS || this.placeholder.has(layerKey);
  }

  get(
    layerKey: string,
    anim: SpriteAnimation,
    facing: 'left' | 'right',
    frame: number,
  ): SpriteFrame {
    const src = MOB_ASSETS[layerKey];
    if (src) {
      const img = this.images.get(layerKey);
      if (img && img.complete && img.naturalWidth > 0) {
        return this.cropFirstFrame(img, anim);
      }
    }
    // Fall back to placeholder for player layers + unloaded sprites.
    return this.placeholder.get(layerKey, anim, facing, frame);
  }

  /**
   * Crop the first "frame" from the spritesheet. RO spritesheets are usually
   * laid out as 8-direction rows × action columns, but the exact cell size
   * varies per monster. For the MVP we take the top-left square corner of
   * the sheet and scale it to our target frame. Good enough to recognise
   * the monster; full animation extraction is a follow-up.
   */
  private cropFirstFrame(img: HTMLImageElement, _anim: SpriteAnimation): SpriteFrame {
    // Pick a square source cell — spritesheets are wider than tall sometimes,
    // so use min(w, h*1.25) to favour the character body over blank margin.
    const srcW = img.naturalWidth;
    const srcH = img.naturalHeight;
    // Use roughly the top-left third of the sheet — for most RO mob sheets
    // this captures the "standing" frame facing south.
    const cellSrcW = Math.min(srcW, Math.floor(srcH * 0.8));
    const cellSrcH = Math.min(srcH, Math.floor(srcW * 1.25));

    // Compute destination size preserving aspect ratio within FRAME_W × FRAME_H.
    const aspect = cellSrcW / cellSrcH;
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
          0, 0, cellSrcW, cellSrcH,
          (FRAME_W - dstW) / 2, FRAME_H - dstH, dstW, dstH,
        );
      },
    };
  }
}
