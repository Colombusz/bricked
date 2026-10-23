import { Placement } from '../placement';

export class ConstraintChips {
  readonly element=document.createElement('div');
  constructor(root: HTMLElement, private placement: Placement) {
    this.element.className='lock-controls';this.element.dataset.overlay='';this.element.setAttribute('aria-label','Placement constraints');
    this.element.innerHTML=`<button class="lock-chip axis-chip" aria-label="Toggle axis lock" title="Axis lock (hold Shift)" aria-pressed="false">Axis <kbd>Shift</kbd></button><div class="layer-control"><button class="lock-chip layer-chip" aria-label="Toggle layer lock" title="Layer lock (L)" aria-pressed="false">Layer <kbd>L</kbd></button><button class="layer-step" data-layer="1" aria-label="Raise locked layer" title="Raise layer (PageUp)">▲</button><button class="layer-step" data-layer="-1" aria-label="Lower locked layer" title="Lower layer (PageDown)">▼</button></div>`;
    root.append(this.element);
    this.element.querySelector('.axis-chip')!.addEventListener('click',()=>placement.toggleAxis());
    this.element.querySelector('.layer-chip')!.addEventListener('click',()=>placement.toggleLayer());
    this.element.querySelectorAll<HTMLButtonElement>('[data-layer]').forEach(button=>button.addEventListener('click',()=>placement.stepLayer(Number(button.dataset.layer))));
    this.element.addEventListener('wheel',e=>e.stopPropagation(),{passive:true});this.refresh();
  }
  refresh() {
    this.element.hidden=!this.placement.selected||this.placement.erasing;
    const {locks}=this.placement,axis=this.element.querySelector('.axis-chip')!,layer=this.element.querySelector('.layer-chip')!;
    axis.setAttribute('aria-pressed',String(locks.axisActive));axis.setAttribute('data-axis',locks.axis??'pending');
    axis.innerHTML=locks.axisActive?`Axis lock ${locks.axis?.toUpperCase()??'…'}`:'Axis <kbd>Shift</kbd>';
    layer.setAttribute('aria-pressed',String(locks.layer!==null));layer.innerHTML=locks.layer===null?'Layer <kbd>L</kbd>':`Layer ${locks.layer}`;
  }
}
