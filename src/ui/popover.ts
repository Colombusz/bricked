import { isEditing } from '../input';
import { icon } from './icons';

const openPopovers = new Set<Popover>();
export class Popover {
  readonly element = document.createElement('section');
  readonly content = document.createElement('div');
  onToggle = (_open: boolean) => {};
  constructor(root: HTMLElement, readonly trigger: HTMLButtonElement, label: string, className: string) {
    this.element.className = `floating-panel glass ${className}`;
    this.element.dataset.overlay = ''; this.element.dataset.surface = '';
    this.element.hidden = true; this.element.role = 'dialog'; this.element.setAttribute('aria-label', label);
    this.element.id = `popover-${className}`;
    trigger.setAttribute('aria-controls', this.element.id); trigger.setAttribute('aria-expanded', 'false');
    const heading = document.createElement('div'); heading.className = 'popover-heading';
    const title = document.createElement('h2'); title.textContent = label;
    const close = document.createElement('button'); close.className = 'icon-button'; close.type = 'button';
    close.setAttribute('aria-label', `Close ${label.toLowerCase()}`); close.innerHTML = icon('close', 17);
    close.addEventListener('click', () => { this.close(); trigger.focus(); });
    heading.append(title, close); this.element.append(heading, this.content); root.append(this.element);
    this.element.addEventListener('wheel', e => e.stopPropagation(), {passive: true});
    window.addEventListener('pointerdown', e => {
      if (!this.element.hidden && !this.element.contains(e.target as Node) && !trigger.contains(e.target as Node)) this.close();
    });
    window.addEventListener('keydown', e => { if (e.key === 'Escape' && !isEditing(e.target)) this.close(); });
  }
  get open() { return !this.element.hidden; }
  show() {
    for (const popover of openPopovers) if (popover !== this) popover.close();
    this.element.hidden = false; openPopovers.add(this); this.trigger.setAttribute('aria-expanded', 'true'); this.onToggle(true);
  }
  close() { this.element.hidden = true; openPopovers.delete(this); this.trigger.setAttribute('aria-expanded','false'); this.onToggle(false); }
  toggle() { if (this.open) this.close(); else this.show(); }
  static closeAll() { for (const popover of [...openPopovers]) popover.close(); }
}
