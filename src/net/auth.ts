/**
 * REST auth client.
 *
 * Stores the access JWT in localStorage (OK for SPA — it's a short-lived
 * token; refresh is in an httpOnly cookie set by the server).
 *
 * On 401 from the API, the caller can call refresh() to mint a new access
 * token via the refresh cookie.
 */

import { API_BASE } from './config';

const ACCESS_TOKEN_KEY = 'idlero_access_token';
const USERNAME_KEY = 'idlero_username';
const USER_ID_KEY = 'idlero_user_id';

export interface AuthState {
  accessToken: string | null;
  username: string | null;
  userId: number | null;
}

export function loadAuthState(): AuthState {
  return {
    accessToken: localStorage.getItem(ACCESS_TOKEN_KEY),
    username: localStorage.getItem(USERNAME_KEY),
    userId: Number(localStorage.getItem(USER_ID_KEY)) || null,
  };
}

function saveAuthState(s: AuthState): void {
  if (s.accessToken) localStorage.setItem(ACCESS_TOKEN_KEY, s.accessToken);
  else localStorage.removeItem(ACCESS_TOKEN_KEY);
  if (s.username) localStorage.setItem(USERNAME_KEY, s.username);
  else localStorage.removeItem(USERNAME_KEY);
  if (s.userId != null) localStorage.setItem(USER_ID_KEY, String(s.userId));
  else localStorage.removeItem(USER_ID_KEY);
}

export async function register(username: string, password: string): Promise<AuthState> {
  const res = await fetch(`${API_BASE}/api/v1/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(toMessage(err));
  }
  const body = await res.json();
  const state: AuthState = {
    accessToken: body.accessToken,
    username: body.user.username,
    userId: body.user.id,
  };
  saveAuthState(state);
  return state;
}

export async function login(username: string, password: string): Promise<AuthState> {
  const res = await fetch(`${API_BASE}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(toMessage(err));
  }
  const body = await res.json();
  const state: AuthState = {
    accessToken: body.accessToken,
    username: body.user.username,
    userId: body.user.id,
  };
  saveAuthState(state);
  return state;
}

export async function logout(): Promise<void> {
  try {
    await fetch(`${API_BASE}/api/v1/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
  } catch {
    // ignore — local state is what matters
  }
  saveAuthState({ accessToken: null, username: null, userId: null });
}

export async function refresh(): Promise<AuthState> {
  const res = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!res.ok) {
    saveAuthState({ accessToken: null, username: null, userId: null });
    throw new Error('refresh_failed');
  }
  const body = await res.json();
  const current = loadAuthState();
  const state: AuthState = {
    accessToken: body.accessToken,
    username: current.username,
    userId: current.userId,
  };
  saveAuthState(state);
  return state;
}

function toMessage(err: { error?: string; issues?: { message: string }[] }): string {
  if (err.issues && err.issues.length > 0) return err.issues[0]!.message;
  switch (err.error) {
    case 'username_taken':       return 'Username already taken';
    case 'invalid_credentials':  return 'Wrong username or password';
    case 'validation':           return 'Invalid input';
    default: return err.error ?? 'request_failed';
  }
}
