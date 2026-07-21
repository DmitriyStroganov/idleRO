/**
 * Stats allocation panel.
 *
 * Shows the six primary stats with + buttons. Cost is 2 + floor(N/10) per
 * point. VIT/INT top up HP/SP immediately on allocation.
 *
 * Layout: a centered panel with six rows, an effective-stat readout,
 * and a derived-stats sidebar (HP/SP/HIT/FLEE/CRIT/ATK/ASPD).
 */

import type { Ui } from './state';
import { el, clear, button, fmtNum } from './dom';
import { allocateStat } from '@engine/character-ops';
import { effectiveStats, hit, flee, crit, statusAttack, magicAttack } from '@engine/formulas/stats';
import { aspd, amotionMs } from '@engine/formulas/aspd';
import { statPointCost } from '@engine/formulas/stats';
import { ITEMS } from '@data/items';
import type { StatKey } from '@engine/types';
import { STAT_KEYS } from '@engine/types';

const STAT_LABEL: Record<StatKey, string> = {
  STR: 'Strength', AGI: 'Agility', VIT: 'Vitality',
  INT: 'Intelligence', DEX: 'Dexterity', LUK: 'Luck',
};

const STAT_DESC: Record<StatKey, string> = {
  STR: 'Increases melee ATK and weight limit.',
  AGI: 'Increases FLEE and ASPD.',
  VIT: 'Increases MaxHP, HP regen, and stun resist.',
  INT: 'Increases MaxSP, MATK, and MDEF.',
  DEX: 'Increases HIT, cast speed, and minimum ATK.',
  LUK: 'Increases CRIT and perfect dodge.',
};

export function renderStats(root: HTMLElement, ui: Ui): void {
  clear(root);
  const { player } = ui.state;

  const panel = el('div', { class: 'panel stats-panel' }, []);
  panel.appendChild(el('h2', { text: '📊  Stats' }));
  panel.appendChild(el('p', {
    class: 'subtitle',
    text: `Available stat points: ${player.statPoints}`,
  }));

  const body = el('div', { class: 'stats-body' }, []);

  // Left: stat rows
  const left = el('div', { class: 'stats-rows' }, []);
  for (const key of STAT_KEYS) {
    left.appendChild(statRow(player, key, () => {
      const res = allocateStat(player, key);
      if (!res.ok) flash(ui, res.reason);
      ui.refresh();
    }));
  }
  body.appendChild(left);

  // Right: derived readout
  const eff = effectiveStats(player.stats);
  const weaponDef = player.equipment['Weapon'] ? ITEMS[player.equipment['Weapon']!.itemId] : undefined;
  const wt = weaponDef?.weaponType ?? 'Fist';
  const aspdVal = aspd(eff.AGI, eff.DEX, wt);
  const matk = magicAttack(eff.INT);

  const right = el('div', { class: 'stats-derived' }, [
    el('div', { class: 'derived-row', text: `Max HP:  ${fmtNum(player.maxHp)}` }),
    el('div', { class: 'derived-row', text: `Max SP:  ${fmtNum(player.maxSp)}` }),
    el('div', { class: 'derived-row', text: `HIT:     ${hit(player.baseLevel, eff.DEX)}` }),
    el('div', { class: 'derived-row', text: `FLEE:    ${flee(player.baseLevel, eff.AGI)}` }),
    el('div', { class: 'derived-row', text: `CRIT:    ${crit(eff.LUK).toFixed(1)}%` }),
    el('div', { class: 'derived-row', text: `ATK:     ${statusAttack(eff.STR, eff.DEX, eff.LUK)} + weapon` }),
    el('div', { class: 'derived-row', text: `MATK:    ${matk.min}..${matk.max}` }),
    el('div', { class: 'derived-row', text: `ASPD:    ${aspdVal}  (${amotionMs(aspdVal)} ms)` }),
  ]);
  body.appendChild(right);

  panel.appendChild(body);
  panel.appendChild(el('div', { class: 'actions' }, [
    button('← Back', () => ui.back()),
  ]));

  root.appendChild(panel);
}

function statRow(player: Ui['state']['player'], key: StatKey, onPlus: () => void): HTMLElement {
  const base = player.stats.base[key];
  const equip = player.stats.equip[key];
  const buff = player.stats.buff[key];
  const total = base + equip + buff;
  const cost = statPointCost(base);
  const canPlus = player.statPoints >= cost && base < 99;
  return el('div', { class: 'stat-row' }, [
    el('div', { class: 'stat-label' }, [
      el('strong', { text: key }),
      el('span', { class: 'stat-full-name', text: STAT_LABEL[key] }),
    ]),
    el('div', { class: 'stat-desc', text: STAT_DESC[key] }),
    el('div', { class: 'stat-values' }, [
      el('span', { class: 'stat-base', text: `${base}` }),
      equip > 0 ? el('span', { class: 'stat-equip', text: `+${equip}` }) : el('span', {}),
      buff > 0 ? el('span', { class: 'stat-buff', text: `+${buff}` }) : el('span', {}),
      el('span', { class: 'stat-total', text: `= ${total}` }),
    ]),
    button(`+ (${cost})`, onPlus, { class: 'ui-btn ui-btn-plus', disabled: !canPlus }),
  ]);
}

function flash(ui: Ui, msg: string): void {
  const toast = el('div', { class: 'toast', text: msg });
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 1500);
  void ui;
}
