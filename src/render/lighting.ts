/**
 * Lighting & shadow utilities.
 *
 *   - drawEntityShadow: ellipse under entity, length scaled by phase.
 *   - applyEntityTint: overlay phase entityTint over a drawn sprite.
 *   - drawTwilightFlash: brief purple-blue flash on level-up.
 */

import type { DayPhase } from './sky';

/**
 * Draw a soft elliptical shadow under an entity at (cx, groundY).
 * The shadow's horizontal extent grows with phase.shadowLength (sunset =
 * long stretched shadow), opacity with phase.shadowOpacity.
 *
 * `dir` (-1 = facing left, +1 = right) controls which side the shadow
 * stretches — opposite the sun, which conceptually is on the celestial
 * arc (positive side mostly).
 */
export function drawEntityShadow(
  ctx: CanvasRenderingContext2D,
  cx: number,
  groundY: number,
  phase: DayPhase,
  dir: number,
  radius: number = 18,
): void {
  const stretch = phase.shadowLength;
  const opacity = phase.shadowOpacity;
  // Shadow extends in the -x direction (sun is on +x).
  // If facing left, dir = -1, shadow extends right (since light is right).
  const dirX = dir >= 0 ? -1 : 1;

  ctx.save();
  ctx.translate(cx, groundY);
  ctx.scale(1 + stretch * 0.4, 0.35);
  ctx.translate(dirX * stretch * 8, 0);

  // Soft radial gradient for natural look.
  const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
  grad.addColorStop(0, `rgba(0, 0, 0, ${opacity})`);
  grad.addColorStop(0.6, `rgba(0, 0, 0, ${opacity * 0.5})`);
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(0, 0, radius, radius, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * Apply the phase's entityTint over the area defined by (cx, groundY - h, w, h).
 * Caller should set globalCompositeOperation appropriately (we use 'source-atop'
 * semantically — but actually 'overlay' looks better for tint).
 */
export function applyEntityTint(
  ctx: CanvasRenderingContext2D,
  cx: number,
  groundY: number,
  w: number,
  h: number,
  phase: DayPhase,
): void {
  if (phase.entityTint === 'rgba(255, 255, 255, 0)') return;
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = phase.entityTint;
  ctx.fillRect(cx - w / 2, groundY - h, w, h);
  ctx.restore();
}

/**
 * Twilight flash — a brief purple-blue overlay that pulses once on level up.
 *
 * `age` is ms since the level-up event; `ttl` is total duration in ms.
 * Returns true while the flash is still active (so caller can request
 * another frame).
 */
export function drawTwilightFlash(
  ctx: CanvasRenderingContext2D,
  viewW: number,
  viewH: number,
  age: number,
  ttl: number,
): boolean {
  if (age >= ttl) return false;
  const t = age / ttl;
  // Fade in (0..0.15), hold (0.15..0.7), fade out (0.7..1).
  let alpha: number;
  if (t < 0.15) alpha = t / 0.15;
  else if (t > 0.7) alpha = 1 - (t - 0.7) / 0.3;
  else alpha = 1;
  alpha *= 0.55;

  ctx.save();
  // Pulse — brightest in the centre, fades to edges.
  const grad = ctx.createRadialGradient(
    viewW / 2, viewH / 2, 0,
    viewW / 2, viewH / 2, Math.max(viewW, viewH) * 0.7,
  );
  grad.addColorStop(0, `rgba(255, 240, 200, ${alpha * 0.5})`);
  grad.addColorStop(0.4, `rgba(170, 80, 200, ${alpha})`);
  grad.addColorStop(1, `rgba(20, 10, 40, ${alpha * 0.8})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, viewW, viewH);
  ctx.restore();
  return true;
}
