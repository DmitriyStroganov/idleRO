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

export function renderTown(root: HTMLElement, ui: Ui): void {
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
