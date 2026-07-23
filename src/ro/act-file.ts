/**
 * RO .act file parser — port of roBrowser's Action.js.
 * Parses animation data: actions → frames → layers (position, scale, etc.)
 */

import { BinReader } from './bin-reader';

export interface ActLayer {
  x: number;           // offset X
  y: number;           // offset Y
  index: number;       // sprite frame index (-1 = empty)
  mirror: number;      // mirror flag
  color: [number, number, number, number]; // RGBA tint (0..1)
  scaleX: number;
  scaleY: number;
  angle: number;       // rotation in degrees
  sprType: number;     // 0=palette, 1=rgba
  width: number;       // (version >= 2.5)
  height: number;
}

export interface ActFrame {
  layers: ActLayer[];
  sound: number;
  attachPoints: { x: number; y: number }[];
}

export interface ActAction {
  frames: ActFrame[];
  delay: number;       // frame delay in ms
}

export class ActFile {
  version = 0;
  actions: ActAction[] = [];

  constructor(data: ArrayBuffer) {
    this.parse(data);
  }

  private parse(data: ArrayBuffer): void {
    const fp = new BinReader(data);
    const header = fp.readString(2);
    if (header !== 'AC') throw new Error(`ACT: bad header "${header}"`);

    this.version = fp.readUByte() / 10 + fp.readUByte();

    const numActions = fp.readUShort();
    fp.seek(10); // reserved

    this.actions = new Array(numActions);
    for (let ai = 0; ai < numActions; ai++) {
      this.actions[ai] = this.readAction(fp);
    }

    // Sound names (version >= 2.1)
    if (this.version >= 2.1) {
      const soundCount = fp.readULong();
      for (let i = 0; i < soundCount; i++) fp.seek(40);
    }

    // Per-action delays (version >= 2.2)
    if (this.version >= 2.2) {
      for (let ai = 0; ai < numActions; ai++) {
        this.actions[ai]!.delay = fp.readFloat() * 25;
      }
    }
  }

  private readAction(fp: BinReader): ActAction {
    const numFrames = fp.readULong();
    const frames: ActFrame[] = new Array(numFrames);
    for (let fi = 0; fi < numFrames; fi++) {
      fp.seek(32); // unknown (attackRange + fitRange)
      frames[fi] = this.readFrame(fp);
    }
    return { frames, delay: 150 };
  }

  private readFrame(fp: BinReader): ActFrame {
    const numLayers = fp.readULong();
    const layers: ActLayer[] = new Array(numLayers);

    for (let li = 0; li < numLayers; li++) {
      const layer: ActLayer = {
        x: fp.readLong(),
        y: fp.readLong(),
        index: fp.readLong(),
        mirror: fp.readULong(),
        color: [1, 1, 1, 1],
        scaleX: 1, scaleY: 1,
        angle: 0, sprType: 0, width: 0, height: 0,
      };

      if (this.version >= 2.0) {
        layer.color = [
          fp.readUByte() / 255,
          fp.readUByte() / 255,
          fp.readUByte() / 255,
          fp.readUByte() / 255,
        ];
        layer.scaleX = fp.readFloat();
        layer.scaleY = this.version <= 2.3 ? layer.scaleX : fp.readFloat();
        layer.angle = fp.readLong();
        layer.sprType = fp.readLong();
        if (this.version >= 2.5) {
          layer.width = fp.readLong();
          layer.height = fp.readLong();
        }
      }
      layers[li] = layer;
    }

    // Sound index
    const sound = this.version >= 2.0 ? fp.readLong() : -1;

    // Attach points (version >= 2.3)
    const attachPoints: { x: number; y: number }[] = [];
    if (this.version >= 2.3) {
      const apCount = fp.readULong();
      for (let i = 0; i < apCount; i++) {
        fp.seek(4); // unknown
        attachPoints.push({ x: fp.readLong(), y: fp.readLong() });
        fp.seek(4); // unknown
      }
    }

    return { layers, sound, attachPoints };
  }

  /** Get frame count for an action. Returns 0 if action doesn't exist. */
  frameCount(action: number): number {
    if (action < 0 || action >= this.actions.length) return 0;
    return this.actions[action]!.frames.length;
  }
}
