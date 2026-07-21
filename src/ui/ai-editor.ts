/**
 * AI Editor panel (Level 2 — priority-list).
 *
 * Lists rules in priority order. Each rule has:
 *   - enable/disable checkbox
 *   - description (auto-derived from condition + action)
 *   - "↑"/"↓" reorder buttons
 *   - "delete" button
 *
 * The editor exposes a small set of condition templates the user can add:
 *   - Heal if HP < X%
 *   - Cast Skill X
 *   - Use Skill X on clusters ≥ N
 *   - Attack / Retreat / Move forward
 *
 * Advanced users can build arbitrarily nested `and` / `or` / `not` directly
 * in JSON via a textarea (saved to localStorage) — Stage 7+ stretch goal.
 *
 * Saving: the current list is stored in the player's SaveData under
 * `behavior.priorityList`.
 */

import type { Ui } from './state';
import { el, clear, button } from './dom';
import type {
  ActionSpec,
  ConditionExpr,
  PriorityListConfig,
  Rule,
} from '@ai/priority-list';
import { BUILTIN_LISTS, DEFAULT_LIST_ID } from '@ai/builtin-lists';

let currentConfig: PriorityListConfig = cloneBuiltin(DEFAULT_LIST_ID);
let dirty = false;

export interface AiEditorActions {
  /** Apply the current list to the running AI for this character. */
  apply: (config: PriorityListConfig) => void;
  /** Persist the list into the save. */
  save: (config: PriorityListConfig) => void;
}

export function setInitialConfig(cfg: PriorityListConfig | undefined): void {
  currentConfig = cfg ? clone(cfg) : cloneBuiltin(DEFAULT_LIST_ID);
  dirty = false;
}

export function getCurrentConfig(): PriorityListConfig {
  return currentConfig;
}

export function renderAiEditor(root: HTMLElement, ui: Ui, actions: AiEditorActions): void {
  clear(root);
  const panel = el('div', { class: 'panel ai-editor' }, []);
  panel.appendChild(el('h2', { text: '🧠  Behaviour Editor (priority list)' }));
  panel.appendChild(el('p', {
    class: 'subtitle',
    text: 'Rules are evaluated top-to-bottom; the first match wins.',
  }));

  // Template bar — pick a built-in to start from.
  const tplBar = el('div', { class: 'tpl-bar' }, [
    el('span', { text: 'Templates:', class: 'tpl-label' }),
    ...Object.values(BUILTIN_LISTS).map((tpl) =>
      button(tpl.name, () => {
        if (confirm(`Replace current rules with "${tpl.name}"? Unsaved changes will be lost.`)) {
          currentConfig = clone(tpl);
          dirty = true;
          ui.refresh();
        }
      }, { class: 'ui-btn ui-btn-tiny' }),
    ),
  ]);
  panel.appendChild(tplBar);

  panel.appendChild(el('h3', { text: 'Rules' }));

  // Rule list
  const list = el('div', { class: 'rule-list' }, []);
  if (currentConfig.rules.length === 0) {
    list.appendChild(el('div', { class: 'inv-empty', text: 'No rules. Add one below.' }));
  }
  currentConfig.rules.forEach((rule, idx) => {
    list.appendChild(ruleRow(rule, idx, currentConfig.rules.length, {
      onToggle: () => {
        rule.enabled = !rule.enabled;
        dirty = true;
        ui.refresh();
      },
      onUp: () => {
        if (idx === 0) return;
        const arr = currentConfig.rules;
        [arr[idx - 1], arr[idx]] = [rule, arr[idx - 1]!];
        dirty = true;
        ui.refresh();
      },
      onDown: () => {
        if (idx === currentConfig.rules.length - 1) return;
        const arr = currentConfig.rules;
        [arr[idx + 1], arr[idx]] = [rule, arr[idx + 1]!];
        dirty = true;
        ui.refresh();
      },
      onDelete: () => {
        currentConfig.rules.splice(idx, 1);
        dirty = true;
        ui.refresh();
      },
    }));
  });
  panel.appendChild(list);

  // Add-rule dropdown
  panel.appendChild(addRuleBar(() => ui.refresh()));

  // Save / Apply actions
  panel.appendChild(el('div', { class: 'actions' }, [
    button('Apply (live)', () => {
      actions.apply(currentConfig);
      flash('Behaviour applied.');
    }, { class: 'ui-btn ui-btn-primary' }),
    button('Save', () => {
      actions.save(currentConfig);
      dirty = false;
      flash('Saved.');
    }),
    button('← Back', () => ui.back()),
  ]));

  root.appendChild(panel);
}

// ============================================================================
// Rule row
// ============================================================================

function ruleRow(
  rule: Rule,
  index: number,
  total: number,
  callbacks: {
    onToggle: () => void;
    onUp: () => void;
    onDown: () => void;
    onDelete: () => void;
  },
): HTMLElement {
  const toggle = el('input', { class: 'rule-toggle' }) as HTMLInputElement;
  toggle.type = 'checkbox';
  toggle.checked = rule.enabled;
  toggle.addEventListener('change', callbacks.onToggle);

  return el('div', { class: 'rule-row' + (rule.enabled ? '' : ' rule-disabled') }, [
    el('div', { class: 'rule-index', text: String(index + 1) }),
    toggle,
    el('div', { class: 'rule-body' }, [
      el('div', { class: 'rule-label', text: rule.label }),
      el('div', { class: 'rule-expr', text: `${describeCondition(rule.condition)} → ${describeAction(rule.action)}` }),
    ]),
    el('div', { class: 'rule-actions' }, [
      button('↑', callbacks.onUp, { class: 'ui-btn ui-btn-tiny', disabled: index === 0 }),
      button('↓', callbacks.onDown, { class: 'ui-btn ui-btn-tiny', disabled: index === total - 1 }),
      button('✕', callbacks.onDelete, { class: 'ui-btn ui-btn-tiny danger-btn' }),
    ]),
  ]);
}

// ============================================================================
// Add-rule bar
// ============================================================================

function addRuleBar(onChange: () => void): HTMLElement {
  const select = el('select', { class: 'rule-add-select' }, [
    el('option', { text: '— pick a rule to add —', value: '' }),
    el('option', { text: 'Heal if HP < 30%', value: 'heal-30' }),
    el('option', { text: 'Heal if HP < 50%', value: 'heal-50' }),
    el('option', { text: 'Cast Improve Concentration (buff)', value: 'buff-imp' }),
    el('option', { text: 'Cast True Sight (buff)', value: 'buff-true' }),
    el('option', { text: 'Cast Double Strafe', value: 'ds' }),
    el('option', { text: 'Cast Arrow Shower (on 3+ monsters)', value: 'as' }),
    el('option', { text: 'Retreat if HP < 20%', value: 'retreat' }),
    el('option', { text: 'Auto-attack', value: 'attack' }),
    el('option', { text: 'Move forward', value: 'forward' }),
  ]) as HTMLSelectElement;

  const wrap = el('div', { class: 'add-rule-bar' }, [
    select,
    button('+ Add rule', () => {
      const tpl = ruleTemplate(select.value);
      if (!tpl) return;
      currentConfig.rules.push(tpl);
      dirty = true;
      select.value = '';
      onChange();
    }),
  ]);
  return wrap;
}

function ruleTemplate(key: string): Rule | null {
  const id = `rule-${Date.now()}`;
  switch (key) {
    case 'heal-30':
      return { id, enabled: true, label: 'Heal at 30% HP',
        condition: { kind: 'hpFraction', op: '<', value: 0.30 },
        action: { kind: 'useItem', itemId: 'Item_Consum_RedPotion' } };
    case 'heal-50':
      return { id, enabled: true, label: 'Heal at 50% HP',
        condition: { kind: 'hpFraction', op: '<', value: 0.50 },
        action: { kind: 'useItem', itemId: 'Item_Consum_OrangePotion' } };
    case 'buff-imp':
      return { id, enabled: true, label: 'Buff: Improve Concentration',
        condition: { kind: 'and', conds: [
          { kind: 'skillLearned', skillId: 'Skill_Archer_ImproveConcentration' },
          { kind: 'statusMissing', id: 'Buff_ImproveConcentration' },
          { kind: 'skillReady', skillId: 'Skill_Archer_ImproveConcentration' },
        ] },
        action: { kind: 'castSkill', skillId: 'Skill_Archer_ImproveConcentration', target: 'self' } };
    case 'buff-true':
      return { id, enabled: true, label: 'Buff: True Sight',
        condition: { kind: 'and', conds: [
          { kind: 'skillLearned', skillId: 'Skill_Sniper_TrueSight' },
          { kind: 'statusMissing', id: 'Buff_TrueSight' },
          { kind: 'skillReady', skillId: 'Skill_Sniper_TrueSight' },
        ] },
        action: { kind: 'castSkill', skillId: 'Skill_Sniper_TrueSight', target: 'self' } };
    case 'ds':
      return { id, enabled: true, label: 'Double Strafe',
        condition: { kind: 'and', conds: [
          { kind: 'skillLearned', skillId: 'Skill_Archer_DoubleStrafe' },
          { kind: 'skillReady', skillId: 'Skill_Archer_DoubleStrafe' },
        ] },
        action: { kind: 'castSkill', skillId: 'Skill_Archer_DoubleStrafe', target: 'current' } };
    case 'as':
      return { id, enabled: true, label: 'Arrow Shower on 3+',
        condition: { kind: 'and', conds: [
          { kind: 'aggroCount', op: '>=', value: 3 },
          { kind: 'skillReady', skillId: 'Skill_Archer_ArrowShower' },
        ] },
        action: { kind: 'castSkill', skillId: 'Skill_Archer_ArrowShower', target: 'current' } };
    case 'retreat':
      return { id, enabled: true, label: 'Retreat at 20% HP',
        condition: { kind: 'hpFraction', op: '<', value: 0.20 },
        action: { kind: 'retreat' } };
    case 'attack':
      return { id, enabled: true, label: 'Auto-attack',
        condition: { kind: 'true' },
        action: { kind: 'attack' } };
    case 'forward':
      return { id, enabled: true, label: 'Move forward',
        condition: { kind: 'true' },
        action: { kind: 'moveForward' } };
    default:
      return null;
  }
}

// ============================================================================
// Human-readable description helpers (also used for debugging)
// ============================================================================

export function describeCondition(c: ConditionExpr): string {
  switch (c.kind) {
    case 'true': return 'always';
    case 'hpFraction': return `HP ${c.op} ${(c.value * 100).toFixed(0)}%`;
    case 'spFraction': return `SP ${c.op} ${(c.value * 100).toFixed(0)}%`;
    case 'hp':         return `HP ${c.op} ${c.value}`;
    case 'sp':         return `SP ${c.op} ${c.value}`;
    case 'statusActive':  return `buff "${c.id}" active`;
    case 'statusMissing': return `buff "${c.id}" missing`;
    case 'skillReady':    return `skill "${c.skillId}" ready`;
    case 'skillLearned':  return `skill "${c.skillId}" learned${c.minLevel ? ` ≥${c.minLevel}` : ''}`;
    case 'targetDistance': return `target distance ${c.op} ${c.value}`;
    case 'aggroCount':    return `monsters in range ${c.op} ${c.value}`;
    case 'targetRace':    return `target race ∈ {${c.races.join(',')}}`;
    case 'targetMob':     return `target ∈ {${c.mobIds.join(',')}}`;
    case 'targetHpFraction': return `target HP ${c.op} ${(c.value * 100).toFixed(0)}%`;
    case 'and': return `(${c.conds.map(describeCondition).join(' AND ')})`;
    case 'or':  return `(${c.conds.map(describeCondition).join(' OR ')})`;
    case 'not': return `NOT ${describeCondition(c.cond)}`;
    default: {
      const _e: never = c;
      void _e;
      return '???';
    }
  }
}

export function describeAction(a: ActionSpec): string {
  switch (a.kind) {
    case 'castSkill':  return `cast ${a.skillId}${a.target === 'self' ? ' (self)' : ''}`;
    case 'attack':     return 'auto-attack';
    case 'useItem':    return `use ${a.itemId}`;
    case 'retreat':    return 'retreat';
    case 'moveForward': return 'move forward';
    case 'idle':       return 'idle';
    default: {
      const _e: never = a;
      void _e;
      return '???';
    }
  }
}

// ============================================================================
// Helpers
// ============================================================================

function clone<T>(v: T): T {
  if (typeof structuredClone === 'function') return structuredClone(v);
  return JSON.parse(JSON.stringify(v));
}

function cloneBuiltin(id: string): PriorityListConfig {
  return clone(BUILTIN_LISTS[id] ?? BUILTIN_LISTS[DEFAULT_LIST_ID]!);
}

function flash(msg: string): void {
  const toast = el('div', { class: 'toast toast-success', text: msg });
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 1500);
}

// Track dirty state for the "unsaved changes" indicator.
export function isDirty(): boolean { return dirty; }
