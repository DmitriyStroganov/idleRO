/**
 * Town hub screen.
 *
 * A grid of NPC buttons that lead to other panels:
 *   - Stats (allocate STR/AGI/VIT/INT/DEX/LUK)
 *   - Skills (skill tree)
 *   - Inventory (items + equipment paper-doll)
 *   - Class Change (advance to next job)
 *   - Return to Battle
 *
 * Drawn as an HTML overlay. The renderer keeps drawing the world behind.
 */

import type { Ui } from './state';
import { el, clear, button } from './dom';
import { canChangeJob } from '@engine/character-ops';
import type { WsClient } from '../net/ws-client';

export function renderTown(root: HTMLElement, ui: Ui, ws: WsClient): void {
  clear(root);
  const { player } = ui.state;

  const overlay = el('div', { class: 'panel town' }, []);
  overlay.appendChild(el('h2', { text: '🛖  Town' }));
  overlay.appendChild(el('p', {
    class: 'subtitle',
    text: `${player.jobId}  ·  Base Lv ${player.baseLevel}  ·  Job Lv ${player.jobLevel}  ·  ${player.statPoints} SP  ·  ${player.skillPoints} skill pts`,
  }));

  const grid = el('div', { class: 'npc-grid' }, []);

  // Stats NPC
  grid.appendChild(npcCard('📊', 'Stats Trainer',
    `Allocate your stat points (${player.statPoints} available).`,
    () => ui.go('stats'),
  ));

  // Skills NPC
  grid.appendChild(npcCard('📖', 'Skills Master',
    `Spend ${player.skillPoints} skill points.`,
    () => ui.go('skills'),
  ));

  // Inventory NPC (Kafra-style storage)
  grid.appendChild(npcCard('🎒', 'Inventory',
    `${player.inventory.length} items carried.`,
    () => ui.go('inventory'),
  ));

  // Class Change NPC
  const jobChange = canChangeJob(player);
  const jobLabel = jobChange.ok
    ? `Eligible: ${player.jobId} → ${jobChange.to}`
    : (jobChange.reason ?? 'No advancement available');
  grid.appendChild(npcCard('🎓', 'Class Master',
    jobLabel,
    () => ui.go('classchange'),
    !jobChange.ok,
  ));

  // Refine NPC
  grid.appendChild(npcCard('⚒', 'Blacksmith',
    'Upgrade weapons and armor.',
    () => ui.go('refine'),
  ));

  // Card socketing NPC
  grid.appendChild(npcCard('🃏', 'Card Master',
    'Socket cards into equipment.',
    () => ui.go('cards'),
  ));

  // Behaviour editor (AI Level 2)
  const behaviorKind = player.behavior?.kind === 'priorityList' ? 'Custom rules' : 'Preset';
  grid.appendChild(npcCard('🧠', 'Behaviour Editor',
    `Current: ${behaviorKind}. Edit rules, conditions, actions.`,
    () => ui.go('ai'),
  ));

  // Settings / Saves
  grid.appendChild(npcCard('⚙', 'Settings',
    'Save / load / reset.',
    () => ui.go('settings'),
  ));

  // Go Offline — disconnect with offline-progression enabled
  grid.appendChild(npcCard('🛌', 'Go Offline',
    'Continue gaining EXP at your recent rate while away (up to 8h).',
    () => {
      if (confirm(
        'Go offline?\n\n' +
        'Your character will keep gaining EXP at your recent online rate ' +
        'while you are away (capped at 8 hours).\n\n' +
        'You won\'t be able to play until you log back in.'
      )) {
        ws.sendCommand({ kind: 'go_offline' });
      }
    },
  ));

  overlay.appendChild(grid);

  overlay.appendChild(el('div', { class: 'actions' }, [
    button('↩ Return to Battle', () => ui.go('battle'), { class: 'ui-btn ui-btn-primary' }),
  ]));

  root.appendChild(overlay);
}

function npcCard(
  icon: string,
  name: string,
  desc: string,
  onClick: () => void,
  disabled = false,
): HTMLElement {
  const card = el('button', {
    class: 'npc-card' + (disabled ? ' npc-card-disabled' : ''),
    onclick: disabled ? undefined : onClick,
  }, [
    el('div', { class: 'npc-icon', text: icon }),
    el('div', { class: 'npc-name', text: name }),
    el('div', { class: 'npc-desc', text: desc }),
  ]);
  (card as HTMLButtonElement).disabled = disabled;
  return card;
}
