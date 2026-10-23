import { COLORS } from '../../bricks/catalog';
import { PaletteStore } from './paletteStore';
import { ColorWheel } from './colorWheel';
import { Popover } from '../popover';
import { CONFIG } from '../../config';
import { icon } from '../icons';

export class ColorPanel {
  readonly element=document.createElement('aside');
  readonly popover: Popover;
  readonly wheel: ColorWheel;
  private current: HTMLButtonElement;
  private strip: HTMLElement;
  private grid: HTMLElement;
  private selector: HTMLSelectElement;
  private editing=false;
  private formMode: 'create'|'rename'='create';
  constructor(root: HTMLElement, readonly store: PaletteStore) {
    this.element.className='color-strip glass';this.element.dataset.overlay='';this.element.setAttribute('aria-label','Color palette');
    this.element.innerHTML=`<button class="current-color color-dot" title="Open palettes"><span></span>${icon('chevronLeft',10)}</button><div class="strip-colors" data-surface></div><button class="add-custom" aria-label="Add a custom color" title="Custom color">+</button>`;
    root.append(this.element);this.current=this.element.querySelector('.current-color')!;this.strip=this.element.querySelector('.strip-colors')!;
    this.element.addEventListener('wheel',e=>e.stopPropagation(),{passive:true});
    this.popover=new Popover(root,this.current,'Colors & palettes','palette-flyout');
    this.popover.content.innerHTML=`<label class="field-label" for="palette-selector">Saved palette</label><select id="palette-selector" aria-label="Palette"></select>
      <div class="palette-actions"><button data-palette="create">New</button><button data-palette="rename">Rename</button><button data-palette="duplicate">Duplicate</button><button data-palette="delete" class="danger">Delete</button></div>
      <form class="palette-name-form" hidden><label for="palette-name">Palette name</label><input id="palette-name" maxlength="40" autocomplete="off" required><div class="inline-actions"><button type="button" data-palette="cancel-name">Cancel</button><button type="submit">Save palette</button></div></form>
      <div class="palette-delete-confirm" hidden><p>Delete this palette?</p><div class="inline-actions"><button data-palette="cancel-delete">Cancel</button><button data-palette="confirm-delete" class="danger">Delete palette</button></div></div>
      <div class="palette-grid-heading"><span class="palette-count"></span><button data-palette="edit">Edit colors</button></div><div class="palette-grid" role="group" aria-label="Active palette colors"></div>
      <p class="palette-message" role="status" hidden></p>
      <details class="custom-section"><summary>Custom color</summary><div class="wheel-mount"></div><button class="add-to-palette primary-button">Add to palette</button></details>
      <div class="recent-section"><h3>Recent <span>Placed colors</span></h3><div class="recent-colors" role="group" aria-label="Recently placed colors"></div><p class="recent-empty">Colors appear here when you place a brick.</p></div>`;
    this.selector=this.popover.content.querySelector('select')!;this.grid=this.popover.content.querySelector('.palette-grid')!;
    this.wheel=new ColorWheel(store.selectedColor);this.popover.content.querySelector('.wheel-mount')!.append(this.wheel.element);
    this.wheel.onColor=color=>store.selectColor(color);
    this.current.addEventListener('click',()=>this.popover.toggle());
    this.element.querySelector('.add-custom')!.addEventListener('click',()=>{this.popover.show();this.popover.content.querySelector('details')!.open=true;});
    this.selector.addEventListener('change',()=>{this.editing=false;store.selectPalette(this.selector.value);this.clearMessage();this.closeForms();});
    this.popover.content.querySelector('.add-to-palette')!.addEventListener('click',()=>{const error=store.addColor();this.message(error??'Color added to your palette.');});
    this.popover.content.querySelectorAll<HTMLButtonElement>('[data-palette]').forEach(button=>button.addEventListener('click',()=>this.action(button.dataset.palette!)));
    this.popover.content.querySelector('form')!.addEventListener('submit',e=>{
      e.preventDefault();const input=this.popover.content.querySelector<HTMLInputElement>('#palette-name')!;
      const error=this.formMode==='create'?store.create(input.value):store.rename(input.value);
      if(error)this.message(error);else{this.closeForms();this.clearMessage();}
    });
    store.subscribe(change=>{if(change==='palette')this.renderPalette();if(change==='recent')this.renderRecent();this.refreshColor();});
    this.renderPalette();this.renderRecent();this.refreshColor();
  }
  selectIndex(index: number) {const color=this.store.active.colors[index];if(color)this.store.selectColor(color);}
  private action(action: string) {
    if(action==='create'||action==='rename'){
      this.formMode=action;this.closeForms();
      this.popover.content.querySelector<HTMLElement>('.palette-name-form')!.hidden=false;
      const input=this.popover.content.querySelector<HTMLInputElement>('#palette-name')!;input.value=action==='rename'?this.store.active.name:'';input.focus();input.select();
    }
    if(action==='duplicate'){const error=this.store.duplicate();if(error)this.message(error);else this.clearMessage();}
    if(action==='delete'){this.closeForms();this.popover.content.querySelector<HTMLElement>('.palette-delete-confirm')!.hidden=false;}
    if(action==='confirm-delete'){this.editing=false;this.store.deleteActive();this.closeForms();this.clearMessage();}
    if(action==='cancel-delete'||action==='cancel-name')this.closeForms();
    if(action==='edit'){this.editing=!this.editing;this.renderPalette();this.refreshColor();}
  }
  private closeForms(){this.popover.content.querySelector<HTMLElement>('.palette-name-form')!.hidden=true;this.popover.content.querySelector<HTMLElement>('.palette-delete-confirm')!.hidden=true;}
  private message(text: string){const node=this.popover.content.querySelector<HTMLElement>('.palette-message')!;node.textContent=text;node.hidden=false;}
  private clearMessage(){this.popover.content.querySelector<HTMLElement>('.palette-message')!.hidden=true;}
  private swatch(color: string, location: string) {
    const button=document.createElement('button');button.type='button';button.className='color-dot palette-swatch';button.dataset.color=color;button.style.setProperty('--color',color);
    const name=COLORS.find(c=>c.hex===color)?.name;
    button.setAttribute('aria-label',`${name?name+' ':''}${color}${location==='recent'?' (recent)':''}`);button.title=`${name??color} ${color}`;
    button.addEventListener('click',()=>this.store.selectColor(color));return button;
  }
  private renderPalette() {
    this.selector.replaceChildren();
    for(const palette of this.store.palettes){const option=document.createElement('option');option.value=palette.id;option.textContent=palette.name;this.selector.append(option);}
    this.selector.value=this.store.active.id;
    for(const name of ['rename','delete','edit'])this.popover.content.querySelector<HTMLButtonElement>(`[data-palette="${name}"]`)!.disabled=!this.store.editable;
    this.popover.content.querySelector<HTMLButtonElement>('[data-palette="edit"]')!.textContent=this.editing?'Done editing':'Edit colors';
    this.popover.content.querySelector('.palette-count')!.textContent=`${this.store.active.colors.length} / ${CONFIG.maxPaletteColors} colors`;
    this.strip.replaceChildren();this.grid.replaceChildren();
    for(const color of this.store.active.colors){
      this.strip.append(this.swatch(color,'strip'));
      const cell=document.createElement('div');cell.className='palette-cell';const button=this.swatch(color,'grid');cell.append(button);
      if(this.store.editable){
        const remove=document.createElement('button');remove.type='button';remove.className='remove-color';remove.textContent='×';remove.setAttribute('aria-label',`Remove ${color}`);remove.hidden=!this.editing;
        remove.addEventListener('click',()=>this.store.removeColor(color));cell.append(remove);
        let timer=0;
        button.addEventListener('pointerdown',e=>{if(e.pointerType!=='touch')return;timer=window.setTimeout(()=>{this.editing=true;this.renderPalette();this.refreshColor();},CONFIG.longPressDuration);});
        const cancel=()=>clearTimeout(timer);button.addEventListener('pointerup',cancel);button.addEventListener('pointercancel',cancel);button.addEventListener('pointermove',cancel);
      }
      this.grid.append(cell);
    }
    this.grid.classList.toggle('is-editing',this.editing);
    if(!this.store.active.colors.length){const empty=document.createElement('p');empty.className='palette-empty';empty.textContent='Choose a custom color, then add it here.';this.grid.append(empty);}
  }
  private renderRecent() {
    const row=this.popover.content.querySelector('.recent-colors')!;row.replaceChildren();
    this.store.recent.forEach(color=>row.append(this.swatch(color,'recent')));
    this.popover.content.querySelector<HTMLElement>('.recent-empty')!.hidden=Boolean(this.store.recent.length);
  }
  private refreshColor() {
    this.current.style.setProperty('--color',this.store.selectedColor);this.current.setAttribute('aria-label',`Current color ${this.store.selectedColor}, open palettes`);
    for(const scope of [this.element,this.popover.content])scope.querySelectorAll<HTMLButtonElement>('[data-color]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.color===this.store.selectedColor)));
    this.wheel.setColor(this.store.selectedColor);
  }
}
