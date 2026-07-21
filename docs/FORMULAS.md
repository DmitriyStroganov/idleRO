# Formula references

Every formula in `src/engine/formulas/` is checked by tests under
`tests/formulas/`. References below are the canonical sources we trust.

## stats.ts — primary stats & derivatives

| Quantity | Formula | Reference |
|---|---|---|
| Effective stat | `base + equip + buff` | irowiki.org/classic/Stats |
| MaxHP | `floor( (jobHpMod + baseLevel * jobHpMult + VIT) * (1 + pct/100) + flat )` | rathena status_calc_pc |
| MaxSP | `floor( (jobSpMod + baseLevel * jobSpMult + INT) * (1 + pct/100) + flat )` | rathena status_calc_pc |
| HIT | `BaseLevel + DEX − BlindPenalty` | irowiki HIT |
| FLEE | `BaseLevel + AGI` | irowiki FLEE |
| CRIT | `LUK * 0.3` (+ card bonus) | irowiki Crit |
| Crit shield | `LUK * 0.2` (subtracted from attacker CRIT) | irowiki Crit |
| Status ATK | `STR + floor(STR/10)² + floor(DEX/5) + floor(LUK/5)` | irowiki classic ATK |
| MATK min | `INT + floor(INT/7)²` | irowiki classic MATK |
| MATK max | `INT + floor(INT/5)²` | irowiki classic MATK |
| Weapon variance | `±weaponAtk * (1 − DEX/100)` | rathena battle.cpp |
| Stat point cost | `2 + floor(N / 10)` to go from N → N+1 | irowiki Stat System |

## aspd.ts — attack speed

| Quantity | Formula | Reference |
|---|---|---|
| ASPD | `200 − (250 − AGI − DEX/4) * weaponDelay * (1 − pctBonus/100)` | rathena status_calc_aspd |
| Amotion (ms) | `floor( (200 − ASPD) * 10 )` | rathena battle.cpp |
| ASPD cap | `[100, 190]` for non-expanded | irowiki ASPD |
| weaponDelay table | per `WeaponType` — see `WEAPON_BASE_DELAY` | rathena aspd_db.txt |

## cast.ts — casting

| Quantity | Formula | Reference |
|---|---|---|
| Cast time | `baseCastMs * max(0, 1 − DEX/150) * (1 − pctBonus/100)` | irowiki Casting Time |
| After-cast delay | `baseDelayMs * (1 − pctBonus/100)` | rathena skill_delayfix |
| Instant cast | when DEX ≥ 150 OR castTime < 50 ms | — |

## refine.ts — refinement

| Quantity | Formula | Reference |
|---|---|---|
| Weapon ATK/level | lv1: +2, lv2: +3, lv3: +5, lv4: custom | rathena refine_db.yml |
| Armor DEF/level | +0.7 per level | rathena refine_db.yml |
| Safe limit | +4 (no break below) | irowiki Item Upgrade |
| Success rates | per-weapon-level tables in `REFINE_SUCCESS_RATE` | rathena refine_db.yml |
| Material | lv1: Phracon, lv2: Emveretarcon, lv3/lv4/armor: Oridecon | irowiki |

## cards.ts — modifier aggregation

Two rules (verified by tests):

1. **Within a category, additive.** 3 Hydra → +60% vs DemiHuman.
2. **Across categories, multiplicative.** Hydra + Vadon + Minorous
   against DemiHuman/Fire/Large = `1.2 × 1.2 × 1.15`.

```ts
cardDamageMultiplier(mods, race, element, size) =
  (1 + raceDamage[race]/100) *
  (1 + elementDamage[element]/100) *
  (1 + sizeDamage[size]/100)
```

## damage.ts — physical damage pipeline

Stage order (faithful to rathena battle.cpp / iRowiki classic):

```
1. Roll crit   (LUK * 0.3 + cards)
2. Roll hit/flee (unless crit or ignoresFlee)
3. baseATK =
       statusATK
     + weaponATK(max on crit, else rolled in variance)
     + refineATK(weaponLevel, refineLevel)
     + ammoATK
     + flatFromCards (Andre, etc.)
   all multiplied by (1 + pctATK/100)
4. Apply skill multiplier (skillMultiplier from skill level)
5. Card damage multipliers (race × element × size)
6. Element multiplier (atkElement vs targetElementProperty)
7. Weapon size penalty (weaponType × targetSize)
8. Crit bonus (×1.5 default, override via skillCritMultiplier)
9. Subtract target DEF (equip + VIT)  [unless ignoresDef]
10. Apply target damage reduction (Raydric, Thara Frog, Energy Coat)
11. Floor at 1 damage on a hit
```

### Element multiplier table

atk\def      | Neu | Wat | Ear | Fir | Win | Poi | Hol | Sha | Gho | Und
------------ | --- | --- | --- | --- | --- | --- | --- | --- | --- | ---
**Neutral**  | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 0.0 | 1.0
**Water**    | 1.0 | 0.25| 1.0 | 1.5 | 0.5 | 1.0 | 1.0 | 1.0 | 0.75| 1.0
**Earth**    | 1.0 | 1.0 | 0.25| 0.5 | 1.5 | 1.0 | 1.0 | 1.0 | 0.75| 1.0
**Fire**     | 1.0 | 0.5 | 1.5 | 0.25| 1.0 | 1.0 | 1.0 | 1.0 | 0.75| 1.5
**Wind**     | 1.0 | 1.5 | 0.5 | 1.0 | 0.25| 1.0 | 1.0 | 1.0 | 0.75| 1.0
**Poison**   | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 0.0 | 0.75| 0.5 | 0.75| 0.5
**Holy**     | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 0.0 | 1.25| 1.0 | 1.5
**Shadow**   | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 1.25| 0.0 | 1.0 | 0.0
**Ghost**    | 0.0 | 0.75| 0.75| 0.75| 0.75| 0.75| 0.75| 0.75| 1.25| 0.75
**Undead**   | 1.0 | 1.0 | 1.0 | 1.0 | 1.0 | 0.5 | 1.0 | 1.0 | 0.0 | 0.0

Monster element level (1..4) amplifies away from 1.0.

### Weapon size modifier table (fraction of damage)

| Weapon    | Small | Medium | Large |
|-----------|-------|--------|-------|
| Fist      | 1.00  | 1.00   | 1.00  |
| Dagger    | 1.00  | 0.75   | 0.50  |
| Sword     | 0.75  | 1.00   | 0.75  |
| Bow       | 1.00  | 1.00   | 1.00  |
| Spear     | 0.75  | 0.75   | 1.00  |
| Axe       | 0.50  | 0.75   | 1.00  |
| Mace/Staff| 0.75  | 1.00   | 1.00  |
| Katar     | 0.75  | 1.00   | 0.75  |

## Notes / caveats

- Magic damage pipeline (`damage_magic.ts`) is post-MVP. Same skeleton.
- Skill-flagged damage modifiers (Asura Strike etc.) require per-skill
  overrides — kept as TODOs in `skills.ts`.
- iRowiki and rathena occasionally disagree by 1 unit on rounding edge
  cases. We follow rathena where there's a conflict.
