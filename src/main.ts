/**
 * Main entry point — server-authoritative thin client.
 *
 * Flow:
 *   1. Try to load existing auth (refresh token cookie). If absent, show
 *      the Login screen.
 *   2. After auth, open the WebSocket and wait for the initial 'state'.
 *   3. Canvas renders from the store; UI panels send commands via WS.
 *
 * No local simulation. No engine. The server owns everything.
 */

import './style.css';
import './ui/ui.css';

import { CanvasRenderer } from '@render/canvas';
import { PlaceholderSpriteProvider } from '@render/sprites';
import { Ui } from './ui/state';
import { renderLogin, type LoginActions } from './ui/login-screen';
import { renderTown } from './ui/town';
import { renderStats } from './ui/stats-panel';
import { renderSkills } from './ui/skills-panel';
import { renderInventory } from './ui/inventory-panel';
import { renderClassChange } from './ui/classchange-panel';
import { renderRefine } from './ui/refine-panel';
import { renderCardSocket } from './ui/card-panel';
import { renderAiEditor, type AiEditorActions } from './ui/ai-editor';
import { WsClient } from './net/ws-client';
import { loadAuthState, logout as authLogout, type AuthState } from './net/auth';
import { store } from './state/store';
import type { Character } from '@engine/types';
import type { PriorityListConfig } from '@ai/priority-list';

// ============================================================================
// Boot
// ============================================================================

const canvas = document.querySelector<HTMLCanvasElement>('#game')!;
const hud = document.querySelector<HTMLElement>('#hud')!;
const uiLayer = document.createElement('div');
uiLayer.id = 'ui-layer';
document.body.appendChild(uiLayer);

const sprites = new PlaceholderSpriteProvider();
const renderer = new CanvasRenderer(canvas, sprites);
window.addEventListener('resize', () => renderer.resize());

const ws = new WsClient();

// ============================================================================
// UI state — placeholder until WS delivers the real character
// ============================================================================

let ui: Ui | null = null;

function ensureUi(character: Character): Ui {
  if (!ui) ui = new Ui(character);
  return ui;
}

// ============================================================================
// Screens
// ============================================================================

const aiEditorActions: AiEditorActions = {
  apply: (config: PriorityListConfig) => ws.sendCommand({ kind: 'change_behavior', config }),
  save: (config: PriorityListConfig) => ws.sendCommand({ kind: 'change_behavior', config }),
};

function renderScreens(screen: string): void {
  while (uiLayer.firstChild) uiLayer.removeChild(uiLayer.firstChild);
  const s = store.get();
  if (!s.character) return;

  if (screen === 'battle') {
    uiLayer.classList.remove('active');
    return;
  }
  uiLayer.classList.add('active');
  const currentUi = ui!;
  switch (screen) {
    case 'town':        renderTown(uiLayer, currentUi); break;
    case 'stats':       renderStats(uiLayer, currentUi); break;
    case 'skills':      renderSkills(uiLayer, currentUi); break;
    case 'inventory':   renderInventory(uiLayer, currentUi); break;
    case 'classchange': renderClassChange(uiLayer, currentUi); break;
    case 'refine':      renderRefine(uiLayer, currentUi); break;
    case 'cards':       renderCardSocket(uiLayer, currentUi); break;
    case 'ai':          renderAiEditor(uiLayer, currentUi, aiEditorActions); break;
    default: break;
  }
}

// ============================================================================
// Login flow
// ============================================================================

function showLogin(): void {
  canvas.style.display = 'none';
  hud.style.display = 'none';
  while (uiLayer.firstChild) uiLayer.removeChild(uiLayer.firstChild);
  uiLayer.classList.add('active');
  const actions: LoginActions = {
    onAuthed: (_s: AuthState) => {
      uiLayer.classList.remove('active');
      canvas.style.display = '';
      hud.style.display = '';
      startGame();
    },
  };
  renderLogin(uiLayer, actions);
}

// ============================================================================
// Game start — connect WS and react to state messages
// ============================================================================

function startGame(): void {
  ws.onMessage((msg) => {
    switch (msg.type) {
      case 'hello':
        store.setUser({ id: msg.user.id, username: msg.user.username });
        break;
      case 'state':
        store.setState(msg.character, msg.world);
        if (!ui) {
          ui = ensureUi(msg.character);
          ui.subscribe((s) => renderScreens(s.screen));
          renderHud();
        } else {
          // Swap the player reference the Ui exposes.
          (ui as unknown as { player: Character }).player = msg.character;
        }
        break;
      case 'paused':
        store.setPaused(msg.paused);
        break;
      case 'command_ack':
        if (!msg.ok) console.warn('command failed', msg.error);
        break;
      case 'events':
        // Forward to renderer for floating damage numbers etc.
        for (const ev of msg.events) {
          eventBuffer.push({
            kind: ev.kind,
            attackerUid: ev.attackerUid,
            targetUid: ev.targetUid,
            damage: ev.damage,
            isCrit: ev.isCrit,
            tick: msg.tick,
          });
        }
        break;
      case 'error':
        console.warn('server error', msg.error);
        break;
    }
  });

  ws.onConnectedChange((connected) => store.setConnected(connected));
  ws.start();
}

// ============================================================================
// HUD (top-right Town button + preset bar)
// ============================================================================

const eventBuffer: { kind: string; attackerUid?: string; targetUid?: string; damage?: number; isCrit?: boolean; tick: number }[] = [];

function renderHud(): void {
  hud.innerHTML = `
    <div id="top-bar">
      <button id="logout-btn" class="ui-btn ui-btn-tiny">⎋ Logout</button>
      <button id="town-btn" class="ui-btn ui-btn-primary">🛖 Town</button>
    </div>
    <div id="conn-indicator">⟳ connecting…</div>
  `;
  hud.querySelector<HTMLButtonElement>('#town-btn')!.addEventListener('click', () => {
    ws.sendCommand({ kind: 'open_town' });
    ui?.go('town');
  });
  hud.querySelector<HTMLButtonElement>('#logout-btn')!.addEventListener('click', async () => {
    ws.stop();
    await authLogout();
    location.reload();
  });

  store.subscribe((s) => {
    const ind = hud.querySelector<HTMLElement>('#conn-indicator');
    if (ind) ind.textContent = s.connected ? '● connected' : '○ offline';
  });
}

// ============================================================================
// Render loop — pull from store, no local simulation
// ============================================================================

let lastFrame = performance.now();

function loop(now: number): void {
  void lastFrame;
  lastFrame = now;
  const s = store.get();
  if (s.world && s.character) {
    const events = eventBuffer.splice(0, eventBuffer.length);
    renderer.draw(s.world, events);
  }
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);

// ============================================================================
// Boot decision: logged in → game, otherwise → login screen
// ============================================================================

(async () => {
  const auth = loadAuthState();
  if (auth.accessToken && auth.username) {
    canvas.style.display = '';
    hud.style.display = '';
    startGame();
  } else {
    showLogin();
  }
})();
