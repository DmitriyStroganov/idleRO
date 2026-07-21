/**
 * Parallax background — three layers of silhouettes drawn against the sky.
 *
 *   - Far layer: distant mountains, very slow scroll
 *   - Mid layer: rolling hills, slow
 *   - Near layer: tree-line / bushes, fast
 *
 * Each layer is drawn as a polyline silhouette filled with the phase's
 * silhouette colour. The scroll offset is derived from the camera x.
 *
 * This is procedural — no sprite assets needed. The shapes are deterministic
 * from a seed, so they look the same frame-to-frame.
 */

import type { DayPhase } from './sky';

export interface ParallaxLayer {
  /** 0..1 — fraction of camera scroll applied to this layer. */
  parallaxFactor: number;
  /** Base Y of the silhouette line, as a fraction of viewport height. */
  baseY: number;
  /** Amplitude of the silhouette bumps (px). */
  amplitude: number;
  /** Wavelength of bumps (px). */
  wavelength: number;
  /** Random seed for jitter. */
  seed: number;
}

export const DEFAULT_LAYERS: ParallaxLayer[] = [
  // Far mountains
  { parallaxFactor: 0.05, baseY: 0.55, amplitude: 80, wavelength: 320, seed: 11 },
  // Mid hills
  { parallaxFactor: 0.15, baseY: 0.72, amplitude: 50, wavelength: 180, seed: 23 },
  // Near tree-line
  { parallaxFactor: 0.35, baseY: 0.88, amplitude: 24, wavelength: 110, seed: 37 },
];

export function drawParallax(
  ctx: CanvasRenderingContext2D,
  viewW: number,
  viewH: number,
  cameraX: number,
  phase: DayPhase,
  layers: ParallaxLayer[] = DEFAULT_LAYERS,
  colors?: [string, string, string],
): void {
  const layerColors: [string, string, string] = colors ?? [
    phase.farSilhouette,
    phase.midSilhouette,
    phase.nearSilhouette,
  ];
  layers.forEach((layer, idx) => {
    drawLayer(ctx, viewW, viewH, cameraX, layer, layerColors[idx]!, phase);
  });
}

function drawLayer(
  ctx: CanvasRenderingContext2D,
  viewW: number,
  viewH: number,
  cameraX: number,
  layer: ParallaxLayer,
  color: string,
  phase: DayPhase,
): void {
  const offset = cameraX * layer.parallaxFactor;
  const baseYpx = viewH * layer.baseY;
  const amp = layer.amplitude;
  const wl = layer.wavelength;

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-50, viewH + 50);

  // Trace silhouette from left to right.
  const step = 8;
  for (let x = -50; x <= viewW + 50; x += step) {
    const worldX = x + offset;
    // Smooth combination of two sine waves for natural look + a per-layer jitter.
    const a = Math.sin(worldX / wl) * amp;
    const b = Math.sin(worldX / (wl * 0.37) + layer.seed) * amp * 0.3;
    const jitter = pseudoRandom(worldX, layer.seed) * 6 - 3;
    const y = baseYpx + a + b + jitter;
    ctx.lineTo(x, y);
  }

  ctx.lineTo(viewW + 50, viewH + 50);
  ctx.closePath();
  ctx.fill();

  // Apply a subtle darkness tint where the layer is lit by phase entityTint
  // (creates "atmospheric perspective" — distant layers take sky color).
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.18 * (1 - phase.daylight);
  ctx.fillStyle = phase.skyBottom;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

function pseudoRandom(x: number, seed: number): number {
  const n = Math.sin(x * 12.9898 + seed * 78.233) * 43758.5453;
  return n - Math.floor(n);
}
