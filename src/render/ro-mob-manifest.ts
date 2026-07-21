/**
 * Per-mob sprite atlas metadata.
 *
 * RO spritesheets don't carry frame metadata in the file — the layout is
 * encoded in the engine. For our MVP we hand-author a manifest:
 *   - the PNG source
 *   - one or more "frames" (rectangles within the source)
 *   - an animation timing
 *
 * Most mobs only need a single frame (the standing pose). Savage has a
 * clear 4-frame row that's worth animating. Others can be enriched later.
 *
 * Frame rects were derived by analysing each PNG's transparent-pixel map
 * (see scripts/analyse-sprites.py if regenerated). They use whole-pixel
 * coordinates: { sx, sy, sw, sh } in source-image space.
 */

export interface MobFrame {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

export interface MobSpriteDef {
  src: string;
  /** Frames cycled for the idle/stand animation. */
  frames: MobFrame[];
  /** Delay between frames in ms. */
  frameDelayMs: number;
}

export const RO_MOB_MANIFEST: Record<string, MobSpriteDef> = {
  // Lunatic: single 238x297 region with content centred.
  Sprite_Lunatic: {
    src: 'sprites/mobs/lunatic.png',
    frames: [{ sx: 0, sy: 1, sw: 238, sh: 297 }],
    frameDelayMs: 600,
  },

  // Spore: tall sheet. Top third is the stand/walk cycle.
  // (Full frame split is a TODO — for now, use the standing pose.)
  Sprite_Spore: {
    src: 'sprites/mobs/spore.png',
    frames: [{ sx: 0, sy: 1, sw: 271, sh: 250 }],
    frameDelayMs: 600,
  },

  // Wolf: top region is the run cycle.
  Sprite_Wolf: {
    src: 'sprites/mobs/wolf.png',
    frames: [{ sx: 1, sy: 0, sw: 468, sh: 250 }],
    frameDelayMs: 500,
  },

  // Savage: 4-frame row — main body + 3 dying frames. Animate them all.
  Sprite_Savage: {
    src: 'sprites/mobs/savage.png',
    frames: [
      { sx: 0,   sy: 0, sw: 408, sh: 163 },   // alive/standing
      { sx: 413, sy: 0, sw: 34,  sh: 163 },   // dying 1
      { sx: 453, sy: 0, sw: 33,  sh: 163 },   // dying 2
      { sx: 492, sy: 0, sw: 33,  sh: 163 },   // dying 3
    ],
    frameDelayMs: 600,
  },

  // Eddga: single huge frame.
  Sprite_Eddga: {
    src: 'sprites/mobs/eddga.png',
    frames: [{ sx: 1, sy: 0, sw: 660, sh: 751 }],
    frameDelayMs: 800,
  },
};
