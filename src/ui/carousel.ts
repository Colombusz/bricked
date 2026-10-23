import { CATALOG, COLORS, type Category } from '../bricks/catalog';
import { renderThumbnails } from '../bricks/thumbnails';
import { Placement } from '../placement';
import { icon } from './icons';

export class Carousel {
  readonly element = document.createElement('section');
  private category: Category = 'Bricks';
  private images = renderThumbnails();
  private list: HTMLElement;
  private tabs: HTMLElement;
  onChange = () => {};
  constructor(private placement: Placement) {
    this.element.className = 'parts-tray glass';
    this.element.setAttribute('aria-label', 'Brick and color palette');
    this.element.innerHTML = `
      <div class="tray-top"><div class="category-tabs" role="tablist" aria-label="Part category"></div><span class="tray-label">Pick a piece. Make it yours.</span></div>
      <div class="carousel-row"><button class="carousel-arrow" data-step="-1" aria-label="Previous part" title="Previous part [">${icon('chevronLeft',16)}</button><div class="parts-list" role="group" aria-label="Available parts"></div><button class="carousel-arrow" data-step="1" aria-label="Next part" title="Next part ]">${icon('chevronRight',16)}</button></div>
      <div class="palette-row"><div class="swatches" role="group" aria-label="Brick colors"></div><span class="color-name">Coral red</span></div>`;
    this.list = this.element.querySelector('.parts-list')!; this.tabs = this.element.querySelector('.category-tabs')!;
    for (const category of ['Bricks','Plates','Tiles'] as Category[]) {
      const button = document.createElement('button'); button.type = 'button';
      button.setAttribute('role','tab'); button.textContent = category;
      button.addEventListener('click', () => {
        this.category = category;
        this.placement.select(CATALOG.find(t => t.category === category)!.id);
        this.renderParts(); this.refresh(); this.onChange();
      }); this.tabs.append(button);
    }
    this.element.querySelectorAll<HTMLButtonElement>('[data-step]').forEach(button => button.addEventListener('click', () => this.step(Number(button.dataset.step))));
    this.list.addEventListener('wheel', e => { e.preventDefault(); this.list.scrollBy({ left: e.deltaY || e.deltaX, behavior: 'auto' }); }, { passive: false });
    const swatches = this.element.querySelector('.swatches')!;
    for (const color of COLORS) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'swatch';
      button.style.setProperty('--swatch',color.hex); button.dataset.color = color.hex;
      button.setAttribute('aria-label', color.name); button.title = color.name;
      button.addEventListener('click', () => {
        placement.setColor(color.hex); this.refresh(); this.onChange();
      }); swatches.append(button);
    }
    this.renderParts(); this.refresh();
    requestAnimationFrame(() => this.list.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: 'nearest', inline: 'center' }));
    let startX = 0, startScroll = 0, dragging = false, moved = false;
    this.list.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'mouse') return;
      startX = e.clientX; startScroll = this.list.scrollLeft; dragging = true; moved = false;
    });
    window.addEventListener('pointermove', e => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 5) { moved = true; this.list.scrollLeft = startScroll - dx; }
    });
    window.addEventListener('pointerup', () => { dragging = false; });
    this.list.addEventListener('click', e => { if (moved) { e.stopImmediatePropagation(); e.preventDefault(); moved = false; } }, true);
  }

  private renderParts() {
    this.list.replaceChildren();
    this.list.scrollLeft = 0;
    this.tabs.querySelectorAll('button').forEach(button => button.setAttribute('aria-selected', String(button.textContent === this.category)));
    for (const type of CATALOG.filter(t => t.category === this.category)) {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'part'; button.dataset.type = type.id;
      button.setAttribute('aria-label', `${type.category.slice(0,-1)} ${type.label}`);
      button.innerHTML = `<img src="${this.images.get(type.id)}" alt="" draggable="false"/><span>${type.label}</span>`;
      button.addEventListener('click', () => { this.placement.select(this.placement.selected === type.id ? null : type.id); this.refresh(); this.onChange(); });
      this.list.append(button);
    }
  }

  step(direction: number) {
    const parts = CATALOG.filter(t => t.category === this.category);
    const index = parts.findIndex(t => t.id === this.placement.selected);
    const next = (index + direction + parts.length) % parts.length;
    this.placement.select(parts[next].id); this.refresh();
    this.list.querySelector(`[data-type="${parts[next].id}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    this.onChange();
  }

  refresh() {
    this.list.querySelectorAll<HTMLButtonElement>('.part').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.type === this.placement.selected && !this.placement.erasing)));
    this.element.querySelectorAll<HTMLButtonElement>('.swatch').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.color === this.placement.color)));
    this.element.querySelector('.color-name')!.textContent = COLORS.find(c => c.hex === this.placement.color)?.name ?? 'Custom color';
  }
}
