/**
 * RO binary reader — minimal port of roBrowser's BinaryReader.
 * Wraps a DataView with sequential read methods.
 */
export class BinReader {
  private view: DataView;
  private offset = 0;

  constructor(buffer: ArrayBuffer) {
    this.view = new DataView(buffer);
  }

  get tell(): number { return this.offset; }
  get length(): number { return this.view.byteLength; }
  seek(delta: number): void { this.offset += delta; }
  seekTo(pos: number): void { this.offset = pos; }

  readUByte(): number { return this.view.getUint8(this.offset++); }
  readByte(): number { return this.view.getInt8(this.offset++); }
  readUShort(): number { const v = this.view.getUint16(this.offset, true); this.offset += 2; return v; }
  readShort(): number { const v = this.view.getInt16(this.offset, true); this.offset += 2; return v; }
  readULong(): number { const v = this.view.getUint32(this.offset, true); this.offset += 4; return v; }
  readLong(): number { const v = this.view.getInt32(this.offset, true); this.offset += 4; return v; }
  readFloat(): number { const v = this.view.getFloat32(this.offset, true); this.offset += 4; return v; }

  /** Read a fixed-length ASCII string. */
  readString(len: number): string {
    let s = '';
    for (let i = 0; i < len; i++) {
      const c = this.view.getUint8(this.offset++);
      if (c === 0) { this.offset += len - i - 1; break; }
      s += String.fromCharCode(c);
    }
    return s;
  }

  /** Read remaining bytes as Uint8Array. */
  readBytes(len: number): Uint8Array {
    const arr = new Uint8Array(this.view.buffer, this.offset, len);
    this.offset += len;
    return arr;
  }
}
