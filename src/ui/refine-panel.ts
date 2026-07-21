/**
 * Refine NPC panel — "Hollgrehenn" style.
 *
 * Lists every refineable equipment in inventory + currently equipped.
 * Each row shows: name, current refine, success rate, cost (zeny + material).
 * Click "Refine" to attempt. Broken items are removed and reported via toast.
 */

import type { Ui } from './state';
import { el, clear, button, fmtNum } from './dom';
import { attemptRefine } from '@engine/character-ops';
import { refineSuccessRate, refineZenyCost, refineMaterial } from '@engine/formulas/refine';
import { ITEMS } from '@data/items';
import { getItemIconSrc } from '@data/item-icons';
import type { ArmorSlot, Character, EquipmentInstance } from '@engine/types';
import { nextFloat } from '@engine/rng';

export function renderRefine(root: HTMLElement, ui: Ui): void {
  clear(root);
  const { player } = ui.state;

  const panel = el('div', { class: 'panel refine-panel' }, []);
  panel.appendChild(el('h2', { text: '⚒  Refine NPC' }));
  panel.appendChild(el('p', {
    class: 'subtitle',
    text: `Zeny: ${fmtNum(player.zeny)}  ·  Safe up to +4`,
  }));

  // Collect candidates: equipped + inventory equipment.
  const candidates: { instance: EquipmentInstance; where: string }[] = [];
  for (const slot of Object.keys(player.equipment) as ArmorSlot[]) {
    const inst = player.equipment[slot];
    if (inst) candidates.push({ instance: inst, where: `Equipped (${slot})` });
  }
  for (const entry of player.inventory) {
    if (entry.instance) candidates.push({ instance: entry.instance, where: 'Inventory' });
  }

  const refineable = candidates.filter((c) => {
    const def = ITEMS[c.instance.itemId];
    return def?.refineable;
  });

  if (refineable.length === 0) {
    panel.appendChild(el('div', {
      class: 'info-box info-warning',
      text: 'No refineable equipment. Loot weapons/armor from monsters first.',
    }));
  }

  for (const cand of refineable) {
    panel.appendChild(refineRow(player, cand.instance, cand.where, () => ui.refresh()));
  }

  panel.appendChild(el('div', { class: 'actions' }, [
    button('← Back', () => ui.back()),
  ]));

  root.appendChild(panel);
}

function refineRow(
  player: Character,
  inst: EquipmentInstance,
  where: string,
  onChange: () => void,
): HTMLElement {
  const def = ITEMS[inst.itemId]!;
  const current = inst.refine;
  const maxed = current >= (def.maxRefine ?? 10);
  const kind: 'weapon' | 'armor' = def.type === 'weapon' ? 'weapon' : 'armor';
  const wl = def.weaponLevel ?? 1;
  const rate = refineSuccessRate(current, kind, wl);
  const zeny = refineZenyCost(current, kind, wl);
  const material = refineMaterial(kind, wl);
  const matOwned = player.inventory.find((e) => e.itemId === 'Item_' + material)?.count ?? 0;
  const canAfford = player.zeny >= zeny && matOwned > 0 && !maxed;
  const atRisk = current >= 4;

  return el('div', { class: 'refine-row' }, [
    el('div', { class: 'refine-name' }, [
      makeIcon(inst.itemId),
      el('span', { class: 'refine-plus', text: current > 0 ? `+${current}` : '—' }),
      el('span', { class: 'refine-item', text: def.name }),
      el('span', { class: 'refine-where', text: where }),
    ]),
    el('div', { class: 'refine-stats' }, [
      el('span', { class: 'refine-rate', text: `${(rate * 100).toFixed(0)}% success` }),
      el('span', { class: 'refine-cost', text: `${fmtNum(zeny)}z + 1 ${material}` }),
      el('span', { class: 'refine-mat-owned', text: `(have ${matOwned})` }),
      atRisk ? el('span', { class: 'refine-risk', text: '⚠ breaks on fail' }) : el('span', {}),
    ]),
    button(
      maxed ? 'MAX' : 'Refine',
      () => {
        const roll = nextFloat(globalRng());
        const res = attemptRefine(player, { itemUid: inst.uid, roll });
        if (res.broke) {
          toast(`💥 ${def.name} broke during refinement!`, 'danger');
        } else if (res.ok) {
          toast(`✨ Refined to +${res.newRefine}!`, 'success');
        } else {
          toast(`Failed: ${res.reason ?? 'unknown'}`, 'warning');
        }
        onChange();
      },
      { class: 'ui-btn ui-btn-tiny', disabled: !canAfford },
    ),
  ]);
}

// Lazy RNG for the UI — kept loose; refinement outcomes are not part of the
// deterministic battle sim. (Could be promoted to a seeded stream later.)
let _rngState: { lo: number; hi: number } | null = null;
function globalRng(): { lo: number; hi: number } {
  if (_rngState === null) {
    _rngState = { lo: (Date.now() & 0xffffffff) >>> 0, hi: ((Date.now() * 2654435761) & 0xffffffff) >>> 0 };
  }
  // xorshift step
  const s = _rngState;
  let x = s.lo ^ (s.lo << 13);
  x = x ^ (x >>> 7);
  x = x ^ (x << 17);
  s.lo = s.hi;
  s.hi = (s.lo ^ s.hi ^ x) >>> 0;
  return s;
}

/** Build a small icon element for an item — real PNG if available, else nothing. */
function makeIcon(itemId: string): HTMLElement {
  const src = getItemIconSrc(itemId as any);
  if (src) {
    const img = el('img', { class: 'inv-icon' }) as HTMLImageElement;
    img.src = src;
    img.alt = '';
    return img;
  }
  return el('span', { class: 'inv-icon' });
}

function toast(msg: string, kind: 'success' | 'warning' | 'danger' = 'warning'): void {
  const t = el('div', { class: `toast toast-${kind}`, text: msg });
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}
