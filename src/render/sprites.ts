/**
 * Sprite provider contract.
 *
 * The renderer NEVER touches assets directly. It asks the SpriteProvider for
 * a "sprite" by layer key, and the provider returns something drawable.
 *
 * Today: PlaceholderSpriteProvider draws coloured shapes per layer.
 * Tomorrow: a real provider returns RO sprite sheets — same interface.
 */

import type { SpriteAnimation } from '@engine/types';

export interface SpriteFrame {
  /** Width/height in CSS pixels. */
  w: number;
  h: number;
  /**
   * Draw this sprite at (0, 0) on the given canvas context.
   * The renderer handles translation/scaling.
   *
   * For real assets this is `ctx.drawImage(sheet, sx, sy, sw, sh, 0, 0, w, h)`.
   * For placeholders it's a sequence of fill/stroke calls.
   */
  draw: (ctx: CanvasRenderingContext2D) => void;
}

export interface SpriteProvider {
  /** Get a single-frame sprite for a layer key + animation + facing. */
  get(layerKey: string, anim: SpriteAnimation, facing: 'left' | 'right', frame: number): SpriteFrame;
  /** Whether this provider actually knows about the layer. */
  has(layerKey: string): boolean;
}

/**
 * Placeholder provider — the only one wired up for the MVP.
 *
 * Each layer key maps to a palette colour + simple shape. The renderer
 * composites them on top of each other to produce a "character".
 *
 * Naming convention:
 *   Body_<Job>            — base body
 *   Hair_<n>              — hairstyle n
 *   Sprite_Hat_<name>     — headgear
 *   Sprite_Weapon_<...>   — weapon layer
 *   Sprite_Garment_<...>  — garment layer
 *   Sprite_Shoes_<...>    — shoes (rarely visible — usually skip)
 *   Sprite_<MobId>        — monster sprite (flat colour)
 */

const PALETTE: Record<string, string> = {
  Body_Novice: '#c9a37a',
  Body_Archer: '#7da34d',
  Body_Hunter: '#4e7c3a',
  Body_Sniper: '#2d4f24',

  Sprite_Lunatic: '#f5e7c5',
  Sprite_Spore: '#7fb5d8',
  Sprite_Wolf: '#7d6e5b',
  Sprite_Savage: '#5b4e3a',
  Sprite_Eddga: '#a8482b',
};

const HAIR_PALETTE = ['#6b4423', '#8b5a2b', '#3d2817', '#c89f5a', '#555', '#aa3333'];

const HAT_PALETTE: Record<string, string> = {
  Sprite_Hat_Sakkat: '#1d2b3a',
  Sprite_Hat_Cap: '#3a5c7a',
  Sprite_Hat_FeatherBand: '#ddc066',
};

const WEAPON_PALETTE: Record<string, string> = {
  Sprite_Weapon_Bow_Basic: '#9a6a3a',
  Sprite_Weapon_Bow_Composite: '#8a5a2a',
  Sprite_Weapon_Bow_Cross: '#6a4a2a',
  Sprite_Weapon_Bow_Gakkung: '#5a3a1a',
  Sprite_Weapon_Bow_Hunter: '#3a5a3a',
  Sprite_Weapon_Bow_Rogue: '#2a3a5a',
  Sprite_Weapon_Knife: '#cccccc',
};

const ARMOR_PALETTE: Record<string, string> = {
  Sprite_Armor_CottonShirt: '#dddddd',
  Sprite_Armor_Leather: '#7a4a2a',
  Sprite_Armor_Tights: '#3a5a3a',
  Sprite_Armor_SilkRobe: '#cccccc',
  Sprite_Garment_Hood: '#555',
  Sprite_Garment_Muffler: '#3a3a3a',
};

const FRAME_W = 48;
const FRAME_H = 64;

export class PlaceholderSpriteProvider implements SpriteProvider {
  has(key: string): boolean {
    return key in PALETTE
      || key.startsWith('Hair_')
      || key in HAT_PALETTE
      || key in WEAPON_PALETTE
      || key in ARMOR_PALETTE;
  }

  get(
    layerKey: string,
    _anim: SpriteAnimation,
    _facing: 'left' | 'right',
    _frame: number,
  ): SpriteFrame {
    if (layerKey.startsWith('Body_')) {
      const color = PALETTE[layerKey] ?? '#cccccc';
      return bodySprite(color);
    }
    if (layerKey.startsWith('Hair_')) {
      const idx = parseInt(layerKey.split('_')[1] ?? '0', 10);
      return hairSprite(HAIR_PALETTE[idx % HAIR_PALETTE.length]!);
    }
    if (layerKey in HAT_PALETTE) {
      return hatSprite(HAT_PALETTE[layerKey]!);
    }
    if (layerKey.startsWith('Sprite_Weapon_Bow')) {
      return bowSprite(WEAPON_PALETTE[layerKey] ?? '#6a4a2a');
    }
    if (layerKey in ARMOR_PALETTE) {
      return armorSprite(ARMOR_PALETTE[layerKey]!);
    }
    // Monster sprites (single-layer)
    if (layerKey in PALETTE) {
      return monsterSprite(PALETTE[layerKey]!);
    }
    return unknownSprite(layerKey);
  }
}

function bodySprite(color: string): SpriteFrame {
  return {
    w: FRAME_W, h: FRAME_H,
    draw: (ctx) => {
      // legs
      ctx.fillStyle = '#3a3326';
      ctx.fillRect(14, 44, 8, 18);
      ctx.fillRect(26, 44, 8, 18);
      // torso
      ctx.fillStyle = color;
      ctx.fillRect(10, 22, 28, 24);
      // arms
      ctx.fillRect(4, 22, 6, 22);
      ctx.fillRect(38, 22, 6, 22);
      // head (skin)
      ctx.fillStyle = '#f0c896';
      ctx.fillRect(14, 4, 20, 20);
    },
  };
}

function hairSprite(color: string): SpriteFrame {
  return {
    w: FRAME_W, h: FRAME_H,
    draw: (ctx) => {
      ctx.fillStyle = color;
      ctx.fillRect(12, 2, 24, 8);
      ctx.fillRect(12, 2, 4, 12);
      ctx.fillRect(32, 2, 4, 12);
    },
  };
}

function hatSprite(color: string): SpriteFrame {
  return {
    w: FRAME_W, h: FRAME_H,
    draw: (ctx) => {
      ctx.fillStyle = color;
      ctx.fillRect(10, 0, 28, 8);
      // Sakkat-style brim
      ctx.fillRect(6, 6, 36, 3);
    },
  };
}

function bowSprite(color: string): SpriteFrame {
  return {
    w: FRAME_W, h: FRAME_H,
    draw: (ctx) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(42, 32, 14, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
      // string
      ctx.strokeStyle = '#dddddd';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(42, 18);
      ctx.lineTo(42, 46);
      ctx.stroke();
    },
  };
}

function armorSprite(color: string): SpriteFrame {
  return {
    w: FRAME_W, h: FRAME_H,
    draw: (ctx) => {
      ctx.fillStyle = color;
      ctx.fillRect(10, 22, 28, 24);
    },
  };
}

function monsterSprite(color: string): SpriteFrame {
  return {
    w: FRAME_W, h: FRAME_H,
    draw: (ctx) => {
      ctx.fillStyle = color;
      ctx.fillRect(8, 16, 32, 40);
      // eyes
      ctx.fillStyle = '#000';
      ctx.fillRect(16, 28, 4, 4);
      ctx.fillRect(28, 28, 4, 4);
    },
  };
}

function unknownSprite(key: string): SpriteFrame {
  return {
    w: FRAME_W, h: FRAME_H,
    draw: (ctx) => {
      ctx.fillStyle = '#ff00ff';
      ctx.fillRect(0, 0, FRAME_W, FRAME_H);
      ctx.fillStyle = '#fff';
      ctx.font = '10px monospace';
      ctx.fillText(key.slice(0, 8), 2, 32);
    },
  };
}
