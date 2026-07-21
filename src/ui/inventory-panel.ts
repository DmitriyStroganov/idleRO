/**
 * Inventory panel + equipment paper-doll.
 *
 * Layout:
 *   ┌──────────────────────┬───────────────────┐
 *   │  Paper-doll          │  Inventory list    │
 *   │  (equipped slots)    │  (click to equip)  │
 *   └──────────────────────┴───────────────────┘
 *
 * Equipment slots follow RO: HeadTop, HeadMid, HeadLow, Armor, Weapon,
 * Shield, Garment, Shoes, Accessory1, Accessory2.
 */

import type { Ui } from './state';
import { el, clear, button, fmtNum } from './dom';
import { equipItem, unequipItem } from '@engine/character-ops';
import { ITEMS } from '@data/items';
import type { ArmorSlot, Character } from '@engine/types';

const EQUIP_SLOTS: { slot: ArmorSlot; label: string }[] = [
  { slot: 'HeadTop', label: 'Head (top)' },
  { slot: 'HeadMid', label: 'Head (mid)' },
  { slot: 'HeadLow', label: 'Head (low)' },
  { slot: 'Armor', label: 'Armor' },
  { slot: 'Weapon', label: 'Weapon' },
  { slot: 'Shield', label: 'Shield' },
  { slot: 'Garment', label: 'Garment' },
  { slot: 'Shoes', label: 'Shoes' },
  { slot: 'Accessory1', label: 'Accessory 1' },
  { slot: 'Accessory2', label: 'Accessory 2' },
];

export function renderInventory(root: HTMLElement, ui: Ui): void {
  clear(root);
  const { player } = ui.state;

  const panel = el('div', { class: 'panel inventory-panel' }, []);
  panel.appendChild(el('h2', { text: '🎒  Inventory & Equipment' }));
  panel.appendChild(el('p', {
    class: 'subtitle',
    text: `Zeny: ${fmtNum(player.zeny)}  ·  Items carried: ${player.inventory.length}`,
  }));

  const body = el('div', { class: 'inv-body' }, []);

  // Left: paper-doll
  const doll = el('div', { class: 'paper-doll' }, []);
  for (const { slot, label } of EQUIP_SLOTS) {
    doll.appendChild(dollRow(player, slot, label, () => ui.refresh()));
  }
  body.appendChild(doll);

  // Right: inventory list
  const list = el('div', { class: 'inv-list' }, []);
  if (player.inventory.length === 0) {
    list.appendChild(el('div', { class: 'inv-empty', text: 'Inventory is empty. Kill monsters to get loot.' }));
  }
  for (const entry of player.inventory) {
    list.appendChild(invRow(player, entry, () => ui.refresh()));
  }
  body.appendChild(list);

  panel.appendChild(body);
  panel.appendChild(el('div', { class: 'actions' }, [
    button('← Back', () => ui.back()),
  ]));

  root.appendChild(panel);
}

function dollRow(player: Character, slot: ArmorSlot, label: string, onChange: () => void): HTMLElement {
  const inst = player.equipment[slot];
  const def = inst ? ITEMS[inst.itemId] : undefined;
  const cardSummary = inst && inst.cards.filter(Boolean).length > 0
    ? ` [${inst.cards.filter(Boolean).map((c) => c).join(',')}]`
    : '';
  return el('div', { class: 'doll-row' }, [
    el('div', { class: 'doll-label', text: label }),
    el('div', { class: 'doll-value' }, [
      el('span', {
        class: 'doll-name' + (inst ? '' : ' doll-empty'),
        text: def ? `${def.name}${def.refineable && inst!.refine > 0 ? ` +${inst!.refine}` : ''}${cardSummary}` : '— empty —',
      }),
      def ? el('button', {
        class: 'ui-btn ui-btn-tiny',
        text: 'unequip',
        onclick: () => {
          unequipItem(player, slot);
          onChange();
        },
      }) : el('span', {}),
    ]),
  ]);
}

function invRow(player: Character, entry: Character['inventory'][number], onChange: () => void): HTMLElement {
  const def = ITEMS[entry.itemId];
  if (!def) {
    return el('div', { class: 'inv-row', text: entry.itemId });
  }
  const isEquip = def.type === 'weapon' || def.type === 'armor';
  const refineTag = entry.instance && entry.instance.refine > 0 ? ` +${entry.instance.refine}` : '';
  const slotsTag = def.slots > 0 ? ` [${def.slots}]` : '';
  const countTag = entry.count > 1 ? ` ×${entry.count}` : '';

  return el('div', { class: 'inv-row' }, [
    el('div', { class: 'inv-name' }, [
      el('span', { class: `inv-icon inv-type-${def.type}`, text: iconForType(def.type) }),
      el('span', {
        class: 'inv-label',
        text: `${def.name}${refineTag}${slotsTag}${countTag}`,
      }),
    ]),
    el('div', { class: 'inv-stats' }, [
      def.type === 'weapon' && def.attack != null
        ? el('span', { class: 'inv-stat', text: `ATK ${def.attack}` })
        : el('span', {}),
      def.type === 'armor' && def.defense != null
        ? el('span', { class: 'inv-stat', text: `DEF ${def.defense}` })
        : el('span', {}),
    ]),
    isEquip && entry.instance
      ? button('equip', () => {
          const res = equipItem(player, entry.uid);
          if (!res.ok) flash(res.reason);
          onChange();
        }, { class: 'ui-btn ui-btn-tiny' })
      : el('span', {}),
  ]);
}

function iconForType(t: string): string {
  switch (t) {
    case 'weapon': return '⚔';
    case 'armor': return '🛡';
    case 'ammunition': return '🏹';
    case 'consumable': return '🧪';
    case 'etc': return '✦';
    case 'card': return '🃏';
    default: return '•';
  }
}

function flash(msg: string): void {
  const toast = el('div', { class: 'toast', text: msg });
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 1500);
}
