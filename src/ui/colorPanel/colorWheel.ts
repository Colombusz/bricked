import { normalizeHex } from './paletteStore';

export interface HSV { h: number; s: number; v: number }
export function hsvToHex({h,s,v}: HSV) {
  const c=v*s, x=c*(1-Math.abs(((h/60)%2)-1)), m=v-c;
  const values=h<60?[c,x,0]:h<120?[x,c,0]:h<180?[0,c,x]:h<240?[0,x,c]:h<300?[x,0,c]:[c,0,x];
  return `#${values.map(n=>Math.round((n+m)*255).toString(16).padStart(2,'0')).join('')}`;
}
export function hexToHSV(hex: string): HSV {
  const [r,g,b]=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255), max=Math.max(r,g,b), min=Math.min(r,g,b), d=max-min;
  let h=0;
  if (d) h=max===r?60*(((g-b)/d)%6):max===g?60*((b-r)/d+2):60*((r-g)/d+4);
  return {h:(h+360)%360,s:max?d/max:0,v:max};
}
export class ColorWheel {
  readonly element=document.createElement('div');
  private hsv: HSV;
  private color: string;
  private canvas: HTMLCanvasElement;
  private handle: HTMLElement;
  private brightness: HTMLInputElement;
  private hex: HTMLInputElement;
  private preview: HTMLElement;
  onColor = (_color: string) => {};
  constructor(color: string) {
    this.color=color; this.hsv=hexToHSV(color); this.element.className='color-wheel';
    this.element.innerHTML=`<div class="wheel-disc"><canvas width="384" height="384" tabindex="0" role="slider" aria-label="Hue and saturation" aria-valuemin="0" aria-valuemax="360"></canvas><span class="wheel-darken"></span><span class="wheel-handle"></span></div>
      <label class="brightness-label">Brightness <output></output><input type="range" min="0" max="100" step="1" aria-label="Brightness"></label>
      <div class="hex-row"><label for="custom-hex">Hex</label><input id="custom-hex" maxlength="7" spellcheck="false" autocomplete="off" aria-label="Hex color"><span class="color-preview" aria-label="Color preview"></span></div><p class="hex-error" role="status" hidden>Use a hex color like #247bc0.</p>`;
    this.canvas=this.element.querySelector('canvas')!; this.handle=this.element.querySelector('.wheel-handle')!;
    this.brightness=this.element.querySelector('[type="range"]')!;this.hex=this.element.querySelector('#custom-hex')!;this.preview=this.element.querySelector('.color-preview')!;
    this.draw();this.render();
    let dragging=false;
    const move=(e: PointerEvent) => {
      const rect=this.canvas.getBoundingClientRect(), dx=(e.clientX-rect.left)/rect.width*2-1, dy=(e.clientY-rect.top)/rect.height*2-1;
      this.hsv.h=(Math.atan2(dy,dx)*180/Math.PI+360)%360;this.hsv.s=Math.min(1,Math.hypot(dx,dy));this.emit();
    };
    this.canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();this.canvas.focus();dragging=true;this.canvas.setPointerCapture(e.pointerId);move(e);});
    this.canvas.addEventListener('pointermove',e=>{if(dragging)move(e);});
    this.canvas.addEventListener('pointerup',()=>{dragging=false;});this.canvas.addEventListener('pointercancel',()=>{dragging=false;});
    this.canvas.addEventListener('keydown',e=>{
      if (!['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)) return;
      e.preventDefault();e.stopPropagation();
      let x=Math.cos(this.hsv.h*Math.PI/180)*this.hsv.s, y=Math.sin(this.hsv.h*Math.PI/180)*this.hsv.s;
      const nudge=e.shiftKey?0.08:0.02;
      if(e.key==='ArrowRight')x+=nudge;if(e.key==='ArrowLeft')x-=nudge;if(e.key==='ArrowDown')y+=nudge;if(e.key==='ArrowUp')y-=nudge;
      this.hsv.h=(Math.atan2(y,x)*180/Math.PI+360)%360;this.hsv.s=Math.min(1,Math.hypot(x,y));this.emit();
    });
    this.brightness.addEventListener('input',()=>{this.hsv.v=Number(this.brightness.value)/100;this.emit();});
    this.hex.addEventListener('input',()=>{
      const color=normalizeHex(this.hex.value);this.hex.setAttribute('aria-invalid',String(!color));
      this.element.querySelector<HTMLElement>('.hex-error')!.hidden=Boolean(color);
      if(color){this.color=color;this.hsv=hexToHSV(color);this.render(false);this.onColor(color);}
    });
    this.hex.addEventListener('blur',()=>{if(normalizeHex(this.hex.value))this.hex.value=this.color;});
  }
  setColor(color: string) {if(color===this.color)return;this.color=color;this.hsv=hexToHSV(color);this.render(document.activeElement!==this.hex);}
  private emit() {this.color=hsvToHex(this.hsv);this.render();this.onColor(this.color);}
  private render(updateHex=true) {
    const radians=this.hsv.h*Math.PI/180;
    this.handle.style.left=`${50+Math.cos(radians)*this.hsv.s*50}%`;this.handle.style.top=`${50+Math.sin(radians)*this.hsv.s*50}%`;
    this.element.querySelector<HTMLElement>('.wheel-darken')!.style.opacity=String(1-this.hsv.v);
    this.brightness.value=String(Math.round(this.hsv.v*100));this.brightness.style.background=`linear-gradient(to right, #000, ${hsvToHex({...this.hsv,v:1})})`;
    this.element.querySelector('output')!.textContent=`${Math.round(this.hsv.v*100)}%`;
    this.preview.style.background=this.color;if(updateHex)this.hex.value=this.color;
    this.canvas.setAttribute('aria-valuenow',String(Math.round(this.hsv.h)));
    this.canvas.setAttribute('aria-valuetext',`Hue ${Math.round(this.hsv.h)} degrees, saturation ${Math.round(this.hsv.s*100)} percent, ${this.color}`);
  }
  private draw() {
    const context=this.canvas.getContext('2d')!, n=this.canvas.width, image=context.createImageData(n,n), radius=n/2;
    for(let y=0;y<n;y++)for(let x=0;x<n;x++){
      const dx=(x-radius)/radius,dy=(y-radius)/radius,s=Math.hypot(dx,dy);if(s>1)continue;
      const hex=hsvToHex({h:(Math.atan2(dy,dx)*180/Math.PI+360)%360,s,v:1}), i=(y*n+x)*4;
      image.data[i]=parseInt(hex.slice(1,3),16);image.data[i+1]=parseInt(hex.slice(3,5),16);image.data[i+2]=parseInt(hex.slice(5,7),16);image.data[i+3]=255;
    }
    context.putImageData(image,0,0);
  }
}
