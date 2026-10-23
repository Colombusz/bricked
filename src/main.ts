import './style.css';
import './ui.css';
import './ui/workspace.css';
import './ui/colorPanel/styles.css';
import './ui/settings.css';
import { createWorld } from './scene';
import { CameraController } from './cameraController';
import { Grid } from './grid';
import { BrickRenderer } from './bricks/renderer';
import { Placement } from './placement';
import { Carousel } from './ui/carousel';
import { HUD } from './ui/hud';
import { Fullscreen } from './fullscreen';
import { History } from './history';
import { BrickAudio } from './audio';
import { exportBuild, loadBuild, parseBuild, saveBuild } from './persistence';
import { starterBuild, stressBuild } from './starter';
import { CONFIG } from './config';
import { isEditing } from './input';
import { ColorPanel } from './ui/colorPanel';
import { PaletteStore } from './ui/colorPanel/paletteStore';
import { Popover } from './ui/popover';
import { ConstraintChips } from './ui/constraints';
import { Toolbar } from './ui/toolbar';
import { SettingsStore } from './settingsStore';
import { SettingsPanel } from './ui/settings';

function start() {
  const root = document.querySelector<HTMLElement>('#app')!;
  const world = createWorld(root);
  const canvas = world.renderer.domElement;
  const controls = new CameraController(world.camera, canvas);
  const grid = new Grid();
  const bricks = new BrickRenderer(world.scene);
  const placement = new Placement(grid, world.scene, world.camera, canvas);
  const history = new History(grid);
  const audio = new BrickAudio();
  const settings = new SettingsStore();
  controls.settings=settings.value;placement.allowFloating=settings.value.allowFloating;audio.muted=!settings.value.sound;
  let projectName = 'The little house';
  let storageError = '';
  let skippedPieces=0;
  try {
    const saved = loadBuild();
    if (saved) { grid.replace(saved.bricks); projectName = saved.name;skippedPieces=saved.skipped??0; }
    else grid.replace(starterBuild());
  } catch { grid.replace(starterBuild()); storageError = 'Could not restore the saved build. You can still build and save a file.'; }
  bricks.sync(grid.bricks.values());
  let dirty = true;
  const metrics = {lastClearMs:0};
  const palettes = new PaletteStore();
  placement.setColor(palettes.selectedColor);
  const colorPanel = new ColorPanel(root, palettes);
  const constraintChips = new ConstraintChips(root, placement);
  palettes.subscribe(() => { placement.setColor(palettes.selectedColor); dirty = true; });
  let saveTimer = 0;
  const carousel = new Carousel(placement); root.append(carousel.element);
  const refreshTools = () => { carousel.refresh(); hud.setTools(placement.erasing, history.canUndo, history.canRedo); dirty = true; };
  const persist = () => {
    hud.setSaveState('Saving…'); clearTimeout(saveTimer);
    saveTimer = window.setTimeout(() => {
      try { saveBuild(projectName,grid.snapshot()); hud.setSaveState('Saved locally'); }
      catch { hud.setSaveState('Not saved'); hud.toast('Browser storage is unavailable. Use Save build to keep a file.',true); }
    },300);
  };
  const setTool = (erasing: boolean) => {
    placement.erasing = erasing;
    if(erasing)placement.locks.clear();
    if (!erasing && !placement.selected) placement.select('bricks-2x4');
    placement.update(); canvas.classList.toggle('erasing',erasing); refreshTools();
  };
  const clearBuild = () => {
    const start=performance.now();history.clear();metrics.lastClearMs=performance.now()-start;
    hud.toast('Build cleared',false,{duration:CONFIG.clearToastDuration,actionLabel:'Undo',onAction:()=>history.undo()});
  };
  const hud = new HUD(root, {
    tool: () => setTool(false), erase: () => setTool(true), rotate: () => { placement.rotate(); dirty = true; },
    frame: () => controls.frame(grid.bounds()), undo: () => history.undo(), redo: () => history.redo(),
    mute: () => settings.set('sound',!settings.value.sound),
    floating: value => settings.set('allowFloating',value),
    save: () => { exportBuild(projectName,grid.snapshot()); hud.toast('Build saved as a JSON file.'); },
    import: async file => {
      try {
        if(file.size>5_000_000)throw new Error('Choose a build file under 5 MB.');
        const imported=parseBuild(await file.text()); projectName=imported.name;
        history.replace(imported.bricks); controls.frame(grid.bounds()); hud.toast(imported.skipped?`${imported.skipped} pieces skipped`:'Your build is ready.');
      } catch(error) { hud.toast(error instanceof Error?error.message:'Could not open this build.',true); }
    },
    clear: clearBuild,
    starter: () => { projectName='The little house'; history.replace(starterBuild()); controls.frame(); hud.toast('A little inspiration. Every piece is yours to change.'); },
    rename: name => { projectName=name; hud.setProject(projectName,grid.bricks.size); persist(); },
  });
  hud.setProject(projectName,grid.bricks.size); hud.setSound(audio.muted);
  const toolbar = new Toolbar(root,hud.element.querySelector('.tool-rail')!,clearBuild,()=>hud.showHelp());
  toolbar.refresh(grid.bricks.size);hud.onClear=()=>toolbar.confirmClear();
  toolbar.mountSettings();
  constraintChips.mountRotate(hud.element.querySelector<HTMLButtonElement>('[data-action="rotate"]')!);
  const settingsPanel = new SettingsPanel(root,toolbar.settingsButton,settings);
  settings.subscribe(value=>{controls.settings=value;placement.allowFloating=value.allowFloating;audio.muted=!value.sound;hud.setSound(audio.muted);placement.update();dirty=true;});
  hud.element.dataset.overlay = '';
  const frameArea = () => {
    const style=getComputedStyle(root),safe=(side:string)=>parseFloat(style.getPropertyValue(`--safe-${side}`))||0;
    controls.setViewportInsets(root.classList.contains('ui-hidden') ? {top:0,right:0,bottom:0,left:0} : {top:(carousel.collapsed?60:80)+safe('top'),right:76+safe('right'),bottom:(root.clientWidth<=CONFIG.compactPhoneWidth?CONFIG.compactPhoneFrameInset:root.clientWidth<750?180:100)+safe('bottom'),left:16+safe('left')});
  };
  if(storageError)hud.toast(storageError,true);else if(skippedPieces)hud.toast(`${skippedPieces} pieces skipped`);
  const fullscreen = new Fullscreen(root,hud.fullscreenButton,() => { world.resize(); frameArea(); dirty=true; });
  const changed = (kind: 'update' | 'clear' = 'update') => {
    if(kind==='clear')bricks.clear();else bricks.sync(grid.bricks.values()); placement.update();
    world.renderer.shadowMap.needsUpdate=true; dirty=true;
    hud.setProject(projectName,grid.bricks.size); refreshTools(); persist();
    toolbar.refresh(grid.bricks.size);
  };
  history.onChange=changed;
  const syncInteraction=() => { placement.blocked=controls.navigating||Boolean(document.querySelector('dialog[open]')); placement.update(); dirty=true; };
  controls.onChange=syncInteraction;
  const modalObserver=new MutationObserver(syncInteraction);
  hud.element.querySelectorAll('dialog').forEach(dialog=>modalObserver.observe(dialog,{attributes:true,attributeFilter:['open']}));
  placement.onChange=() => { constraintChips.refresh(); dirty=true; };
  carousel.onChange=() => { canvas.classList.toggle('erasing',placement.erasing); refreshTools(); frameArea(); };
  hud.element.querySelectorAll<HTMLButtonElement>('[data-axis]').forEach(button=>button.addEventListener('click',()=>controls.snapAxis(button.dataset.axis as 'x'|'y'|'z')));

  let press: { id:number; x:number; y:number; distance:number; cancelled:boolean } | null = null;
  canvas.addEventListener('pointerdown', e => {
    if (press) { press.cancelled=true; return; }
    press={id:e.pointerId,x:e.clientX,y:e.clientY,distance:0,cancelled:e.button!==0||e.altKey||controls.flying};
    const rect=canvas.getBoundingClientRect(); placement.setPointer((e.clientX-rect.left)/rect.width,(e.clientY-rect.top)/rect.height);
    canvas.focus({preventScroll:true});
  });
  window.addEventListener('pointermove',e=>{if(press&&e.pointerId===press.id)press.distance=Math.max(press.distance,Math.hypot(e.clientX-press.x,e.clientY-press.y));});
  window.addEventListener('pointerup', e => {
    if(!press||e.pointerId!==press.id)return;
    const tap=!press.cancelled&&press.distance<CONFIG.tapDistance&&e.target===canvas;
    press=null;
    if(!tap||controls.navigating||document.querySelector('dialog[open]'))return;
    placement.blocked=false;
    const rect=canvas.getBoundingClientRect(); placement.setPointer((e.clientX-rect.left)/rect.width,(e.clientY-rect.top)/rect.height);
    if(placement.erasing) {
      if(placement.hit?.brick) { history.delete(placement.hit.brick.id); audio.click(); }
      return;
    }
    const brick=placement.commit();
    if(brick&&history.place(brick)) { palettes.recordUsed(brick.color); bricks.animate(brick.id); audio.click(); dirty=true; }
  });
  window.addEventListener('pointercancel',()=>{press=null;});
  window.addEventListener('blur',()=>{press=null;});
  window.addEventListener('keyup',e=>{if(e.code==='ShiftLeft'||e.code==='ShiftRight')placement.holdAxis(false);});
  window.addEventListener('blur',()=>placement.holdAxis(false));
  window.addEventListener('keydown', e => {
    const target=e.target as HTMLElement;
    if(isEditing(target))return;
    if(document.querySelector('dialog[open]'))return;
    const modifier=e.ctrlKey||e.metaKey;
    if(modifier&&e.code==='KeyZ') { e.preventDefault(); if(e.shiftKey)history.redo();else history.undo();return; }
    if(modifier&&e.code==='KeyY') { e.preventDefault(); history.redo();return; }
    if(modifier&&e.code==='KeyS') { e.preventDefault();exportBuild(projectName,grid.snapshot());return; }
    if(modifier&&e.shiftKey&&e.code==='KeyB') { e.preventDefault(); history.replace(stressBuild()); controls.frame(); hud.toast('1,000 pieces, ready for a stress test.');return; }
    if(controls.flying||modifier)return;
    if((e.code==='ShiftLeft'||e.code==='ShiftRight')&&!e.repeat)placement.holdAxis(true);
    if(e.code==='KeyL'&&!e.repeat)placement.toggleLayer();
    if((e.code==='KeyQ'||e.code==='KeyE')&&placement.selected&&!placement.erasing){e.preventDefault();if(!e.repeat)placement.stepLayer(e.code==='KeyE'?1:-1);}
    if(e.code==='KeyR'&&!e.repeat)placement.rotate();
    if(e.code==='KeyM'&&!e.repeat)placement.toggleMirror();
    if(e.code==='KeyF')controls.frame(grid.bounds());
    if(e.code==='KeyH'&&!e.repeat) { Popover.closeAll(); root.classList.toggle('ui-hidden'); frameArea(); if(root.classList.contains('ui-hidden'))hud.toast('UI hidden, press H'); }
    if(/^Digit[1-9]$/.test(e.code))colorPanel.selectIndex(Number(e.code.slice(-1))-1);
    if(e.code==='KeyB')setTool(false);
    if(e.code==='KeyX'||e.code==='Delete'||e.code==='Backspace') {
      e.preventDefault();
      if(placement.active&&placement.hit?.brick) { history.delete(placement.hit.brick.id);audio.click(); }
      else if(e.code==='KeyX')setTool(!placement.erasing);
    }
    if(e.code==='BracketLeft') { e.preventDefault();carousel.step(-1); }
    if(e.code==='BracketRight') { e.preventDefault();carousel.step(1); }
    if(e.key==='?')hud.showHelp();
    if(e.key==='Escape') { placement.select(null);refreshTools(); }
    dirty=true;
  });
  let previous=performance.now();
  function loop(now:number) {
    const dt=Math.min((now-previous)/1000,0.05);previous=now;
    if(controls.update(dt)) { placement.update();dirty=true; }
    if(bricks.update(now)) { dirty=true;world.renderer.shadowMap.needsUpdate=true; }
    if(dirty) {
      world.updateGround();
      constraintChips.refresh();
      hud.setPlacement(placement.reason,placement.ghost.visible&&!placement.valid);
      world.renderer.render(world.scene,world.camera);dirty=false;
    }
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
  const resize=()=>{world.resize();frameArea();dirty=true;};
  new ResizeObserver(resize).observe(root);
  window.addEventListener('resize',resize);
  document.addEventListener('visibilitychange',()=>{previous=performance.now();dirty=true;});
  window.addEventListener('pagehide',()=>{try{saveBuild(projectName,grid.snapshot());}catch{/* JSON export remains available. */}});
  document.querySelector('#loading')?.remove();
  if(!storageError)persist();
  // Kept off the interface: useful for placement checks and repeatable performance captures.
  Object.assign(window,{__bricked:{world,controls,grid,bricks,placement,history,carousel,fullscreen,audio,hud,palettes,colorPanel,constraintChips,toolbar,settings,settingsPanel,metrics,stress:(count=1000)=>{history.replace(stressBuild(count));controls.frame();}}});
  hud.showHelp();
}

try { start(); }
catch(error) {
  const loading=document.querySelector('#loading');
  if(loading)loading.textContent='The 3D playground could not start. Enable WebGL in your browser and reload.';
  console.error(error);
}
