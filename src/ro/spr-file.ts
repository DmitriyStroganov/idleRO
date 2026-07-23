/**
 * RO .spr file parser — port of roBrowser's Sprite.js.
 * Parses sprite images (palette-indexed or RGBA) from the binary format.
 */

import { BinReader } from './bin-reader';

const TYPE_PAL = 0;
const TYPE_RGBA = 1;

export interface SprFrame {
  type: number;       // TYPE_PAL or TYPE_RGBA
  width: number;
  height: number;
  data: Uint8Array;   // palette indices (TYPE_PAL) or RGBA bytes (TYPE_RGBA)
}

export class SprFile {
  version = 0;
  frames: SprFrame[] = [];
  palette: Uint8Array | null = null;  // 256 * 4 bytes (R,G,B,A)

  constructor(data: ArrayBuffer) {
    this.parse(data);
  }

  private parse(data: ArrayBuffer): void {
    const fp = new BinReader(data);
    const header = fp.readString(2);
    if (header !== 'SP') throw new Error(`SPR: bad header "${header}"`);

    this.version = fp.readUByte() / 10 + fp.readUByte();

    const indexedCount = fp.readUShort();
    let rgbaCount = 0;
    if (this.version > 1.1) rgbaCount = fp.readUShort();

    this.frames = new Array(indexedCount + rgbaCount);

    // Indexed images (RLE if version >= 2.1)
    for (let i = 0; i < indexedCount; i++) {
      if (this.version < 2.1) {
        this.frames[i] = this.readIndexedRaw(fp);
      } else {
        this.frames[i] = this.readIndexedRLE(fp);
      }
    }

    // RGBA images
    for (let i = 0; i < rgbaCount; i++) {
      const w = fp.readShort();
      const h = fp.readShort();
      this.frames[indexedCount + i] = {
        type: TYPE_RGBA, width: w, height: h,
        data: fp.readBytes(w * h * 4),
      };
    }

    // Palette (last 1024 bytes)
    if (this.version > 1.0) {
      const palOffset = data.byteLength - 1024;
      this.palette = new Uint8Array(data, palOffset, 1024);
    }
  }

  private readIndexedRaw(fp: BinReader): SprFrame {
    const w = fp.readUShort();
    const h = fp.readUShort();
    return { type: TYPE_PAL, width: w, height: h, data: fp.readBytes(w * h) };
  }

  private readIndexedRLE(fp: BinReader): SprFrame {
    const w = fp.readUShort();
    const h = fp.readUShort();
    const size = w * h;
    const out = new Uint8Array(size);
    let index = 0;
    const end = fp.readUShort() + fp.tell;

    while (fp.tell < end) {
      const c = fp.readUByte();
      out[index++] = c;
      if (c === 0) {
        const count = fp.readUByte();
        if (count === 0) {
          out[index++] = 0;
        } else {
          for (let j = 1; j < count; j++) out[index++] = c;
        }
      }
    }
    return { type: TYPE_PAL, width: w, height: h, data: out };
  }

  /**
   * Convert a palette-indexed frame to an HTMLCanvasElement.
   * Palette index 0 = transparent.
   * Vertical flip (RO stores images upside-down).
   */
  frameToCanvas(frameIdx: number): HTMLCanvasElement {
    const frame = this.frames[frameIdx];
    const canvas = document.createElement('canvas');
    if (!frame || frame.width <= 0 || frame.height <= 0) return canvas;

    canvas.width = frame.width;
    canvas.height = frame.height;
    const ctx = canvas.getContext('2d')!;
    const imageData = ctx.createImageData(frame.width, frame.height);
    const pixels = imageData.data; // RGBA Uint8ClampedArray

    if (frame.type === TYPE_RGBA) {
      // RGBA: data is stored as ABGR in the file, need to rearrange + vertical flip
      for (let y = 0; y < frame.height; y++) {
        const srcRow = y * frame.width * 4;
        const dstRow = (frame.height - y - 1) * frame.width * 4;
        for (let x = 0; x < frame.width; x++) {
          const si = srcRow + x * 4;
          const di = dstRow + x * 4;
          pixels[di]     = frame.data[si + 3]!; // R
          pixels[di + 1] = frame.data[si + 2]!; // G
          pixels[di + 2] = frame.data[si + 1]!; // B
          pixels[di + 3] = frame.data[si]!;     // A
        }
      }
    } else if (this.palette) {
      // Palette indexed: map each index to RGBA from palette, index 0 = transparent.
      // No vertical flip — palette images are stored top-to-bottom (correct orientation).
      const pal = this.palette;
      for (let y = 0; y < frame.height; y++) {
        const row = y * frame.width;
        for (let x = 0; x < frame.width; x++) {
          const idx = frame.data[row + x]!;
          const di = (row + x) * 4;
          if (idx === 0) {
            pixels[di + 3] = 0; // transparent
          } else {
            pixels[di]     = pal[idx * 4]!;
            pixels[di + 1] = pal[idx * 4 + 1]!;
            pixels[di + 2] = pal[idx * 4 + 2]!;
            pixels[di + 3] = 255;
          }
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);
    return canvas;
  }

  /** Number of frames. */
  get frameCount(): number { return this.frames.length; }
}
