import { Placement } from '../placement';
import { canMirror } from '../bricks/catalog';
import { CONFIG } from '../config';
import { icon } from './icons';

export class ConstraintChips {
  readonly element=document.createElement('div');
  private limitPulse=0;
  private axisState='';
  private layerState: number | null | undefined;
  private mirrorButton:HTMLButtonElement;
  constructor(root: HTMLElement, private placement: Placement) {
    this.element.className='lock-controls';this.element.dataset.overlay='';this.element.setAttribute('aria-label','Placement constraints');
    this.element.innerHTML=`<button class="lock-chip axis-chip" aria-label="Toggle axis lock" title="Axis lock (hold Shift)" aria-pressed="false">Axis <kbd>Shift</kbd></button><div class="layer-control"><button class="lock-chip layer-chip" aria-label="Toggle layer lock" title="Q down · E up · L lock" aria-pressed="false">Layer <kbd>L</kbd></button><button class="layer-step" data-layer="1" aria-label="Raise locked layer" title="Raise layer (E)">▲</button><button class="layer-step" data-layer="-1" aria-label="Lower locked layer" title="Lower layer (Q)">▼</button></div>`;
    root.append(this.element);
    this.mirrorButton=document.createElement('button');this.mirrorButton.className='lock-chip mirror-chip';this.mirrorButton.title='Mirror left-right (M)';this.mirrorButton.setAttribute('aria-label','Mirror piece');
    this.mirrorButton.innerHTML=`${icon('mirror',17)}<span class="chip-label">Mirror</span><kbd>M</kbd>`;this.element.append(this.mirrorButton);this.mirrorButton.addEventListener('click',()=>placement.toggleMirror());
    this.element.querySelector('.axis-chip')!.addEventListener('click',()=>placement.toggleAxis());
    this.element.querySelector('.layer-chip')!.addEventListener('click',()=>placement.toggleLayer());
    this.element.querySelectorAll<HTMLButtonElement>('[data-layer]').forEach(button=>button.addEventListener('click',()=>placement.stepLayer(Number(button.dataset.layer))));
    this.element.addEventListener('wheel',e=>e.stopPropagation(),{passive:true});this.refresh();
  }
  mountRotate(button:HTMLButtonElement){button.className='lock-chip rotate-chip';button.innerHTML=`${icon('rotate',17)}<span class="chip-label">Rotate</span><kbd>R</kbd>`;this.element.insertBefore(button,this.mirrorButton);}
  refresh() {
    this.element.hidden=!this.placement.selected||this.placement.erasing;
    const {locks}=this.placement,axis=this.element.querySelector('.axis-chip')!,layer=this.element.querySelector('.layer-chip')!;
    const state=locks.axisActive?(locks.axis??'pending'):'off';
    if(state!==this.axisState){this.axisState=state;axis.setAttribute('aria-pressed',String(locks.axisActive));axis.setAttribute('data-axis',locks.axis??'pending');axis.innerHTML=locks.axisActive?`Axis lock ${locks.axis?.toUpperCase()??'…'}`:'Axis <kbd>Shift</kbd>';}
    if(this.layerState!==locks.layer){this.layerState=locks.layer;layer.setAttribute('aria-pressed',String(locks.layer!==null));layer.innerHTML=locks.layer===null?'Layer <kbd>L</kbd>':`Layer ${locks.layer}`;}
    this.mirrorButton.hidden=!this.placement.selected||!canMirror(this.placement.selected);this.mirrorButton.setAttribute('aria-pressed',String(this.placement.mirror));
    if(this.limitPulse!==locks.limitPulse){this.limitPulse=locks.limitPulse;layer.animate([{background:'#f7bc69'},{background:'#ffffffd9'}],{duration:CONFIG.layerLimitFlashDuration});}
  }
}
