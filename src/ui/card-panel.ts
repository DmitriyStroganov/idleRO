/**
 * Card socketing panel.
 *
 * Lists equipment that has empty card slots. Each row shows the slots as
 * small squares; clicking an empty slot opens a card picker (a dropdown of
 * compatible cards from the inventory). Clicking a filled slot removes it.
 */

import type { Ui } from './state';
import { el, clear, button } from './dom';
import { socketCard, removeCard } from '@engine/character-ops';
import { ITEMS, CARDS } from '@data/items';
import type { ArmorSlot, CardId, Character, EquipmentInstance } from '@engine/types';

export function renderCardSocket(root: HTMLElement, ui: Ui): void {
  clear(root);
  const { player } = ui.state;

  const panel = el('div', { class: 'panel card-panel' }, []);
  panel.appendChild(el('h2', { text: '🃏  Card Socketing' }));
  panel.appendChild(el('p', {
    class: 'subtitle',
    text: 'Click an empty slot to insert a card. Click a filled slot to remove it.',
  }));

  const candidates: { instance: EquipmentInstance; where: string }[] = [];
  for (const slot of Object.keys(player.equipment) as ArmorSlot[]) {
    const inst = player.equipment[slot];
    if (inst && (ITEMS[inst.itemId]?.slots ?? 0) > 0) {
      candidates.push({ instance: inst, where: `Equipped (${slot})` });
    }
  }
  for (const entry of player.inventory) {
    if (entry.instance && (ITEMS[entry.itemId]?.slots ?? 0) > 0) {
      candidates.push({ instance: entry.instance, where: 'Inventory' });
    }
  }

  if (candidates.length === 0) {
    panel.appendChild(el('div', {
      class: 'info-box info-warning',
      text: 'No slotted equipment. Hunt for items with [N] suffix in the name.',
    }));
  }

  for (const cand of candidates) {
    panel.appendChild(cardRow(player, cand.instance, cand.where, () => ui.refresh()));
  }

  panel.appendChild(el('div', { class: 'actions' }, [
    button('← Back', () => ui.back()),
  ]));

  root.appendChild(panel);
}

function cardRow(
  player: Character,
  inst: EquipmentInstance,
  where: string,
  onChange: () => void,
): HTMLElement {
  const def = ITEMS[inst.itemId]!;
  const slots = def.slots;
  const slotPips = el('div', { class: 'card-slot-pips' }, []);
  for (let i = 0; i < slots; i++) {
    const filled = !!inst.cards[i];
    const pip = el('button', {
      class: 'card-slot-pip' + (filled ? ' pip-filled' : ''),
      onclick: filled
        ? () => {
            const res = removeCard(player, inst.uid, i);
            if (res.ok) toast('Card removed', 'success');
            else toast(res.reason ?? 'Cannot remove', 'warning');
            onChange();
          }
        : () => openCardPicker(player, inst.uid, onChange),
    }, [
      el('span', { text: filled ? cardName(inst.cards[i]!) : '+' }),
    ]);
    slotPips.appendChild(pip);
  }
  return el('div', { class: 'card-equip-row' }, [
    el('div', { class: 'card-equip-name', text: `${def.name}  (${where})` }),
    slotPips,
  ]);
}

function openCardPicker(player: Character, itemUid: string, onChange: () => void): void {
  const cards = player.inventory
    .filter((e) => {
      const def = CARDS[e.itemId as CardId];
      return def !== undefined && e.count > 0;
    })
    .map((e) => CARDS[e.itemId as CardId]!);

  if (cards.length === 0) {
    toast('No cards in inventory', 'warning');
    return;
  }

  const overlay = el('div', { class: 'card-picker-overlay' }, []);
  const list = el('div', { class: 'card-picker' }, [
    el('h3', { text: 'Pick a card' }),
  ]);
  for (const card of cards) {
    list.appendChild(el('button', {
      class: 'card-picker-item',
      onclick: () => {
        const res = socketCard(player, itemUid, card.id);
        if (res.ok) toast(`${card.name} socketed`, 'success');
        else toast(res.reason ?? 'Failed', 'warning');
        overlay.remove();
        onChange();
      },
    }, [
      el('div', { class: 'cpi-name', text: card.name }),
      el('div', { class: 'cpi-desc', text: describeBonus(card) }),
    ]));
  }
  list.appendChild(button('Cancel', () => overlay.remove()));
  overlay.appendChild(list);
  overlay.addEventListener('click', (ev) => {
    if (ev.target === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
}

function cardName(cardId: CardId): string {
  return CARDS[cardId]?.name.split(' Card')[0] ?? cardId;
}

function describeBonus(card: { bonuses: { kind: string; target?: string; stat?: string; value: number }[] }): string {
  return card.bonuses.map((b) => {
    const sign = b.value > 0 ? '+' : '';
    const tgt = b.target ? ` vs ${b.target}` : '';
    const stat = b.stat ? ` ${b.stat}` : '';
    const unit = b.kind.includes('Percent') || b.kind.includes('hpPercent') || b.kind.includes('spPercent')
      ? '%' : '';
    return `${sign}${b.value}${unit}${tgt}${stat}`;
  }).join(', ');
}

function toast(msg: string, kind: 'success' | 'warning' | 'danger' = 'warning'): void {
  const t = el('div', { class: `toast toast-${kind}`, text: msg });
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 1800);
}
