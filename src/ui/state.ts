/**
 * UI state manager.
 *
 * Tracks the currently active screen and exposes a tiny pub/sub so panels
 * can react to changes. Also tracks whether the simulation should be paused
 * (any non-battle screen pauses the sim).
 */

import type { Character } from '@engine/types';

export type ScreenId =
  | 'battle'        // in-combat (or in-field) — sim runs
  | 'town'          // town hub — sim paused
  | 'stats'         // stat allocation
  | 'skills'        // skill tree
  | 'inventory'     // inventory + equipment
  | 'classchange'   // class-change NPC
  | 'refine'        // (Stage 9) refine NPC
  | 'settings';

export interface UiState {
  screen: ScreenId;
  /** When true, the rAF loop skips simulation steps. */
  paused: boolean;
  /** Currently focused character (for stat/skill panels). */
  player: Character;
  /** Optional previous screen — used by "Back" buttons. */
  previousScreen: ScreenId | null;
}

export type UiListener = (state: UiState) => void;

export class Ui {
  private listeners = new Set<UiListener>();
  state: UiState;

  constructor(player: Character) {
    this.state = {
      screen: 'battle',
      paused: false,
      player,
      previousScreen: null,
    };
  }

  subscribe(fn: UiListener): () => void {
    this.listeners.add(fn);
    fn(this.state);
    return () => this.listeners.delete(fn);
  }

  /** Switch screens, automatically setting the paused flag. */
  go(screen: ScreenId): void {
    if (this.state.screen === screen) return;
    this.state.previousScreen = this.state.screen;
    this.state.screen = screen;
    this.state.paused = screen !== 'battle';
    this.emit();
  }

  /** Return to the previous screen (or battle if there isn't one). */
  back(): void {
    const target = this.state.previousScreen ?? 'battle';
    this.state.previousScreen = null;
    this.state.screen = target;
    this.state.paused = target !== 'battle';
    this.emit();
  }

  /** Force a re-render (used after data mutations like stat allocation). */
  refresh(): void {
    this.emit();
  }

  private emit(): void {
    for (const fn of this.listeners) fn(this.state);
  }
}
