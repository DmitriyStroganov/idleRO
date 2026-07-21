/**
 * Build ragassets URLs for any RO sprite (player class or monster).
 *
 * ragassets (https://github.com/adsonpleal/ragassets) is an HTTP service
 * that renders Ragnarok Online `.spr/.act` files to PNG/APNG on demand.
 * Public instance: https://assets.latam-tools.com.br
 *
 * URL format:  /image?job={id}&action={a}&frame={f}
 *
 * Action encodes two things:  action = (animType * 8) + direction
 *   direction: 0=S, 1=SW, 2=W, 3=NW, 4=N, 5=NE, 6=E, 7=SE
 *   For our 1D side-scroller we only use 2 (W = facing left) and 6 (E = right).
 *
 * Anim types differ between players and monsters; this module knows both
 * tables.
 */

import type { SpriteAnimation } from '@engine/types';

const ASSET_BASE = 'https://assets.latam-tools.com.br';

/** Engine SpriteKey → ragassets job id (for monsters). */
const MONSTER_JOB_MAP: Record<string, number> = {
  Sprite_Lunatic: 1063,
  Sprite_Spore:   1014,
  Sprite_Wolf:    1013,
  Sprite_Savage:  1116,
  Sprite_Eddga:   1115,
};

/** Engine body-layer key → ragassets job id (for player classes). */
const PLAYER_CLASS_MAP: Record<string, number> = {
  Body_Novice: 0,        // JobID 0
  Body_Archer: 3,        // JobID 3
  Body_Hunter: 11,       // JobID 11
  Body_Sniper: 4014,     // JobID 4014 (transcendent Archer)
};

const MONSTER_ACTIONS: Record<SpriteAnimation, number> = {
  idle: 0, walk: 8, attack: 16, hurt: 24, dead: 32,
  cast: 0, pickup: 0,
};

const PLAYER_ACTIONS: Record<SpriteAnimation, number> = {
  idle: 0, walk: 8, attack: 40, hurt: 48, dead: 64, cast: 32,
  pickup: 24,
};

/**
 * Build the ragassets /image URL for the given layer + state, or return null
 * if the layerKey isn't a recognised RO sprite (e.g. placeholder weapon keys).
 */
export function buildAssetUrl(
  layerKey: string,
  anim: SpriteAnimation,
  facing: 'left' | 'right',
  frame: number,
): string | null {
  const dir = facing === 'right' ? 6 : 2;

  let jobId: number | undefined;
  let actionBase: number;

  if (layerKey in MONSTER_JOB_MAP) {
    jobId = MONSTER_JOB_MAP[layerKey];
    actionBase = MONSTER_ACTIONS[anim] ?? 0;
  } else if (layerKey in PLAYER_CLASS_MAP) {
    jobId = PLAYER_CLASS_MAP[layerKey];
    actionBase = PLAYER_ACTIONS[anim] ?? 0;
  } else {
    return null;
  }

  const action = actionBase + dir;
  // `frame` arrives as the sim tick in ms (see composite.ts). Convert to an
  // animation frame index in 0..7. RO actions typically have 6-8 frames;
  // ragassets returns a still for each frame index.
  const FRAME_DELAY_MS = 150;
  const frameIdx = Math.max(0, Math.floor(frame / FRAME_DELAY_MS)) % 8;
  return `${ASSET_BASE}/image?job=${jobId}&action=${action}&frame=${frameIdx}`;
}
