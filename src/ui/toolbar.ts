import { icon } from './icons';
import { Popover } from './popover';

export class Toolbar {
  readonly clearButton: HTMLButtonElement;
  readonly settingsButton: HTMLButtonElement;
  readonly clearPopover: Popover;
  private helpButton: HTMLButtonElement;
  private count=0;
  constructor(root: HTMLElement, private rail: HTMLElement, clear: ()=>void, help: ()=>void) {
    this.clearButton=this.button('trash','Clear build');this.clearButton.classList.add('danger');
    this.settingsButton=this.button('settings','Settings');this.helpButton=this.button('help','Open controls');
    rail.append(this.clearButton,this.helpButton);this.helpButton.addEventListener('click',help);
    this.clearPopover=new Popover(root,this.clearButton,'Clear build','clear-popover');
    this.clearPopover.content.innerHTML=`<p class="clear-question"></p><div class="inline-actions"><button class="cancel-clear">Cancel</button><button class="confirm-clear danger">Clear</button></div>`;
    this.clearPopover.content.querySelector('.cancel-clear')!.addEventListener('click',()=>this.clearPopover.close());
    this.clearPopover.content.querySelector('.confirm-clear')!.addEventListener('click',()=>{this.clearPopover.close();clear();});
    this.clearButton.addEventListener('click',()=>this.confirmClear());
    this.clearPopover.onToggle=open=>{if(open)this.position(root);};
    new ResizeObserver(()=>{if(this.clearPopover.open)this.position(root);}).observe(root);
    this.refresh(0);
  }
  private button(name: string,label: string) {
    const button=document.createElement('button');button.type='button';button.className='tool-button';button.setAttribute('aria-label',label);button.title=label;button.innerHTML=icon(name,20);return button;
  }
  mountSettings() {this.rail.insertBefore(this.settingsButton,this.helpButton);}
  confirmClear() {
    if(!this.count)return;
    this.clearPopover.content.querySelector('.clear-question')!.textContent=`Clear all ${this.count.toLocaleString()} ${this.count===1?'brick':'bricks'}?`;
    this.clearPopover.toggle();
  }
  refresh(count: number) {this.count=count;this.clearButton.disabled=count===0;}
  private position(root: HTMLElement) {
    const button=this.clearButton.getBoundingClientRect(),bounds=root.getBoundingClientRect();
    this.clearPopover.element.style.left=`${Math.max(10,Math.min(button.left-bounds.left,root.clientWidth-270))}px`;
    this.clearPopover.element.style.bottom=`${bounds.bottom-button.top+10}px`;
  }
}
