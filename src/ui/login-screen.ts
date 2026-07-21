/**
 * Login / Register screen.
 *
 * Single panel with two tabs. On success, the caller (main.ts) tears this
 * screen down and starts the WebSocket client.
 */

import { el, clear, button } from './dom';
import { login, register } from '../net/auth';
import type { AuthState } from '../net/auth';

export interface LoginActions {
  onAuthed: (s: AuthState) => void;
}

export function renderLogin(root: HTMLElement, _actions: LoginActions): void {
  // We render a tabbed form (login | register) and dispatch on submit.
  let mode: 'login' | 'register' = 'login';
  const rerender = () => render(root, mode, setMode, onSubmit);
  const setMode = (m: 'login' | 'register') => { mode = m; rerender(); };
  const onSubmit = async (username: string, password: string, errorMsg: HTMLElement) => {
    errorMsg.textContent = '';
    try {
      const s = mode === 'login' ? await login(username, password) : await register(username, password);
      _actions.onAuthed(s);
    } catch (e) {
      errorMsg.textContent = (e as Error).message;
    }
  };
  rerender();
}

function render(
  root: HTMLElement,
  mode: 'login' | 'register',
  onMode: (m: 'login' | 'register') => void,
  onSubmit: (u: string, p: string, errEl: HTMLElement) => void,
): void {
  clear(root);
  const panel = el('div', { class: 'panel login-panel' }, []);
  panel.appendChild(el('h2', { text: '🏹 idleRO' }));
  panel.appendChild(el('p', { class: 'subtitle', text: 'Log in or create an account to play.' }));

  const tabs = el('div', { class: 'login-tabs' }, [
    button('Log in', () => onMode('login'), { class: mode === 'login' ? 'ui-btn ui-btn-primary' : 'ui-btn' }),
    button('Register', () => onMode('register'), { class: mode === 'register' ? 'ui-btn ui-btn-primary' : 'ui-btn' }),
  ]);
  panel.appendChild(tabs);

  const userIn = el('input', { class: 'login-input' }) as HTMLInputElement;
  userIn.type = 'text';
  userIn.placeholder = 'username';
  userIn.minLength = 3;
  userIn.maxLength = 32;
  userIn.required = true;
  panel.appendChild(userIn);

  const passIn = el('input', { class: 'login-input' }) as HTMLInputElement;
  passIn.type = 'password';
  passIn.placeholder = 'password';
  passIn.minLength = 6;
  passIn.required = true;
  panel.appendChild(passIn);

  const errorEl = el('div', { class: 'login-error' });
  panel.appendChild(errorEl);

  const submit = button(mode === 'login' ? 'Log in' : 'Create account', () => {
    const u = userIn.value.trim();
    const p = passIn.value;
    if (!u || !p) {
      errorEl.textContent = 'Fill in both fields';
      return;
    }
    void onSubmit(u, p, errorEl);
  }, { class: 'ui-btn ui-btn-primary' });
  panel.appendChild(submit);

  userIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') passIn.focus(); });
  passIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') (submit as HTMLButtonElement).click(); });

  root.appendChild(panel);
}
