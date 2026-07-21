/**
 * Class Change NPC panel.
 *
 * Shows the next class in the player's branch (Novice → Archer → Hunter →
 * Sniper) and lets the player confirm advancement if they meet the job
 * level requirement. Classic RO also resets job level on class change.
 */

import type { Ui } from './state';
import { el, clear, button } from './dom';
import { canChangeJob, changeJob } from '@engine/character-ops';
import { JOBS, JOB_CHANGE_REQUIREMENTS } from '@data/jobs';
import type { JobId } from '@engine/types';

export function renderClassChange(root: HTMLElement, ui: Ui): void {
  clear(root);
  const { player } = ui.state;

  const panel = el('div', { class: 'panel classchange-panel' }, []);
  panel.appendChild(el('h2', { text: '🎓  Class Master' }));

  const current = JOBS[player.jobId];
  const req = JOB_CHANGE_REQUIREMENTS[player.jobId];
  const target: JobId | undefined = req?.to;
  const targetDef = target ? JOBS[target] : undefined;
  const eligibility = canChangeJob(player);

  panel.appendChild(el('p', {
    class: 'subtitle',
    text: `Current class: ${current.name}  ·  Job Lv ${player.jobLevel}`,
  }));

  if (!target || !targetDef) {
    panel.appendChild(el('div', {
      class: 'info-box info-warning',
      text: 'You have reached the top of your class branch. (Future classes not implemented yet.)',
    }));
  } else {
    panel.appendChild(el('div', { class: 'class-target' }, [
      el('div', { class: 'class-arrow', text: `${current.name}  →  ${targetDef.name}` }),
      el('div', {
        class: 'class-req',
        text: `Requires Job Lv ${req!.jobLevel}.  You are Job Lv ${player.jobLevel}.`,
      }),
    ]));

    if (eligibility.ok) {
      panel.appendChild(el('div', {
        class: 'info-box info-success',
        text: '✓ You meet the requirement. Class change will reset your Job Level to 1 and grant 40 skill points.',
      }));
      panel.appendChild(el('div', { class: 'actions' }, [
        button(`Advance to ${targetDef.name}`, () => {
          const res = changeJob(player, target);
          if (!res.ok) flash(res.reason);
          else flash(`You are now a ${targetDef.name}!`);
          ui.refresh();
        }, { class: 'ui-btn ui-btn-primary' }),
      ]));
    } else {
      panel.appendChild(el('div', {
        class: 'info-box info-warning',
        text: `✗ ${eligibility.reason ?? 'Cannot advance yet.'}`,
      }));
    }
  }

  panel.appendChild(el('div', { class: 'actions' }, [
    button('← Back', () => ui.back()),
  ]));

  root.appendChild(panel);
}

function flash(msg: string): void {
  const toast = el('div', { class: 'toast', text: msg });
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2000);
}
