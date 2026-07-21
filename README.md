# idleRO

> An idle auto-battler inspired by Ragnarok Online (pre-Renewal).
> Single-player PWA. The character grinds automatically; your job is to
> build them right and pick the right behaviour pattern.

## Status

**Pre-alpha — engine + minimal vertical slice (Archer branch).**

What works today:

- ✅ Pre-Renewal stat / damage / ASPD / cast-time formulas (61 unit tests)
- ✅ Card modifier pipeline (race × element × size — multiplicative categories)
- ✅ Refinement (weapon/armor) + tables for break chances
- ✅ Composite-sprite system (body + hair + hat + weapon + garment + shield)
- ✅ Deterministic simulation (20 tps fixed tick, seedable RNG)
- ✅ AI Level 1: presets (Aggressive / Defensive / AoE Farmer / Sniper Kite / Buff Rotate)
- ✅ Real-time auto-battle with follow-camera, side-scroller 1D layout
- ✅ Loot drops, EXP, level-ups, potions
- ✅ PWA installable on mobile

What's next:

- 🚧 Real RO-style sprites (today: coloured placeholder shapes)
- 🚧 More maps / monster variety
- 🚧 AI Level 2 (priority-list) and Level 3 (node-graph editor)
- 🚧 Town screen, save/load, stat/skill allocation UI
- 🚧 PvP arena (deterministic AI vs AI)

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # run the formula unit tests
npm run build    # production PWA build into dist/
```

Open the dev URL on your phone (same network) to install as PWA.

## Architecture

Three hard rules:

1. **Engine has zero DOM dependencies.** `src/engine/**` is pure TypeScript
   that can run in node, browser, or worker.
2. **Deterministic.** Same `(initial state, seed, strategies)` always
   produces the same outcome. This is what enables PvP arena later.
3. **Data-driven.** Mobs / skills / items / cards / loot are tables, not
   code. Drawn close to rathena's `db/(pre-re)/*.yml` shape so we can
   convert directly.

```
src/
  engine/
    types.ts          # All public type contracts
    rng.ts            # Deterministic SplitMix64+xorshift RNG
    sim.ts            # Fixed-tick simulation loop
    formulas/
      stats.ts        # HP/SP/HIT/FLEE/CRIT/ATK/MATK
      aspd.ts         # ASPD + Amotion
      cast.ts         # Cast time + after-cast delay
      refine.ts       # Weapon/armor refinement
      cards.ts        # Card modifier aggregation
      damage.ts       # Physical damage pipeline
  data/
    jobs.ts           # Novice → Archer → Hunter → Sniper
    skills.ts         # Archer-branch skill DB
    mobs.ts           # Lunatic / Spore / Wolf / Savage / Eddga
    items.ts          # Weapons, armor, cards
    loot.ts           # Drop tables (0.01% card rate)
  ai/
    strategy.ts       # Strategy interface + preset config
    preset-executor.ts  # Level 1 AI implementation
  render/
    sprites.ts        # SpriteProvider contract + placeholder impl
    composite.ts      # Layered character drawer (paper-doll)
    canvas.ts         # Side-scroller canvas renderer
  main.ts             # Bootstrap, world setup, rAF game loop
tests/
  formulas/*.test.ts  # 61 tests against iRowiki reference numbers
docs/
  MVP.md              # Roadmap with milestones
  FORMULAS.md         # Per-formula references
```

## References

- iRowiki classic: https://irowiki.org/classic/
- rathena emulator source: https://github.com/rathena/rathena
- Card mechanics (Hydra, Andre, Thara Frog, ...): https://irowiki.org/classic/Cards

## License

Private hobby project. Not affiliated with Gravity or Lee Myung-jin.
Sprite assets (when added) will be original work in RO style.
