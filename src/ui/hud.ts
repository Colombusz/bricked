import { CONFIG } from '../config';
import { icon } from './icons';

export interface Actions {
  tool(): void; erase(): void; rotate(): void; frame(): void; undo(): void; redo(): void;
  mute(): void; floating(value: boolean): void; save(): void; import(file: File): void; clear(): void;
  starter(): void; rename(name: string): void;
}

export class HUD {
  readonly fullscreenButton: HTMLButtonElement;
  readonly element = document.createElement('div');
  private help: HTMLDialogElement;
  private confirm: HTMLDialogElement;
  private renameDialog: HTMLDialogElement;
  private toastTimer = 0;
  onClear = () => this.actions.clear();
  constructor(root: HTMLElement, private actions: Actions) {
    this.element.className='ui-overlay';
    this.element.innerHTML=`
      <header class="app-header"><div class="brand"><span class="wordmark">bricked<span>.</span></span><span class="brand-divider"></span><span class="brand-tagline">Small bricks. Big possibilities.</span></div>
      <div class="header-actions"><button class="icon-button" data-action="sound" aria-label="Mute sound" title="Mute sound">${icon('sound')}</button><button class="icon-button" data-action="help" aria-label="Open controls" title="Controls (?)">${icon('help')}</button><span class="header-divider"></span><button class="save-button" data-action="save">${icon('save',17)}<span>Save build</span></button><div class="menu-wrap"><button class="icon-button" data-action="menu" aria-label="Build options" aria-expanded="false">${icon('more')}</button><div class="build-menu" hidden><button data-action="import">${icon('upload',17)}Import build</button><button data-action="starter">${icon('brick',17)}Load starter build</button><button data-action="clear" class="danger">${icon('trash',17)}Clear playground</button></div></div></div></header>
      <aside class="tool-rail glass" aria-label="Build tools">
        <button class="tool-button" data-action="tool" aria-label="Build tool" aria-pressed="true" title="Build (B)">${icon('brick',22)}<span class="tool-tip">Build <kbd>B</kbd></span></button>
        <button class="tool-button" data-action="erase" aria-label="Eraser tool" aria-pressed="false" title="Erase (X)">${icon('eraser',22)}<span class="tool-tip">Erase <kbd>X</kbd></span></button>
        <span class="tool-divider"></span>
        <button class="tool-button" data-action="rotate" aria-label="Rotate brick" title="Rotate (R)">${icon('rotate',21)}<span class="tool-tip">Rotate <kbd>R</kbd></span></button>
        <button class="tool-button" data-action="frame" aria-label="Frame build" title="Frame build (F)">${icon('frame',21)}<span class="tool-tip">Frame <kbd>F</kbd></span></button>
        <span class="tool-divider"></span>
        <button class="tool-button" data-action="undo" aria-label="Undo" title="Undo (Ctrl+Z)" disabled>${icon('undo',21)}</button>
        <button class="tool-button" data-action="redo" aria-label="Redo" title="Redo (Ctrl+Shift+Z)" disabled>${icon('redo',21)}</button>
      </aside>
      <div class="scene-intro"><span class="intro-line"></span><p>A little space<br>for <strong>big ideas.</strong></p><span class="intro-subtitle">Your imagination. No instructions.</span></div>
      <div class="project-hud"><button class="project-name" data-action="rename" title="Rename build">Untitled build${icon('down',14)}</button><div class="project-details"><span class="brick-count">0 pieces</span><span class="detail-dot"></span><span>${CONFIG.baseplateSize} × ${CONFIG.baseplateSize} studs</span><span class="detail-dot"></span><span class="save-state">Saved locally</span></div></div>
      <div class="bottom-center"><div class="placement-status" hidden></div><div class="controls-hint">${icon('mouse',15)}<span>Click to place</span><span class="hint-divider"></span><span><kbd>R</kbd> Rotate</span><span class="hint-divider"></span><span><kbd>Alt</kbd> + drag to orbit</span><button data-action="help" aria-label="Show all controls">?</button></div></div>
      <div class="view-controls"><div class="axis-gizmo" aria-label="View orientation"><span class="axis-line axis-line-x"></span><span class="axis-line axis-line-y"></span><span class="axis-line axis-line-z"></span><button data-axis="x" aria-label="View along X axis">x</button><button data-axis="y" aria-label="View from above">y</button><button data-axis="z" aria-label="View along Z axis">z</button><span class="axis-center"></span></div><span class="perspective-label">Perspective</span></div>
      <div class="toast" role="status" aria-live="polite" hidden></div>
      <input type="file" id="import-file" accept=".json,application/json" hidden>
      <dialog class="controls-dialog"><div class="dialog-top"><div><span class="dialog-eyebrow">Make yourself at home</span><h2>A few ways to play.</h2></div><button class="icon-button" data-close aria-label="Close controls">${icon('close')}</button></div>
      <div class="controls-grid"><section><h3>Build something</h3><dl>
      <div><dt>Place a piece</dt><dd>Left click / tap</dd></div>
      <div><dt>Rotate piece</dt><dd><kbd>R</kbd></dd></div>
      <div><dt>Previous / next piece</dt><dd><kbd>[</kbd> <kbd>]</kbd></dd></div>
      <div><dt>Build / erase tool</dt><dd><kbd>B</kbd> / <kbd>X</kbd></dd></div>
      <div><dt>Delete hovered piece</dt><dd><kbd>Delete</kbd> or <kbd>X</kbd></dd></div>
      <div><dt>Undo / redo</dt><dd><kbd>Ctrl</kbd> + <kbd>Z</kbd><br><kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>Z</kbd></dd></div>
      </dl></section><section><h3>Find your angle</h3><dl>
      <div><dt>Orbit</dt><dd><kbd>Alt</kbd> + left drag</dd></div>
      <div><dt>Pan</dt><dd>Middle drag</dd></div>
      <div><dt>Zoom</dt><dd>Mouse wheel</dd></div>
      <div><dt>Fly / look</dt><dd>Hold right mouse</dd></div>
      <div><dt>Move while flying</dt><dd><kbd>W A S D</kbd> + <kbd>Q E</kbd></dd></div>
      <div><dt>Fly faster</dt><dd><kbd>Shift</kbd> / wheel</dd></div>
      <div><dt>Frame your build</dt><dd><kbd>F</kbd></dd></div></dl></section></div>
      <div class="touch-note"><strong>On a touchscreen</strong><span>Drag to orbit. Pinch to zoom. Use two fingers to pan. Tap to place.</span></div>
      <p class="dialog-footnote">Your build saves automatically in this browser. Save a JSON file to keep it or share it.</p></dialog>
      <dialog class="confirm-dialog"><h2>Make a little room?</h2><p class="confirm-copy">This clears your playground. You can undo it if you change your mind.</p><div class="dialog-buttons"><button class="secondary-button" data-close>Keep building</button><button class="primary-button" data-confirm>Clear playground</button></div></dialog>
      <dialog class="rename-dialog"><form method="dialog"><h2>Name your creation</h2><label for="build-name">Build name</label><input id="build-name" maxlength="60" required autocomplete="off"><div class="dialog-buttons"><button type="button" class="secondary-button" data-close>Cancel</button><button type="submit" class="primary-button">Save name</button></div></form></dialog>`;
    this.element.querySelector('[data-action="save"]')!.setAttribute('aria-label','Save build');
    root.append(this.element);
    this.fullscreenButton=document.createElement('button'); this.fullscreenButton.className='fullscreen-button'; root.append(this.fullscreenButton);
    this.help=this.element.querySelector('.controls-dialog')!;
    this.confirm=this.element.querySelector('.confirm-dialog')!;
    this.renameDialog=this.element.querySelector('.rename-dialog')!;
    this.help.setAttribute('aria-label','Building and camera controls');
    this.confirm.setAttribute('aria-label','Confirm playground replacement');
    this.renameDialog.setAttribute('aria-label','Name your creation');
    this.element.querySelectorAll<HTMLButtonElement>('[data-action]').forEach(button=>button.addEventListener('click',()=>this.act(button.dataset.action!)));
    this.element.querySelectorAll<HTMLButtonElement>('[data-close]').forEach(button=>button.addEventListener('click',()=>button.closest('dialog')!.close()));
    this.element.querySelectorAll('dialog').forEach(dialog=>dialog.addEventListener('click',e=>{ if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();} }));
    this.element.querySelector<HTMLInputElement>('#import-file')!.addEventListener('change',e=>{const input=e.target as HTMLInputElement;if(input.files?.[0])actions.import(input.files[0]);input.value='';});
    this.renameDialog.querySelector('form')!.addEventListener('submit',e=>{e.preventDefault();const value=this.renameDialog.querySelector('input')!.value.trim();if(value){actions.rename(value);this.renameDialog.close();}});
    window.addEventListener('pointerdown',e=>{if(!(e.target as HTMLElement).closest('.menu-wrap'))this.closeMenu();});
    window.addEventListener('keydown',e=>{if(e.key==='Escape')this.closeMenu();});
  }
  private act(action:string) {
    if(action!=='menu')this.closeMenu();
    if(action==='help')this.showHelp();
    else if(action==='sound')this.actions.mute();
    else if(action==='menu') { const menu=this.element.querySelector<HTMLElement>('.build-menu')!; menu.hidden=!menu.hidden; this.element.querySelector('[data-action="menu"]')!.setAttribute('aria-expanded',String(!menu.hidden)); }
    else if(action==='import')this.element.querySelector<HTMLInputElement>('#import-file')!.click();
    else if(action==='clear')this.onClear();
    else if(action==='starter') {
      this.confirm.querySelector('h2')!.textContent='Start with a little inspiration?';
      this.confirm.querySelector('.confirm-copy')!.textContent='Replace this build with the starter house. You can undo this change.';
      const confirm=this.confirm.querySelector<HTMLButtonElement>('[data-confirm]')!;
      confirm.textContent='Load starter';
      confirm.onclick=()=>{this.confirm.close();this.actions.starter();};
      this.confirm.showModal();
    }
    else if(action==='rename') { const input=this.renameDialog.querySelector('input')!; input.value=this.element.querySelector('.project-name')!.textContent?.trim()??'';this.renameDialog.showModal();input.select(); }
    else if(action in this.actions)(this.actions[action as keyof Actions] as ()=>void)();
  }
  closeMenu() { this.element.querySelector<HTMLElement>('.build-menu')!.hidden=true;this.element.querySelector('[data-action="menu"]')!.setAttribute('aria-expanded','false'); }
  showHelp() { if(this.help.open)this.help.close();else this.help.showModal(); }
  toast(message:string,error=false,options?:{duration?:number;actionLabel?:string;onAction?:()=>void}) {
    const element=this.element.querySelector<HTMLElement>('.toast')!;
    element.textContent=message;element.hidden=false;element.classList.toggle('is-error',error);
    if(options?.actionLabel&&options.onAction){
      element.append(document.createTextNode(' · '));const button=document.createElement('button');button.textContent=options.actionLabel;button.setAttribute('aria-label','Undo clear build');button.onclick=()=>{options.onAction!();element.hidden=true;};element.append(button);
    }
    clearTimeout(this.toastTimer);this.toastTimer=window.setTimeout(()=>{element.hidden=true;},options?.duration??3500);
  }
  setProject(name:string,count:number) {
    const button=this.element.querySelector('.project-name')!;
    const title=document.createElement('span');title.className='project-title';title.textContent=name;
    button.replaceChildren(title);button.insertAdjacentHTML('beforeend',icon('down',14));
    this.element.querySelector('.brick-count')!.textContent=`${count.toLocaleString()} ${count===1?'piece':'pieces'}`;
    this.element.querySelector('.scene-intro')!.classList.toggle('empty',count===0);
  }
  setSaveState(message:string) { this.element.querySelector('.save-state')!.textContent=message; }
  setTools(erasing:boolean,canUndo:boolean,canRedo:boolean) {
    this.element.querySelector('[data-action="tool"]')!.setAttribute('aria-pressed',String(!erasing));
    this.element.querySelector('[data-action="erase"]')!.setAttribute('aria-pressed',String(erasing));
    this.element.querySelector<HTMLButtonElement>('[data-action="undo"]')!.disabled=!canUndo;
    this.element.querySelector<HTMLButtonElement>('[data-action="redo"]')!.disabled=!canRedo;
    const hint=this.element.querySelector('.controls-hint > span')!;hint.textContent=erasing?'Click to erase':'Click to place';
  }
  setSound(muted:boolean) {
    const button=this.element.querySelector<HTMLButtonElement>('[data-action="sound"]')!;
    button.innerHTML=icon(muted?'muted':'sound');button.setAttribute('aria-label',muted?'Unmute sound':'Mute sound');button.title=muted?'Unmute sound':'Mute sound';button.setAttribute('aria-pressed',String(muted));
  }
  setPlacement(reason:string,invalid:boolean) {
    const element=this.element.querySelector<HTMLElement>('.placement-status')!;element.hidden=!invalid;element.textContent=reason;
  }
}
