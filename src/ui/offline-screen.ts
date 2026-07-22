/**
 * Offline screen — shown when the player has explicitly gone offline
 * via the "Go Offline" Town NPC.
 *
 * Replaces the canvas + HUD with a single message: "You're offline.
 * Come back later to find your character stronger." Provides a button
 * to log back in (re-runs the auth+WS bootstrap).
 */

import { el, clear, button } from './dom';

export function showOfflineScreen(): void {
  const canvas = document.querySelector<HTMLCanvasElement>('#game');
  const hud = document.querySelector<HTMLElement>('#hud');
  if (canvas) canvas.style.display = 'none';
  if (hud) hud.style.display = 'none';

  const root = document.querySelector<HTMLElement>('#ui-layer') ?? createUiLayer();
  root.classList.add('active');
  clear(root);

  const panel = el('div', { class: 'panel offline-panel' }, []);
  panel.appendChild(el('div', { class: 'offline-moon', text: '🌙' }));
  panel.appendChild(el('h2', { text: 'You are offline' }));
  panel.appendChild(el('p', {
    class: 'subtitle',
    text: 'Time passes. Your character continues to gain EXP at the rate they had online.',
  }));
  panel.appendChild(el('p', {
    class: 'subtitle',
    text: 'Progression is capped at 8 hours. EXP only — items only drop while you\'re online.',
  }));

  panel.appendChild(el('div', { class: 'actions' }, [
    button('Log back in', () => {
      // Reload — the login screen will appear via the standard boot flow.
      location.reload();
    }, { class: 'ui-btn ui-btn-primary' }),
  ]));

  root.appendChild(panel);
}

function createUiLayer(): HTMLElement {
  const layer = document.createElement('div');
  layer.id = 'ui-layer';
  document.body.appendChild(layer);
  return layer;
}
