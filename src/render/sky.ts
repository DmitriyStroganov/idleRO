/**
 * Day-night cycle.
 *
 * Drives EVERY visual time-of-day effect:
 *   - sky gradient (top/bottom colour)
 *   - sun/moon position + colour
 *   - star opacity
 *   - cloud colour
 *   - global tint applied to entities
 *
 * Concept: "progress fraction" = EXP between current base level and next.
 *   0.00 = dawn (just levelled up)
 *   0.25 = morning
 *   0.50 = noon
 *   0.75 = golden hour
 *   0.95 = sunset → on level-up, brief twilight flash then back to dawn.
 *
 * The phase is derived purely from `exp / nextLevelExp`. No real-time clock
 * — the player's grind *is* the time of day.
 */

export interface DayPhase {
  /** 0..1 progress through the day (= EXP progress to next level). */
  progress: number;
  /** Top-of-sky colour. */
  skyTop: string;
  /** Bottom-of-sky colour (horizon). */
  skyBottom: string;
  /** Sun/moon position on screen as { x, y } in [0..1] of viewport. */
  celestialPos: { x: number; y: number };
  /** Sun colour (if visible). */
  sunColor: string;
  /** Sun radius (px). */
  sunRadius: number;
  /** 0..1 — is it day (1), night (0) or transition? */
  daylight: number;
  /** Star opacity 0..1. */
  starOpacity: number;
  /** Tint to overlay on entities (rgba). */
  entityTint: string;
  /** Ground colour. */
  groundColor: string;
  /** Horizon-band colour (silhouette layer 0). */
  farSilhouette: string;
  /** Mid-layer silhouette. */
  midSilhouette: string;
  /** Near-layer silhouette. */
  nearSilhouette: string;
  /** Shadow length multiplier (1 = noon short, 3 = sunset long). */
  shadowLength: number;
  /** Shadow opacity. */
  shadowOpacity: number;
}

// Keyframe colours for the day. We lerp between these by progress.
interface Keyframe {
  p: number;
  skyTop: string;
  skyBottom: string;
  sunColor: string;
  daylight: number;
  starOpacity: number;
  entityTint: string;
  groundColor: string;
  farSilhouette: string;
  midSilhouette: string;
  nearSilhouette: string;
  shadowLength: number;
  shadowOpacity: number;
}

const KEYFRAMES: Keyframe[] = [
  // Dawn (just after level-up)
  { p: 0.00, skyTop: '#1d2b4a', skyBottom: '#f5a06b', sunColor: '#ffe2a8', daylight: 0.4,
    starOpacity: 0.5, entityTint: 'rgba(255, 170, 110, 0.18)',
    groundColor: '#3a3526', farSilhouette: '#2a2d4a', midSilhouette: '#1f2238', nearSilhouette: '#15172a',
    shadowLength: 3.5, shadowOpacity: 0.5 },

  // Morning
  { p: 0.20, skyTop: '#5fa8d3', skyBottom: '#c9e8f5', sunColor: '#fff4b8', daylight: 0.9,
    starOpacity: 0, entityTint: 'rgba(255, 240, 200, 0.05)',
    groundColor: '#3d5a36', farSilhouette: '#3d5a78', midSilhouette: '#324e60', nearSilhouette: '#243a48',
    shadowLength: 1.8, shadowOpacity: 0.3 },

  // Noon
  { p: 0.50, skyTop: '#4a90e2', skyBottom: '#a8d8f5', sunColor: '#ffffff', daylight: 1.0,
    starOpacity: 0, entityTint: 'rgba(255, 255, 255, 0)',
    groundColor: '#4a6f3e', farSilhouette: '#5a7d8a', midSilhouette: '#4a6570', nearSilhouette: '#384f58',
    shadowLength: 1.0, shadowOpacity: 0.25 },

  // Golden hour
  { p: 0.78, skyTop: '#d97b3a', skyBottom: '#f5d76b', sunColor: '#ffae5a', daylight: 0.7,
    starOpacity: 0, entityTint: 'rgba(255, 160, 70, 0.18)',
    groundColor: '#5a4a26', farSilhouette: '#5a3a48', midSilhouette: '#48303c', nearSilhouette: '#32242a',
    shadowLength: 3.0, shadowOpacity: 0.45 },

  // Sunset
  { p: 0.93, skyTop: '#7a1d3a', skyBottom: '#e85a2a', sunColor: '#ff5a2a', daylight: 0.4,
    starOpacity: 0.2, entityTint: 'rgba(255, 80, 40, 0.28)',
    groundColor: '#4a261a', farSilhouette: '#3a1a2a', midSilhouette: '#2a121e', nearSilhouette: '#1a0a12',
    shadowLength: 4.5, shadowOpacity: 0.55 },

  // Twilight flash (very close to level-up)
  { p: 0.99, skyTop: '#0a0a1f', skyBottom: '#2a1a3a', sunColor: '#aa55cc', daylight: 0.1,
    starOpacity: 0.6, entityTint: 'rgba(120, 60, 200, 0.32)',
    groundColor: '#1a1426', farSilhouette: '#15102a', midSilhouette: '#0d0a1f', nearSilhouette: '#06050f',
    shadowLength: 6.0, shadowOpacity: 0.65 },
];

/**
 * Compute the current day phase from a 0..1 progress value.
 * Handles lerp + clamping.
 */
export function computePhase(progress: number): DayPhase {
  const p = clamp(progress, 0, 1);

  // Find surrounding keyframes.
  let a = KEYFRAMES[0]!;
  let b = KEYFRAMES[KEYFRAMES.length - 1]!;
  for (let i = 0; i < KEYFRAMES.length - 1; i++) {
    if (p >= KEYFRAMES[i]!.p && p <= KEYFRAMES[i + 1]!.p) {
      a = KEYFRAMES[i]!;
      b = KEYFRAMES[i + 1]!;
      break;
    }
  }
  const span = Math.max(0.0001, b.p - a.p);
  const t = clamp((p - a.p) / span, 0, 1);

  // Celestial body (sun by day, moon by night) follows an arc.
  // x sweeps left-to-right as progress goes 0..1.
  // y is sin-arc — high at noon (progress 0.5), low at edges.
  const celestialX = 0.1 + 0.8 * p;
  const celestialY = 0.7 - 0.6 * Math.sin(p * Math.PI);

  const daylight = lerp(a.daylight, b.daylight, t);
  const sunRadius = lerp(28, 24, t) + Math.sin(p * Math.PI) * 6;

  return {
    progress: p,
    skyTop: lerpColor(a.skyTop, b.skyTop, t),
    skyBottom: lerpColor(a.skyBottom, b.skyBottom, t),
    celestialPos: { x: celestialX, y: celestialY },
    sunColor: lerpColor(a.sunColor, b.sunColor, t),
    sunRadius,
    daylight,
    starOpacity: lerp(a.starOpacity, b.starOpacity, t),
    entityTint: t < 0.5 ? a.entityTint : b.entityTint,
    groundColor: lerpColor(a.groundColor, b.groundColor, t),
    farSilhouette: lerpColor(a.farSilhouette, b.farSilhouette, t),
    midSilhouette: lerpColor(a.midSilhouette, b.midSilhouette, t),
    nearSilhouette: lerpColor(a.nearSilhouette, b.nearSilhouette, t),
    shadowLength: lerp(a.shadowLength, b.shadowLength, t),
    shadowOpacity: lerp(a.shadowOpacity, b.shadowOpacity, t),
  };
}

// ============================================================================
// Colour helpers
// ============================================================================

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function parseHex(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return [r, g, b];
}

function toHex(n: number): string {
  const c = Math.max(0, Math.min(255, Math.round(n)));
  return c.toString(16).padStart(2, '0');
}

export function lerpColor(a: string, b: string, t: number): string {
  const [r1, g1, b1] = parseHex(a);
  const [r2, g2, b2] = parseHex(b);
  return `#${toHex(lerp(r1, r2, t))}${toHex(lerp(g1, g2, t))}${toHex(lerp(b1, b2, t))}`;
}

// Deterministic star field (so stars don't dance every frame).
export const STARS: { x: number; y: number; size: number; twinkle: number }[] = (
  () => {
    const out: { x: number; y: number; size: number; twinkle: number }[] = [];
    let seed = 12345;
    for (let i = 0; i < 80; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const x = (seed % 1000) / 1000;
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const y = (seed % 600) / 1000;          // upper 60%
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const size = 0.5 + (seed % 100) / 100;
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      const twinkle = (seed % 1000) / 1000;
      out.push({ x, y, size, twinkle });
    }
    return out;
  }
)();
