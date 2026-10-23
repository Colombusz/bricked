import { CATALOG, type Category } from '../bricks/catalog';
import { renderThumbnails } from '../bricks/thumbnails';
import { Placement } from '../placement';
import { CONFIG } from '../config';
import { readJSON, writeJSON } from '../storage';
import { icon } from './icons';

export class Carousel {
  readonly element = document.createElement('section');
  private category: Category = 'Bricks';
  private images = renderThumbnails();
  private list: HTMLElement;
  private tabs: HTMLElement;
  collapsed = false;
  onChange = () => {};

  constructor(private placement: Placement) {
    const saved = readJSON(CONFIG.carouselStorageKey);
    this.collapsed = Boolean(saved && typeof saved === 'object' && 'version' in saved && saved.version === 1 && 'collapsed' in saved && saved.collapsed === true);
    this.element.className = 'parts-tray glass';
    this.element.dataset.overlay = '';
    this.element.setAttribute('aria-label', 'Parts carousel');
    this.element.innerHTML = `<div class="category-tabs" role="tablist" aria-label="Part category"></div>
      <button class="carousel-arrow" data-step="-1" aria-label="Previous part" title="Previous part [">${icon('chevronLeft',16)}</button>
      <div class="parts-list" role="group" aria-label="Available parts"></div>
      <button class="carousel-arrow" data-step="1" aria-label="Next part" title="Next part ]">${icon('chevronRight',16)}</button>
      <button class="collapse-tray" aria-label="Collapse parts" title="Collapse parts">${icon('down',16)}</button>
      <button class="expand-tray" aria-label="Expand parts" title="Expand parts"><img alt=""/><span></span>${icon('down',14)}</button>`;
    this.list = this.element.querySelector('.parts-list')!;
    this.tabs = this.element.querySelector('.category-tabs')!;
    for (const category of ['Bricks', 'Plates', 'Tiles'] as Category[]) {
      const button = document.createElement('button');
      button.type = 'button'; button.role = 'tab'; button.textContent = category;
      button.addEventListener('click', () => {
        this.category = category;
        this.placement.select(CATALOG.find(t => t.category === category)!.id);
        this.renderParts(); this.refresh(); this.onChange();
      });
      this.tabs.append(button);
    }
    this.tabs.addEventListener('keydown', e => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      e.preventDefault();
      const buttons = [...this.tabs.querySelectorAll('button')];
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      const next = buttons[(index + (e.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length];
      next.click(); next.focus();
    });
    this.element.querySelectorAll<HTMLButtonElement>('[data-step]').forEach(button => button.addEventListener('click', () => this.step(Number(button.dataset.step))));
    this.element.addEventListener('wheel', e => {
      e.preventDefault(); e.stopPropagation();
      if (!this.collapsed) this.list.scrollBy({left: e.deltaY || e.deltaX, behavior: 'auto'});
    }, {passive: false});
    this.element.querySelector('.collapse-tray')!.addEventListener('click', () => this.collapse(true));
    this.element.querySelector('.expand-tray')!.addEventListener('click', () => this.collapse(false));
    this.renderParts(); this.refresh();
    new ResizeObserver(() => this.checkOverflow()).observe(this.list);
    requestAnimationFrame(() => this.revealSelection());
    let startX = 0, startScroll = 0, dragging = false, moved = false;
    this.list.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      startX = e.clientX; startScroll = this.list.scrollLeft; dragging = true; moved = false;
    });
    window.addEventListener('pointermove', e => {
      if (!dragging) return;
      if (Math.abs(e.clientX - startX) > 5) { moved = true; this.list.scrollLeft = startScroll - (e.clientX - startX); }
    });
    window.addEventListener('pointerup', () => { dragging = false; });
    window.addEventListener('blur', () => { dragging = false; });
    this.list.addEventListener('click', e => { if (moved) { e.stopImmediatePropagation(); e.preventDefault(); moved = false; } }, true);
  }

  private renderParts() {
    this.list.replaceChildren(); this.list.scrollLeft = 0;
    this.tabs.querySelectorAll('button').forEach(button => button.setAttribute('aria-selected', String(button.textContent === this.category)));
    for (const type of CATALOG.filter(t => t.category === this.category)) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'part'; button.dataset.type = type.id;
      button.setAttribute('aria-label', `${type.category.slice(0,-1)} ${type.label}`);
      button.innerHTML = `<img src="${this.images.get(type.id)}" alt="" draggable="false"/><span>${type.label}</span>`;
      button.addEventListener('click', () => { this.placement.select(this.placement.selected === type.id ? null : type.id); this.refresh(); this.onChange(); });
      this.list.append(button);
    }
    requestAnimationFrame(() => this.checkOverflow());
  }
  private checkOverflow() { this.element.classList.toggle('has-overflow', this.list.scrollWidth > this.list.clientWidth + 1); }
  private revealSelection() { this.list.querySelector('[aria-pressed="true"]')?.scrollIntoView({behavior:'smooth', block:'nearest', inline:'center'}); }
  collapse(value: boolean) {
    this.collapsed = value; writeJSON(CONFIG.carouselStorageKey, {version:1, collapsed:value});
    this.refresh(); this.onChange();
    if (!value) requestAnimationFrame(() => this.revealSelection());
  }
  step(direction: number) {
    const parts = CATALOG.filter(t => t.category === this.category);
    const index = parts.findIndex(t => t.id === this.placement.selected);
    this.placement.select(parts[(index + direction + parts.length) % parts.length].id);
    this.refresh(); this.revealSelection(); this.onChange();
  }
  refresh() {
    this.element.classList.toggle('is-collapsed', this.collapsed);
    this.list.querySelectorAll<HTMLButtonElement>('.part').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.type === this.placement.selected && !this.placement.erasing)));
    const type = CATALOG.find(t => t.id === this.placement.selected);
    const image = this.element.querySelector<HTMLImageElement>('.expand-tray img')!;
    image.hidden = !type; if (type) image.src = this.images.get(type.id)!;
    this.element.querySelector('.expand-tray span')!.textContent = type?.label ?? 'Parts';
  }
}
