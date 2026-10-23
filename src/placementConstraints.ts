import { CONFIG } from './config';
import { dimensions, type Brick } from './bricks/catalog';
import { snapWithHysteresis } from './snapping';

type Anchor = Pick<Brick, 'x' | 'y' | 'z'>;
export class PlacementConstraints {
  axisHeld = false;
  axisToggled = false;
  axis: 'x' | 'z' | null = null;
  anchor: Anchor | null = null;
  layer: number | null = null;
  get axisActive() { return this.axisHeld || this.axisToggled; }
  get planeLayer() { return this.layer ?? (this.axisActive ? this.anchor?.y : null) ?? null; }
  holdAxis(held: boolean, candidate: Brick | null) {
    const wasActive=this.axisActive; this.axisHeld=held;
    if (!wasActive && this.axisActive) this.start(candidate);
    if (!this.axisActive) { this.anchor=null; this.axis=null; }
  }
  toggleAxis(candidate: Brick | null) {
    const wasActive=this.axisActive;this.axisToggled=!this.axisToggled;
    if(!wasActive&&this.axisActive)this.start(candidate);
    if(!this.axisActive){this.anchor=null;this.axis=null;}
  }
  private start(candidate: Brick | null) { this.anchor=candidate ? {x:candidate.x,y:candidate.y,z:candidate.z} : null;this.axis=null; }
  capture(candidate: Brick) { if(this.axisActive&&!this.anchor)this.start(candidate); }
  toggleLayer(candidate: Brick | null) { this.layer=this.layer===null?(candidate?.y??0):null; }
  stepLayer(direction: number, template: Brick) {
    const height=dimensions(template).height;
    this.layer=Math.max(0,Math.min(CONFIG.maxBuildHeight-height,(this.layer??template.y)+direction*height));
    if(this.anchor)this.anchor.y=this.layer;
  }
  clampHeight(height: number) {
    if(this.layer!==null)this.layer=Math.min(this.layer,CONFIG.maxBuildHeight-height);
    if(this.anchor)this.anchor.y=Math.min(this.anchor.y,CONFIG.maxBuildHeight-height);
  }
  apply(template: Brick, rawX: number, rawZ: number, previous?: Brick): Brick {
    let x=snapWithHysteresis(rawX,previous?.x),z=snapWithHysteresis(rawZ,previous?.z);
    if(this.axisActive&&this.anchor){
      const dx=rawX-this.anchor.x,dz=rawZ-this.anchor.z;
      if(!this.axis&&Math.max(Math.abs(dx),Math.abs(dz))>=CONFIG.axisLockThreshold)this.axis=Math.abs(dx)>=Math.abs(dz)?'x':'z';
      if(this.axis==='x')z=this.anchor.z;
      else if(this.axis==='z')x=this.anchor.x;
      else {x=this.anchor.x;z=this.anchor.z;}
    }
    return {...template,x,z,y:this.planeLayer??template.y};
  }
  clear() {this.axisHeld=false;this.axisToggled=false;this.axis=null;this.anchor=null;this.layer=null;}
}
