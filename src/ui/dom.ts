/**
 * DOM helpers for building UI panels imperatively.
 * Kept tiny — no framework, no JSX. Just `el()` + event hooks.
 */

export type ElAttrs = {
  class?: string;
  text?: string;
  html?: string;
  dataset?: Record<string, string>;
  onclick?: (ev: MouseEvent) => void;
  style?: Partial<CSSStyleDeclaration>;
  [k: string]: unknown;
};

/** Create an element with optional attributes + children. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: ElAttrs = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (attrs.class) node.className = attrs.class;
  if (attrs.text !== undefined) node.textContent = attrs.text;
  if (attrs.html !== undefined) node.innerHTML = attrs.html;
  if (attrs.dataset) {
    for (const [k, v] of Object.entries(attrs.dataset)) {
      node.dataset[k] = v;
    }
  }
  if (attrs.onclick) node.addEventListener('click', attrs.onclick as EventListener);
  if (attrs.style) {
    Object.assign(node.style, attrs.style);
  }
  for (const child of children) {
    if (typeof child === 'string') node.appendChild(document.createTextNode(child));
    else node.appendChild(child);
  }
  return node;
}

/** Shorthand button factory. */
export function button(label: string, onClick: () => void, opts: { class?: string; disabled?: boolean } = {}): HTMLButtonElement {
  const b = el('button', {
    class: opts.class ?? 'ui-btn',
    text: label,
    onclick: () => {
      if (!b.disabled) onClick();
    },
  });
  if (opts.disabled) b.disabled = true;
  return b;
}

/** Clear all children of a node. */
export function clear(node: HTMLElement): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

/** Format a number with thousand separators (zeny display etc.). */
export function fmtNum(n: number): string {
  return Math.floor(n).toLocaleString('en-US');
}

/** Format a fraction as a percentage string. */
export function fmtPct(frac: number, digits = 0): string {
  return `${(frac * 100).toFixed(digits)}%`;
}
