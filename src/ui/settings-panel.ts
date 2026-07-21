/**
 * Settings / Save-Load panel.
 *
 * Lists save slots and provides:
 *   - Save / Load / Delete for each slot
 *   - Auto-save toggle + interval
 *   - Hard reset (wipes all saves + starts fresh)
 *
 * The actual save/load calls happen via callbacks the caller wires up in
 * main.ts (since they need to mutate the live Character/World).
 */

import type { Ui } from './state';
import { el, clear, button, fmtNum } from './dom';
import { listSaves, deleteSave, loadSettings, type Settings } from '@persistence/save';

export interface SaveActions {
  saveToSlot: (slot: string) => void;
  loadFromSlot: (slot: string) => void;
  updateSettings: (s: Settings) => void;
  resetGame: () => void;
}

export function renderSettings(root: HTMLElement, _ui: Ui, actions: SaveActions, settings: Settings): void {
  clear(root);
  const panel = el('div', { class: 'panel settings-panel' }, []);
  panel.appendChild(el('h2', { text: '⚙  Settings & Saves' }));

  // === Saves ===
  panel.appendChild(el('h3', { text: 'Save Slots' }));
  const saves = listSaves();
  const slotsRoot = el('div', { class: 'save-slots' }, []);
  // Show 3 slots — fixed grid.
  for (let i = 1; i <= 3; i++) {
    const slotId = `slot${i}`;
    const save = saves.find((s) => s.slot === slotId);
    slotsRoot.appendChild(slotRow(slotId, save, actions));
  }
  panel.appendChild(slotsRoot);

  // === Auto-save ===
  panel.appendChild(el('h3', { text: 'Auto-save' }));
  const autoRow = el('label', { class: 'settings-row' }, [
    el('input', {
      class: 'settings-checkbox',
      // checkboxes need a property, not attribute — set right after creation
    }),
    el('span', { text: 'Auto-save every 30 seconds' }),
  ] as unknown as HTMLElement[]);
  const cb = autoRow.querySelector('input')!;
  cb.type = 'checkbox';
  cb.checked = settings.autoSave;
  cb.addEventListener('change', () => {
    const next: Settings = { ...settings, autoSave: cb.checked };
    actions.updateSettings(next);
  });
  panel.appendChild(autoRow);

  // === Danger zone ===
  panel.appendChild(el('h3', { text: 'Danger Zone', class: 'danger-h' }));
  panel.appendChild(el('div', { class: 'danger-zone' }, [
    button('🗑 Reset game (wipe all saves)', () => {
      if (confirm('Delete ALL save data and restart?')) {
        actions.resetGame();
      }
    }, { class: 'ui-btn danger-btn' }),
  ]));

  panel.appendChild(el('div', { class: 'actions' }, [
    button('← Back', () => {
      // rerender with fresh state
      _ui.refresh();
      _ui.back();
    }),
  ]));

  root.appendChild(panel);
}

function slotRow(slotId: string, save: ReturnType<typeof listSaves>[number] | undefined, actions: SaveActions): HTMLElement {
  const info = save
    ? `${save.name}  ·  Base ${save.baseLevel}  ·  ${new Date(save.savedAt).toLocaleString()}`
    : '(empty)';
  return el('div', { class: 'save-slot-row' }, [
    el('div', { class: 'save-slot-info' }, [
      el('div', { class: 'save-slot-id', text: `Slot ${slotId.slice(-1)}` }),
      el('div', { class: 'save-slot-detail', text: info }),
    ]),
    el('div', { class: 'save-slot-actions' }, [
      button('Save', () => actions.saveToSlot(slotId), { class: 'ui-btn ui-btn-tiny ui-btn-primary' }),
      button('Load', () => actions.loadFromSlot(slotId), { class: 'ui-btn ui-btn-tiny', disabled: !save }),
      save
        ? button('Delete', () => {
            if (confirm(`Delete ${save.name}?`)) {
              deleteSave(slotId);
            }
          }, { class: 'ui-btn ui-btn-tiny danger-btn' })
        : el('span', {}),
    ]),
  ]);
}

// Avoid "fmtNum unused" lint when the file grows.
void fmtNum;
void loadSettings;
