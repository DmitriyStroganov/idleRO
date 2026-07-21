# MVP Roadmap

## Stage 0 — Engine skeleton ✅

- Vite + TS + Vitest + PWA
- Game loop with fixed tick (50 ms / 20 tps)
- Deterministic RNG
- Canvas + placeholder shapes

## Stage 1 — Pre-Renewal formulas ✅

All verified by unit tests against iRowiki classic:

- HP / SP / HIT / FLEE / CRIT / ATK / MATK
- ASPD + Amotion
- Cast time (DEX reduction, max cap at 150)
- Refinement (weapon lv1-4, armor) + break chance tables
- Card aggregation (race × element × size — multiplicative)
- Full physical damage pipeline
- EXP curves (base/job)

## Stage 2 — Combat simulation ✅

- Auto-attack with ASPD
- Skill casting (cast bar, after-cast delay)
- Status effects (buffs maintained by AI)
- Monster AI (aggro, chase, attack, respawn)
- Loot drop & pickup

## Stage 3 — MVP content ✅ (starter)

- 1 map (320-cell lane, side-scroller)
- 5 mob types (Lunatic → Spore → Wolf → Savage → Eddga boss)
- Archer-class progression (job data only; UI for class-change is pending)
- 30+ skills (some are stubs)
- ~30 items, ~17 cards (icons of each bonus category)

## Stage 4 — AI presets ✅ (Level 1)

- 5 presets: Aggressive / Defensive / AoE Farmer / Sniper Kite / Buff Rotate
- UI bar at the bottom to switch presets live

---

## Stage 5 — Player progression UI (next)

- Stat allocation screen (STR/AGI/VIT/INT/DEX/LUK)
- Skill tree (with prerequisites, locked until job level)
- Inventory + equipment paper-doll
- Town screen between combats

## Stage 6 — Save / Load

- LocalStorage with schema versioning
- Multiple character slots
- Auto-save every 30 s

## Stage 7 — AI Level 2 (priority-list)

OpenKore-style `config.txt` rules:

```
useSelfSkill Improve Concentration {
  whenStatusActive isActive == 0
  sp > 20
}
attackSkillSlot Double Strafe {
  dist > 5
  sp > 12
  monsters Lunatic, Wolf
}
```

Implemented as a typed config object with the same `decide()` contract.

## Stage 8 — AI Level 3 (node editor)

Visual drag-and-drop graph: condition nodes + action nodes.
Compiled to a runtime predicate over `AiContext`.

## Stage 9 — Refinement NPC + card socketing

- Town NPC "Hollgrehenn" for refining (with material + zeny cost)
- Card insertion / removal (with success chance)
- Card sets (4-venom, etc.)

## Stage 10 — PvP arena

Both players' AI strategies clash in a deterministic simulation:
- Same seed, same starting stats (or normalized)
- Match result is reproducible from `(seed, strategyA, strategyB)`
- ELO-style ladder

## Stage 11 — More classes

- Swordman → Knight → Lord Knight
- Mage → Wizard → High Wizard
- Acolyte → Priest → High Priest
- Thief → Assassin → Assassin Cross
- Merchant → Blacksmith → Whitesmith

## Stage 12 — Real RO-style sprites

Replace `PlaceholderSpriteProvider` with a real one:
- Body sprites per job/gender
- 8-direction walk/attack/cast animations
- Hair styles + dye palettes
- Composite paper-doll rendering already in place

## Stretch

- Co-op multiplayer (shared map)
- Guild system
- Instance dungeons
