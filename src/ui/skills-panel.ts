/**
 * Skills panel.
 *
 * Lists every skill available to the player's current job (and parent jobs).
 * Each skill has a level pips row with a "+" button to invest a skill point.
 * Prerequisites are surfaced inline; unlearned prerequisites disable the "+".
 */

import type { Ui } from './state';
import { el, clear, button } from './dom';
import { learnSkill } from '@engine/character-ops';
import { SKILLS } from '@data/skills';
import { JOBS } from '@data/jobs';
import type { JobId, SkillDef, SkillId } from '@engine/types';

export function renderSkills(root: HTMLElement, ui: Ui): void {
  clear(root);
  const { player } = ui.state;

  const panel = el('div', { class: 'panel skills-panel' }, []);
  panel.appendChild(el('h2', { text: '📖  Skills' }));
  panel.appendChild(el('p', {
    class: 'subtitle',
    text: `${player.jobId}  ·  ${player.skillPoints} skill points available`,
  }));

  // Collect skills from the player's current job AND ancestors (Novice skills
  // remain learnable after class change).
  const relevantJobs = relevantJobChain(player.jobId);
  const skills: SkillDef[] = [];
  for (const job of relevantJobs) {
    for (const skillId of JOBS[job].skills) {
      const def = SKILLS[skillId];
      if (def) skills.push(def);
    }
  }

  const list = el('div', { class: 'skills-list' }, []);
  for (const skill of skills) {
    list.appendChild(skillRow(player, skill, () => {
      const res = learnSkill(player, skill.id);
      if (!res.ok) flash(res.reason);
      ui.refresh();
    }));
  }
  panel.appendChild(list);

  panel.appendChild(el('div', { class: 'actions' }, [
    button('← Back', () => ui.back()),
  ]));

  root.appendChild(panel);
}

function relevantJobChain(jobId: JobId): JobId[] {
  // Walk up the tree until root.
  const chain: JobId[] = [];
  let cur: JobId | undefined = jobId;
  while (cur) {
    chain.unshift(cur);
    cur = JOBS[cur].parent;
  }
  return chain;
}

function skillRow(player: Ui['state']['player'], skill: SkillDef, onPlus: () => void): HTMLElement {
  const current = player.skills[skill.id] ?? 0;
  const maxed = current >= skill.maxLevel;
  const prereqMet = !skill.prerequisites || Object.entries(skill.prerequisites).every(
    ([reqId, reqLvl]) => (player.skills[reqId as SkillId] ?? 0) >= (reqLvl as number),
  );
  const canPlus = !maxed && prereqMet && player.skillPoints > 0;

  // Pip row showing current level as filled dots.
  const pips = el('div', { class: 'pips' }, []);
  for (let i = 0; i < skill.maxLevel; i++) {
    pips.appendChild(el('span', {
      class: 'pip' + (i < current ? ' pip-filled' : ''),
    }));
  }

  const row = el('div', { class: 'skill-row' + (current > 0 ? ' skill-known' : '') }, [
    el('div', { class: 'skill-name', text: skill.name }),
    el('div', { class: 'skill-meta' }, [
      el('span', { class: 'skill-job', text: skill.job }),
      el('span', { class: 'skill-target', text: skill.targetType }),
      skill.damageMultiplier ? el('span', {
        class: 'skill-dmg',
        text: current > 0 ? `×${skill.damageMultiplier[current - 1]?.toFixed(1)}` : `×${skill.damageMultiplier[0]?.toFixed(1)}`,
      }) : el('span', {}),
    ]),
    pips,
    el('div', { class: 'skill-prereq' }, prereqTags(player, skill)),
    button('+', onPlus, { class: 'ui-btn ui-btn-plus', disabled: !canPlus }),
  ]);
  if (maxed) row.classList.add('skill-maxed');
  return row;
}

function prereqTags(player: Ui['state']['player'], skill: SkillDef): HTMLElement[] {
  if (!skill.prerequisites) return [];
  return Object.entries(skill.prerequisites).map(([reqId, reqLvl]) => {
    const have = player.skills[reqId as SkillId] ?? 0;
    const ok = have >= (reqLvl as number);
    const def = SKILLS[reqId as SkillId];
    return el('span', {
      class: 'prereq-tag' + (ok ? ' prereq-ok' : ' prereq-missing'),
      text: `${def?.name ?? reqId} ${have}/${reqLvl}`,
    });
  });
}

function flash(msg: string): void {
  const toast = el('div', { class: 'toast', text: msg });
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 1500);
}
