/**
 * RO sprite renderer — composites .spr + .act layers onto canvas.
 *
 * Each entity (player body, weapon, headgear) has its own .spr + .act pair.
 * The renderer loads them, pre-renders each frame to an offscreen canvas,
 * and composites all layers in the correct z-order.
 */

import { SprFile } from './spr-file';
import { ActFile, type ActLayer } from './act-file';

export interface SpriteLayerData {
  spr: SprFile;
  act: ActFile;
  /** Pre-rendered canvases: [action][frame][layerIndex] → canvas */
  canvases: Map<string, HTMLCanvasElement>;
}

export class RoRenderer {
  private layers: Map<string, SpriteLayerData> = new Map();

  /**
   * Load a sprite+act pair from binary data.
   * @param key     layer name: 'body', 'weapon', 'head', etc.
   * @param sprData .spr file ArrayBuffer
   * @param actData .act file ArrayBuffer
   */
  loadLayer(key: string, sprData: ArrayBuffer, actData: ArrayBuffer): void {
    const spr = new SprFile(sprData);
    const act = new ActFile(actData);
    this.layers.set(key, { spr, act, canvases: new Map() });
    this.prerender(key);
  }

  /** Remove a layer (unequip weapon, etc.) */
  unloadLayer(key: string): void {
    this.layers.delete(key);
  }

  /**
   * Pre-render each sprite frame to an offscreen canvas.
   * Key: "{action}:{frame}:{layerIndex}"
   */
  private prerender(key: string): void {
    const layer = this.layers.get(key);
    if (!layer) return;
    const { spr, act } = layer;

    for (let ai = 0; ai < act.actions.length; ai++) {
      const action = act.actions[ai];
      if (!action) continue;
      for (let fi = 0; fi < action.frames.length; fi++) {
        const frame = action.frames[fi]!;
        for (let li = 0; li < frame.layers.length; li++) {
          const actLayer = frame.layers[li]!;
          const cacheKey = `${ai}:${fi}:${li}`;
          if (actLayer.index < 0 || actLayer.index >= spr.frameCount) {
            layer.canvases.set(cacheKey, document.createElement('canvas')); // empty
          } else {
            const canvas = spr.frameToCanvas(actLayer.index);
            layer.canvases.set(cacheKey, canvas);
          }
        }
      }
    }
  }

  /**
   * Draw the composite sprite at (cx, groundY).
   * @param ctx      canvas context
   * @param action   RO action index (e.g. 14=walk E, 38=standby E)
   * @param frame    animation frame index
   * @param cx       centre X on canvas
   * @param groundY  ground line Y on canvas
   * @param scale    overall scale factor
   */
  /**
   * Draw the composite sprite at (cx, groundY).
   * @param ctx        canvas context
   * @param action     RO action index
   * @param frame      animation frame index
   * @param cx         centre X on canvas
   * @param groundY    ground line Y on canvas
   * @param scale      overall scale factor
   * @param flipX      if true, mirror the entire sprite horizontally
   */
  draw(
    ctx: CanvasRenderingContext2D,
    action: number,
    frame: number,
    cx: number,
    groundY: number,
    scale: number,
    flipX: boolean = false,
    shadowScale: number = 20,
  ): void {
    // Draw shadow first (under everything). Fixed size, not per-frame.
    this.drawShadow(ctx, cx, groundY, scale, shadowScale);
    // Collect all layers to draw with their render priority
    interface DrawEntry {
      canvas: HTMLCanvasElement;
      actLayer: ActLayer;
      priority: number;
      offsetX: number;  // extra offset (e.g. head attach point)
      offsetY: number;
    }
    const entries: DrawEntry[] = [];

    // Priority: body=10, head=15, weapon=25, shield=30, headgear-top=18,
    // headgear-mid=17, headgear-low=16 (for East direction)
    const priorities: Record<string, number> = {
      body: 10, head: 15, weapon: 25, shield: 30,
      'headgear-top': 18, 'headgear-mid': 17, 'headgear-low': 16,
    };

    // Get body attach points for head positioning.
    // In RO, head position = bodyAttachPoint - headAttachPoint.
    // The head's own attach point defines where its "neck" is,
    // the body's attach point defines where the neck should be on the body.
    // The difference gives the head's position relative to the body origin.
    let headOffsetX = 0, headOffsetY = 0;
    const bodyData = this.layers.get('body');
    const headData = this.layers.get('head');
    if (bodyData && headData && action < bodyData.act.actions.length) {
      const bodyAction = bodyData.act.actions[action];
      const headAction = headData.act.actions[action];
      if (bodyAction && frame < bodyAction.frames.length) {
        const bf = bodyAction.frames[frame];
        if (bf && bf.attachPoints.length > 0) {
          // Body attach point (where neck connects on body)
          const bAttach = bf.attachPoints[0]!;
          // Head's own attach point (where neck connects on head)
          let hAttachX = 0, hAttachY = 0;
          if (headAction && frame < headAction.frames.length) {
            const hf = headAction.frames[frame];
            if (hf && hf.attachPoints.length > 0) {
              hAttachX = hf.attachPoints[0]!.x;
              hAttachY = hf.attachPoints[0]!.y;
            }
          }
          // Net offset = body attach - head attach
          headOffsetX = bAttach.x - hAttachX;
          headOffsetY = bAttach.y - hAttachY;
        }
      }
    }

    for (const [key, layerData] of this.layers) {
      const { act, canvases } = layerData;
      if (action >= act.actions.length) continue;
      const actAction = act.actions[action];
      if (!actAction || frame >= actAction.frames.length) continue;
      const actFrame = actAction.frames[frame]!;

      for (let li = 0; li < actFrame.layers.length; li++) {
        const actLayer = actFrame.layers[li]!;
        if (actLayer.index < 0) continue;

        const cacheKey = `${action}:${frame}:${li}`;
        const canvas = canvases.get(cacheKey);
        if (!canvas || canvas.width === 0) continue;

        // Head and headgear layers use head attach point as position offset
        let extraX = 0, extraY = 0;
        if (key === 'head' || key.startsWith('headgear')) {
          extraX = headOffsetX;
          extraY = headOffsetY;
        }

        entries.push({
          canvas,
          actLayer,
          priority: (priorities[key] ?? 10) + li * 0.1,
          offsetX: extraX,
          offsetY: extraY,
        });
      }
    }

    // Sort by priority (ascending = drawn first = behind)
    entries.sort((a, b) => a.priority - b.priority);

    // Draw each layer
    for (const entry of entries) {
      const { canvas, actLayer, offsetX, offsetY } = entry;
      const w = canvas.width;
      const h = canvas.height;

      ctx.save();

      // RO .act: origin at feet, X right, Y up (negative = below feet).
      // Apply layer offset + any extra offset (head attach point).
      const px = cx + (actLayer.x + offsetX) * scale;
      const py = groundY + (actLayer.y + offsetY) * scale;

      ctx.translate(px, py);

      // Layer mirror (RO's own per-layer mirroring)
      let mirrored = actLayer.mirror !== 0;
      // Apply external flip (e.g. to face poring left)
      if (flipX) mirrored = !mirrored;
      if (mirrored) ctx.scale(-1, 1);

      const sx = actLayer.scaleX * scale;
      const sy = actLayer.scaleY * scale;
      if (sx !== 1 || sy !== 1) ctx.scale(sx, sy);

      if (actLayer.angle) ctx.rotate((actLayer.angle * Math.PI) / 180);
      if (actLayer.color[3] < 1) ctx.globalAlpha = actLayer.color[3];

      ctx.drawImage(canvas, -w / 2, -h / 2);

      ctx.restore();
    }
  }

  /**
   * Draw an elliptical shadow under the entity.
   * Size is fixed per entity (not per-frame), derived from the body sprite.
   */
  private drawShadow(
    ctx: CanvasRenderingContext2D,
    cx: number,
    groundY: number,
    scale: number,
    shadowScale: number,
  ): void {
    const sw = shadowScale * scale;
    const sh = sw * 0.3;
    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.beginPath();
    ctx.ellipse(cx, groundY, sw, sh, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** Get frame count for an action across all layers (max). */
  frameCount(action: number): number {
    let max = 0;
    for (const layer of this.layers.values()) {
      const fc = layer.act.frameCount(action);
      if (fc > max) max = fc;
    }
    return max;
  }

  /**
   * Compute the topmost pixel of the composite sprite for a given action/frame.
   * Returns the Y offset (negative = above feet) in .act coordinates.
   * Multiply by scale to get screen pixels.
   */
  getTopY(action: number, frame: number): number {
    // Get head offset (same logic as in draw())
    let headOffsetY = 0;
    const bodyData = this.layers.get('body');
    const headData = this.layers.get('head');
    if (bodyData && headData && action < bodyData.act.actions.length) {
      const bodyAction = bodyData.act.actions[action];
      const headAction = headData.act.actions[action];
      if (bodyAction && frame < bodyAction.frames.length) {
        const bf = bodyAction.frames[frame];
        if (bf && bf.attachPoints.length > 0) {
          const bAttach = bf.attachPoints[0]!;
          let hAttachY = 0;
          if (headAction && frame < headAction.frames.length) {
            const hf = headAction.frames[frame];
            if (hf && hf.attachPoints.length > 0) {
              hAttachY = hf.attachPoints[0]!.y;
            }
          }
          headOffsetY = bAttach.y - hAttachY;
        }
      }
    }

    let topY = 0; // default: at feet level
    for (const [key, layerData] of this.layers) {
      const { act, spr } = layerData;
      if (action >= act.actions.length) continue;
      const actAction = act.actions[action];
      if (!actAction || frame >= actAction.frames.length) continue;
      const actFrame = actAction.frames[frame]!;

      let extraY = 0;
      if (key === 'head' || key.startsWith('headgear')) extraY = headOffsetY;

      for (const layer of actFrame.layers) {
        if (layer.index < 0) continue;
        const sprFrame = spr.frames[layer.index];
        if (!sprFrame || sprFrame.height <= 0) continue;
        // Top of this layer = (layer.y + extraY) - height/2
        // In .act coords, more negative = higher above feet
        const layerTop = (layer.y + extraY) - sprFrame.height / 2;
        if (layerTop < topY) topY = layerTop;
      }
    }
    return topY;
  }
}
