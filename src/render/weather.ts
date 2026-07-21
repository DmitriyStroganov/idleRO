/**
 * Weather particle system.
 *
 * Per session we keep a particle pool. `tick()` advances particles, `draw()`
 * renders them. Currently supports: rain, snow. (Fog is a separate overlay
 * in the renderer; could be moved here later.)
 *
 * Particles are deterministic per session — wind/drift seeded by `seed`.
 */

export type WeatherKind = 'clear' | 'rain' | 'snow' | 'leaves';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  life: number;
  ttl: number;
}

export class Weather {
  private particles: Particle[] = [];
  private windSeed: number;
  /** intensity 0..1 — controls target particle count. */
  intensity: number;
  kind: WeatherKind;

  constructor(kind: WeatherKind = 'clear', intensity = 0.5, seed = 7) {
    this.kind = kind;
    this.intensity = intensity;
    this.windSeed = seed;
  }

  setWeather(kind: WeatherKind, intensity: number): void {
    this.kind = kind;
    this.intensity = intensity;
  }

  tick(dtMs: number, viewW: number, viewH: number): void {
    if (this.kind === 'clear') {
      this.particles = [];
      return;
    }
    const target = Math.floor(this.targetCount(viewW));
    while (this.particles.length < target) this.particles.push(this.spawn(viewW, viewH, /*atTop*/ true));

    const dt = dtMs / 1000;
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life += dtMs;
      // wrap horizontally
      if (p.x < -20) p.x += viewW + 40;
      if (p.x > viewW + 20) p.x -= viewW + 40;
    }
    // Remove dead/off-screen
    this.particles = this.particles.filter((p) => p.y < viewH + 20 && p.life < p.ttl);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (this.kind === 'clear') return;
    ctx.save();
    if (this.kind === 'rain') {
      ctx.strokeStyle = 'rgba(180, 200, 230, 0.55)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (const p of this.particles) {
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.02, p.y - p.vy * 0.02);
      }
      ctx.stroke();
    } else if (this.kind === 'snow') {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      for (const p of this.particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (this.kind === 'leaves') {
      ctx.fillStyle = 'rgba(200, 120, 40, 0.7)';
      for (const p of this.particles) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.life * 0.005);
        ctx.fillRect(-p.size, -p.size / 2, p.size * 2, p.size);
        ctx.restore();
      }
    }
    ctx.restore();
  }

  private targetCount(viewW: number): number {
    if (this.kind === 'rain')   return Math.floor(viewW * 0.5 * this.intensity);
    if (this.kind === 'snow')   return Math.floor(viewW * 0.15 * this.intensity);
    if (this.kind === 'leaves') return Math.floor(viewW * 0.05 * this.intensity);
    return 0;
  }

  private spawn(viewW: number, _viewH: number, atTop: boolean): Particle {
    const wind = pseudo(this.windSeed) * 60 - 30;
    if (this.kind === 'rain') {
      return {
        x: Math.random() * (viewW + 100) - 50,
        y: atTop ? -10 : Math.random() * _viewH,
        vx: wind,
        vy: 800 + Math.random() * 300,
        size: 1,
        life: 0,
        ttl: 3000,
      };
    }
    if (this.kind === 'snow') {
      return {
        x: Math.random() * (viewW + 100) - 50,
        y: atTop ? -10 : Math.random() * _viewH,
        vx: wind * 0.4,
        vy: 50 + Math.random() * 60,
        size: 1 + Math.random() * 2,
        life: 0,
        ttl: 8000,
      };
    }
    // leaves
    return {
      x: Math.random() * (viewW + 100) - 50,
      y: atTop ? -10 : Math.random() * _viewH,
      vx: wind * 0.3 + 20,
      vy: 30 + Math.random() * 40,
      size: 2 + Math.random() * 3,
      life: 0,
      ttl: 6000,
    };
  }
}

function pseudo(seed: number): number {
  const n = Math.sin(seed * 12.9898) * 43758.5453;
  return n - Math.floor(n);
}
