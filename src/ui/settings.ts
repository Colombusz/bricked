import { CONFIG } from '../config';
import { SettingsStore, type Settings } from '../settingsStore';
import { Popover } from './popover';

export class SettingsPanel {
  readonly popover: Popover;
  constructor(root: HTMLElement,trigger: HTMLButtonElement,readonly store: SettingsStore){
    this.popover=new Popover(root,trigger,'Settings','settings-popover');
    const slider=(key:string,label:string,main=false)=>`<label class="setting-slider ${main?'master-sensitivity':''}"><span>${label}<output data-value="${key}"></output></span><input type="range" min="${CONFIG.sensitivityMin}" max="${CONFIG.sensitivityMax}" step="${CONFIG.sensitivityStep}" data-setting="${key}" aria-label="${label}"></label>`;
    const toggle=(key:string,label:string)=>`<label class="setting-toggle"><span>${label}</span><input type="checkbox" data-setting="${key}" aria-label="${label}" ${key==='allowFloating'?'id="allow-floating"':''}><span class="toggle-track"></span></label>`;
    this.popover.content.innerHTML=`${slider('master','Camera sensitivity',true)}<p class="setting-hint">One dial for the way you move.</p><details class="fine-tune"><summary>Fine-tune</summary>${slider('rotation','Rotation')}${slider('pan','Pan')}${slider('zoom','Zoom')}${slider('fly','Fly speed')}${toggle('invertY','Invert Y')}</details><div class="settings-options">${toggle('allowFloating','Allow floating bricks')}${toggle('sound','Sound')}</div><button class="reset-settings secondary-button">Reset to defaults</button><p class="setting-footnote">Settings save in this browser.</p>`;
    trigger.addEventListener('click',()=>this.popover.toggle());
    this.popover.content.querySelectorAll<HTMLInputElement>('[data-setting]').forEach(input=>input.addEventListener('input',()=>{
      const key=input.dataset.setting as keyof Settings;
      if(input.type==='checkbox')store.set(key,input.checked);else store.set(key,Number(input.value));
    }));
    this.popover.content.querySelector('.reset-settings')!.addEventListener('click',()=>store.reset());
    store.subscribe(()=>this.refresh());this.refresh();
    const position=()=>{
      const b=trigger.getBoundingClientRect(),r=root.getBoundingClientRect();
      this.popover.element.style.left=`${Math.max(10,Math.min(b.left-r.left,root.clientWidth-Math.min(320,root.clientWidth-20)-10))}px`;
      this.popover.element.style.bottom=`${r.bottom-b.top+10}px`;
      this.popover.element.style.maxHeight=`calc(${Math.max(100,b.top-r.top-20)}px - env(safe-area-inset-top, 0px))`;
    };
    this.popover.onToggle=open=>{if(open)position();};new ResizeObserver(()=>{if(this.popover.open)position();}).observe(root);
  }
  private refresh(){
    this.popover.content.querySelectorAll<HTMLInputElement>('[data-setting]').forEach(input=>{
      const key=input.dataset.setting as keyof Settings,value=this.store.value[key];
      if(input.type==='checkbox')input.checked=Boolean(value);else{input.value=String(value);this.popover.content.querySelector(`[data-value="${key}"]`)!.textContent=`${Number(value).toFixed(2)}×`;}
    });
  }
}
