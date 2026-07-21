/**
 * Direct sprite-pipeline test:
 *   1. Open dev URL (login screen — canvas hidden, that's fine).
 *   2. In-page: import the renderer modules, build a RospriteProvider,
 *      manually draw a player body into a test canvas, read pixels back.
 *   3. Repeat for a monster sprite.
 *
 * This bypasses the WebSocket / login flow and tests ONLY whether
 * ragassets sprites render correctly through our RospriteProvider.
 */

import puppeteer from 'puppeteer-core';
import { writeFileSync } from 'node:fs';

const DEV_URL = process.env.SMOKE_URL ?? 'http://localhost:5173';
const CHROME = process.env.CHROME ?? '/snap/bin/chromium';

async function main() {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 800, height: 400 });
    page.on('pageerror', (e) => console.error('pageerror:', String(e)));
    page.on('console', (msg) => {
      if (msg.type() === 'error') console.log('[browser console]', msg.text());
    });

    console.log(`▶ Opening ${DEV_URL}`);
    await page.goto(DEV_URL, { waitUntil: 'networkidle2', timeout: 30_000 });

    // Inject a test harness that loads our actual modules via dynamic import.
    const result = await page.evaluate(async () => {
      const out = { tests: [] };

      // Dynamic-import the source modules through Vite's dev server.
      const { RospriteProvider } = await import('/src/render/ro-sprite-provider.ts');
      const { drawComposite } = await import('/src/render/composite.ts');

      const provider = new RospriteProvider();

      // Helper: draw a layer and measure non-transparent pixels.
      async function testSprite(label, layerKey, anim, facing) {
        // Wait for the sprite to load.
        for (let i = 0; i < 20; i++) {
          const frame = provider.get(layerKey, anim, facing, 0);
          // The placeholder is a flat coloured rect — we can't easily detect
          // "did the real RO sprite load yet", so just retry for ~3s.
          await new Promise((r) => setTimeout(r, 150));
        }
        const c = document.createElement('canvas');
        c.width = 80; c.height = 100;
        const ctx = c.getContext('2d');
        drawComposite(ctx, {
          layers: { body: layerKey },
          hairColor: 0, clothColor: 0, skinColor: 0,
        }, provider, 40, 100, {
          facing, animation: anim, tick: 0,
        });
        const data = ctx.getImageData(0, 0, 80, 100).data;
        let nonZero = 0;
        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] > 0) nonZero++;
        }
        out.tests.push({ label, layerKey, anim, facing, nonZeroPixels: nonZero, total: 80 * 100 });
        return c.toDataURL();
      }

      out.archerIdle = await testSprite('Archer idle (right)', 'Body_Archer', 'idle', 'right');
      out.archerWalk = await testSprite('Archer walk (left)', 'Body_Archer', 'walk', 'left');
      out.noviceIdle = await testSprite('Novice idle', 'Body_Novice', 'idle', 'right');
      out.sniperIdle = await testSprite('Sniper idle', 'Body_Sniper', 'idle', 'right');
      out.lunatic = await testSprite('Lunatic idle', 'Sprite_Lunatic', 'idle', 'left');
      out.wolf = await testSprite('Wolf walk', 'Sprite_Wolf', 'walk', 'right');
      out.eddga = await testSprite('Eddga idle', 'Sprite_Eddga', 'idle', 'right');

      return out;
    });

    console.log('\n=== Sprite render results ===');
    for (const t of result.tests) {
      const pct = ((t.nonZeroPixels / t.total) * 100).toFixed(1);
      const icon = t.nonZeroPixels > 50 ? '✓' : '✗';
      console.log(`  ${icon} ${t.label.padEnd(28)} ${t.nonZeroPixels.toString().padStart(5)} px (${pct}%)`);
    }

    // Save one of the data URLs as a real PNG file so we can inspect.
    const dataUrl = result.archerIdle;
    const base64 = dataUrl.split(',')[1];
    writeFileSync('/tmp/idle-archer-idle.png', Buffer.from(base64, 'base64'));
    console.log('\n✓ Sample PNG saved: /tmp/idle-archer-idle.png');

    writeFileSync('/tmp/idle-smoke-result.json', JSON.stringify(result.tests, null, 2));
  } finally {
    // Try graceful close; ignore EACCES (browser may already be gone).
    try { await browser.close(); } catch { /* ignore */ }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
