import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile,rm} from 'node:fs/promises';
import {revisionServer} from './devServer.mjs';
const stage=process.argv[2]||'all';
const server=await revisionServer();
const browser=await chromium.launch({executablePath:chromium.executablePath(),args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:0.7,acceptDownloads:true});
const page=await context.newPage(),errors=[],results=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())});
await mkdir('test-results',{recursive:true});
async function check(name,fn){await fn();results.push({name,status:'PASS'});console.log('PASS',name);}
async function ready(){await page.goto(server.url,{waitUntil:'domcontentloaded',timeout:60000});await page.waitForFunction(()=>window.__bricked,null,{timeout:60000});}
async function hover(x,y,z){const p=await page.evaluate(([x,y,z])=>{const c=window.__bricked.world.camera,p=c.position.clone().set(x,y,z).project(c);return{x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2}},[x,y,z]);await page.mouse.move(p.x,p.y);return p;}
try {
await ready();
if(stage==='1'||stage==='all'){
 await check('Slim carousel: stable size, 2x thumbnails, selection and deselection',async()=>{
  const before=await page.locator('.parts-tray').boundingBox();assert.ok(before.height<=72);assert.equal(Math.round(before.y),8);
  const part=page.getByRole('button',{name:'Brick 2×3',exact:true});await part.click();const after=await page.locator('.parts-tray').boundingBox();assert.equal(before.height,after.height);
  assert.ok(await part.locator('img').evaluate(e=>e.naturalWidth>=328));await part.click();assert.equal(await page.evaluate(()=>window.__bricked.placement.selected),null);await part.click();
 });
 await check('Collapse retains armed part, persists, and expands',async()=>{
  await page.getByRole('button',{name:'Collapse parts',exact:true}).click();assert.equal(await page.evaluate(()=>window.__bricked.placement.selected),'bricks-2x3');await ready();assert.ok(await page.getByRole('button',{name:'Expand parts',exact:true}).isVisible());await page.getByRole('button',{name:'Expand parts',exact:true}).click();
 });
 await check('Wheel, arrows, shortcuts, phone strip and UI hiding',async()=>{
  await page.keyboard.press(']');const selected=await page.evaluate(()=>window.__bricked.placement.selected);await page.keyboard.press('[');assert.notEqual(await page.evaluate(()=>window.__bricked.placement.selected),selected);
  await page.setViewportSize({width:600,height:850});const list=page.locator('.parts-list');await list.evaluate(e=>e.scrollLeft=0);await list.hover();await page.mouse.wheel(0,180);await page.waitForTimeout(400);assert.ok(await list.evaluate(e=>e.scrollLeft)>0);await page.getByRole('button',{name:'Next part',exact:true}).click();
  await page.setViewportSize({width:390,height:844});assert.ok((await page.locator('.parts-tray').boundingBox()).height<=56);await page.keyboard.press('h');assert.ok(await page.locator('#app').evaluate(e=>e.classList.contains('ui-hidden')));assert.ok(await page.getByRole('button',{name:'Enter fullscreen',exact:true}).isVisible());await page.keyboard.press('h');await page.setViewportSize({width:1440,height:1000});
 });
 await check('Frame uses clear viewport center',async()=>{
  await page.keyboard.press('f');await page.waitForFunction(()=>window.__bricked.world.camera.position.distanceTo(window.__bricked.controls.targetPosition)<0.02);
  const p=await page.evaluate(()=>{const {world,grid}=window.__bricked;const p=grid.bounds().getCenter(world.camera.position.clone()).project(world.camera);return{x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2}});
  assert.ok(Math.abs(p.x-690)<2);assert.ok(Math.abs(p.y-490)<2);
 });
 await page.screenshot({path:'test-results/revision-layout.png'});
}
if(stage==='3a'||stage==='all'){
 if(stage==='all')await ready();
 await check('All camera controls work identically with a part armed or disarmed',async()=>{
  const startCount=await page.evaluate(()=>window.__bricked.grid.bricks.size);
  for(const armed of [false,true]){
   await page.evaluate(armed=>window.__bricked.placement.select(armed?'bricks-2x4':null),armed);
   const before=await page.evaluate(()=>window.__bricked.controls.targetPosition.toArray());
   await page.mouse.move(700,500);await page.keyboard.down('Alt');await page.mouse.down();await page.mouse.move(740,520,{steps:4});assert.equal(await page.evaluate(()=>window.__bricked.placement.ghost.visible),false);await page.mouse.up();await page.keyboard.up('Alt');
   assert.notDeepEqual(await page.evaluate(()=>window.__bricked.controls.targetPosition.toArray()),before);
   const pivot=await page.evaluate(()=>window.__bricked.controls.pivot.toArray());await page.mouse.down({button:'middle'});await page.mouse.move(760,530,{steps:3});assert.equal(await page.evaluate(()=>window.__bricked.placement.ghost.visible),false);await page.mouse.up({button:'middle'});assert.notDeepEqual(await page.evaluate(()=>window.__bricked.controls.pivot.toArray()),pivot);
   const distance=await page.evaluate(()=>window.__bricked.controls.targetPosition.distanceTo(window.__bricked.controls.pivot));await page.mouse.wheel(0,-80);assert.ok(await page.evaluate(()=>window.__bricked.controls.targetPosition.distanceTo(window.__bricked.controls.pivot))<distance);
   await page.mouse.down({button:'right'});await page.mouse.move(780,535,{steps:3});assert.equal(await page.evaluate(()=>window.__bricked.controls.flying),true);assert.equal(await page.evaluate(()=>window.__bricked.placement.ghost.visible),false);
   for(const key of ['w','a','s','d','q','e']){const p=await page.evaluate(()=>window.__bricked.controls.targetPosition.toArray());await page.keyboard.down(key);await page.waitForFunction(before=>window.__bricked.controls.targetPosition.toArray().some((v,i)=>Math.abs(v-before[i])>.001),p);await page.keyboard.up(key);}
   await page.keyboard.down('Shift');await page.keyboard.down('w');await page.mouse.wheel(0,-30);await page.waitForTimeout(100);await page.keyboard.up('w');await page.keyboard.up('Shift');await page.mouse.up({button:'right'});await page.keyboard.press('f');
  }
  assert.equal(await page.evaluate(()=>window.__bricked.grid.bricks.size),startCount);
 });
}
if(stage==='3b'||stage==='all'){
 if(stage==='all')await ready();
 await check('Shift axis lock picks X, stays level, draws guide and releases',async()=>{
  await page.evaluate(()=>{window.__bricked.history.replace([]);window.__bricked.placement.select('bricks-2x4')});
  await hover(-4,0,4);const anchor=await page.evaluate(()=>({...window.__bricked.placement.candidate}));await page.keyboard.down('Shift');
  await hover(anchor.x+1-16+3,0,anchor.z+2-16+0.2);
  const locked=await page.evaluate(()=>({candidate:window.__bricked.placement.candidate,axis:window.__bricked.placement.locks.axis,guide:window.__bricked.placement.guide.visible}));
  assert.equal(locked.axis,'x');assert.equal(locked.candidate.z,anchor.z);assert.equal(locked.candidate.y,anchor.y);assert.ok(locked.guide);assert.match(await page.locator('.axis-chip').innerText(),/Axis lock X/);
  await page.keyboard.up('Shift');assert.equal(await page.evaluate(()=>window.__bricked.placement.locks.axisActive),false);
 });
 await check('Layer lock prevents auto-lift, retains red collisions and changes by part height',async()=>{
  await hover(-4,0,4);await page.keyboard.press('l');
  await page.evaluate(()=>{const {history}=window.__bricked;for(let y=0;y<=6;y+=3)history.place({id:'tower-'+y,type:'bricks-2x4',color:'#247bc0',rotation:0,x:20,y,z:20})});
  const p=await hover(21-16,0,22-16);
  assert.equal(await page.evaluate(()=>window.__bricked.placement.candidate.y),0);assert.equal(await page.evaluate(()=>window.__bricked.placement.valid),false);
  const before=await page.evaluate(()=>window.__bricked.grid.bricks.size);await page.mouse.click(p.x,p.y);assert.equal(await page.evaluate(()=>window.__bricked.grid.bricks.size),before);
  await page.keyboard.press('PageUp');assert.equal(await page.evaluate(()=>window.__bricked.placement.locks.layer),3);await page.keyboard.press('PageDown');assert.equal(await page.evaluate(()=>window.__bricked.placement.locks.layer),0);
  await page.getByRole('tab',{name:'Plates',exact:true}).click();assert.equal(await page.evaluate(()=>window.__bricked.placement.locks.layer),0);await page.getByRole('button',{name:'Raise locked layer',exact:true}).click();assert.equal(await page.evaluate(()=>window.__bricked.placement.locks.layer),1);
 });
 await check('Touch chips keep locks across type/color switches; deselection clears both',async()=>{
  await page.locator('.axis-chip').click();assert.equal(await page.evaluate(()=>window.__bricked.placement.locks.axisActive),true);
  await page.keyboard.press('2');assert.equal(await page.evaluate(()=>window.__bricked.placement.locks.layer),1);await page.getByRole('tab',{name:'Bricks',exact:true}).click();assert.equal(await page.evaluate(()=>window.__bricked.placement.locks.axisActive),true);
  await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>window.__bricked.placement.locks.layer),null);assert.equal(await page.evaluate(()=>window.__bricked.placement.locks.axisActive),false);assert.equal(await page.locator('.lock-controls').isVisible(),false);
  await page.keyboard.press('l');assert.equal(await page.evaluate(()=>window.__bricked.placement.locks.layer),null);
 });
}
if(stage==='4'||stage==='all'){
 if(stage==='all')await ready();
 await check('Clear confirmation is anchored, cancellable, and disables the empty-build button',async()=>{
  const before=await page.evaluate(()=>window.__bricked.grid.bricks.size);await page.getByRole('button',{name:'Clear build',exact:true}).click();assert.match(await page.locator('.clear-question').innerText(),new RegExp(String(before)));await page.locator('.cancel-clear').click();assert.equal(await page.evaluate(()=>window.__bricked.grid.bricks.size),before);
  await page.getByRole('button',{name:'Clear build',exact:true}).click();await page.locator('.confirm-clear').click();assert.equal(await page.evaluate(()=>window.__bricked.grid.bricks.size),0);assert.equal(await page.evaluate(()=>window.__bricked.grid.occupancy.size),0);assert.ok(await page.getByRole('button',{name:'Clear build',exact:true}).isDisabled());assert.match(await page.locator('.toast').innerText(),/Build cleared.*Undo/);
  await page.getByRole('button',{name:'Undo clear build',exact:true}).click();assert.equal(await page.evaluate(()=>window.__bricked.grid.bricks.size),before);
 });
 await check('1,000-brick clear is batched under 100 ms; one undo restores it without changing palettes or camera',async()=>{
  await page.evaluate(()=>{window.__bricked.world.renderer.setPixelRatio(.25);window.__bricked.stress(1000)});
  const before=await page.evaluate(()=>({palette:window.__bricked.palettes.active.id,color:window.__bricked.palettes.selectedColor,camera:window.__bricked.controls.targetPosition.toArray()}));
  await page.getByRole('button',{name:'Enter fullscreen',exact:true}).click();await page.getByRole('button',{name:'Clear build',exact:true}).click();assert.ok(await page.locator('.clear-popover').evaluate(e=>document.fullscreenElement.contains(e)));await page.locator('.confirm-clear').click();
  const result=await page.evaluate(()=>({count:window.__bricked.grid.bricks.size,ms:window.__bricked.metrics.lastClearMs,palette:window.__bricked.palettes.active.id,color:window.__bricked.palettes.selectedColor,camera:window.__bricked.controls.targetPosition.toArray()}));
  assert.equal(result.count,0);assert.ok(result.ms<100,`${result.ms}ms`);assert.equal(result.palette,before.palette);assert.equal(result.color,before.color);assert.deepEqual(result.camera,before.camera);
  await page.waitForTimeout(500);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('bricked.build.v1')).bricks.length),0);
  await page.keyboard.press('Control+z');assert.equal(await page.evaluate(()=>window.__bricked.grid.bricks.size),1000);await page.keyboard.press('Control+Shift+z');assert.equal(await page.evaluate(()=>window.__bricked.grid.bricks.size),0);await page.getByRole('button',{name:'Exit fullscreen',exact:true}).click();
  results.push({name:'Measured clear duration',milliseconds:result.ms});
 });
}
if(stage==='5'||stage==='all'){
 if(stage==='all')await ready();
 await check('Sensitivity slider is live, persistent and suppresses focused hotkeys',async()=>{
  await page.getByRole('button',{name:'Settings',exact:true}).click();
  const slider=page.getByRole('slider',{name:'Camera sensitivity',exact:true});await slider.evaluate(e=>{e.value='2';e.dispatchEvent(new Event('input',{bubbles:true}))});assert.equal(await page.evaluate(()=>window.__bricked.controls.settings.master),2);assert.equal(await page.locator('[data-value="master"]').innerText(),'2.00×');
  const state=await page.evaluate(()=>({part:window.__bricked.placement.selected,pivot:window.__bricked.controls.pivot.toArray(),color:window.__bricked.placement.color}));await slider.focus();for(const key of ['f','h','r','1','l'])await slider.press(key);
  assert.deepEqual(await page.evaluate(()=>({part:window.__bricked.placement.selected,pivot:window.__bricked.controls.pivot.toArray(),color:window.__bricked.placement.color})),state);assert.equal(await page.locator('#app').evaluate(e=>e.classList.contains('ui-hidden')),false);
  await ready();assert.equal(await page.evaluate(()=>window.__bricked.settings.value.master),2);
 });
 await check('The same orbit drag rotates 4x farther at 2x than at 0.5x',async()=>{
  const original=await page.evaluate(()=>({position:window.__bricked.controls.targetPosition.toArray(),pivot:window.__bricked.controls.pivot.toArray()}));const rotations=[];
  for(const sensitivity of [.5,2]){
   await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('slider',{name:'Camera sensitivity',exact:true}).evaluate((e,value)=>{e.value=String(value);e.dispatchEvent(new Event('input',{bubbles:true}))},sensitivity);await page.getByRole('button',{name:'Close settings',exact:true}).click();
   await page.evaluate(original=>{const c=window.__bricked.controls;c.targetPosition.fromArray(original.position);c.pivot.fromArray(original.pivot);c.velocity.set(0,0,0);},original);
   const before=await page.evaluate(()=>{const c=window.__bricked.controls;return Math.atan2(c.targetPosition.x-c.pivot.x,c.targetPosition.z-c.pivot.z)});
   await page.mouse.move(700,500);await page.keyboard.down('Alt');await page.mouse.down();await page.mouse.move(740,500,{steps:4});await page.mouse.up();await page.keyboard.up('Alt');
   const after=await page.evaluate(()=>{const c=window.__bricked.controls;return Math.atan2(c.targetPosition.x-c.pivot.x,c.targetPosition.z-c.pivot.z)});rotations.push(Math.abs(after-before));
  }
  assert.ok(Math.abs(rotations[1]/rotations[0]-4)<.001);results.push({name:'Measured sensitivity ratio',ratio:rotations[1]/rotations[0]});
 });
 await check('Fine-tune, floating, sound, fullscreen settings and Reset defaults work',async()=>{
  await page.getByRole('button',{name:'Enter fullscreen',exact:true}).click();await page.getByRole('button',{name:'Settings',exact:true}).click();assert.ok(await page.locator('.settings-popover').evaluate(e=>document.fullscreenElement.contains(e)));
  await page.locator('.fine-tune summary').click();for(const name of ['Rotation','Pan','Zoom','Fly speed'])await page.getByRole('slider',{name,exact:true}).evaluate(e=>{e.value='1.5';e.dispatchEvent(new Event('input',{bubbles:true}))});
  await page.getByRole('checkbox',{name:'Invert Y',exact:true}).check();await page.getByRole('checkbox',{name:'Allow floating bricks',exact:true}).check();await page.getByRole('checkbox',{name:'Sound',exact:true}).uncheck();assert.equal(await page.evaluate(()=>window.__bricked.placement.allowFloating),true);assert.equal(await page.evaluate(()=>window.__bricked.audio.muted),true);
  const before=await page.evaluate(()=>window.__bricked.controls.targetPosition.toArray());await page.locator('.settings-popover').hover();await page.mouse.wheel(0,-70);assert.deepEqual(await page.evaluate(()=>window.__bricked.controls.targetPosition.toArray()),before);
  await page.getByRole('button',{name:'Reset to defaults',exact:true}).click();assert.deepEqual(await page.evaluate(()=>window.__bricked.settings.value),{master:1,rotation:1,pan:1,zoom:1,fly:1,invertY:false,allowFloating:false,sound:true});assert.equal(await page.evaluate(()=>window.__bricked.audio.muted),false);
  await page.getByRole('button',{name:'Close settings',exact:true}).click();await page.getByRole('button',{name:'Exit fullscreen',exact:true}).click();
 });
}
if(stage==='2'||stage==='all'){
 if(stage==='all')await ready();
 await page.evaluate(()=>window.__bricked.placement.select('bricks-2x4'));
 await check('Right-side color strip, number shortcuts and hex hotkey isolation',async()=>{
  const rect=await page.locator('.color-strip').boundingBox();assert.ok(rect.x>1350);assert.ok(rect.height<=700);
  await page.keyboard.press('3');assert.equal(await page.evaluate(()=>window.__bricked.placement.color),'#f4c740');
  await page.locator('.current-color').click();assert.equal(await page.locator('.custom-section').evaluate(e=>e.open),false);await page.locator('.custom-section summary').click();
  await page.getByRole('textbox',{name:'Hex color',exact:true}).fill('#12ab89');assert.equal(await page.evaluate(()=>window.__bricked.placement.color),'#12ab89');
  const state=await page.evaluate(()=>({type:window.__bricked.placement.selected,rotation:window.__bricked.placement.rotation}));
  await page.getByRole('textbox',{name:'Hex color',exact:true}).press('r');await page.getByRole('textbox',{name:'Hex color',exact:true}).press('h');await page.getByRole('textbox',{name:'Hex color',exact:true}).press('1');
  assert.deepEqual(await page.evaluate(()=>({type:window.__bricked.placement.selected,rotation:window.__bricked.placement.rotation})),state);assert.equal(await page.locator('#app').evaluate(e=>e.classList.contains('ui-hidden')),false);
  await page.getByRole('textbox',{name:'Hex color',exact:true}).fill('#12ab89');
 });
 await check('HSV drag and keyboard colors only update ghost material; Classic adds to My colors',async()=>{
  await page.evaluate(()=>{const b=window.__bricked.bricks;window.__syncCount=0;const original=b.sync.bind(b);b.sync=(...args)=>{window.__syncCount++;return original(...args)}});
  const geometry=await page.evaluate(()=>window.__bricked.placement.ghost.geometry.uuid);
  const wheel=page.getByRole('slider',{name:'Hue and saturation',exact:true});const box=await wheel.boundingBox();
  await page.mouse.move(box.x+box.width/2+45,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+65,box.y+box.height/2+20,{steps:5});await page.mouse.up();
  const color=await page.evaluate(()=>window.__bricked.placement.color);assert.match(color,/^#[0-9a-f]{6}$/);assert.notEqual(color,'#12ab89');await wheel.press('ArrowUp');assert.notEqual(await page.evaluate(()=>window.__bricked.placement.color),color);
  assert.equal(await page.evaluate(()=>window.__syncCount),0);assert.equal(await page.evaluate(()=>window.__bricked.placement.ghost.geometry.uuid),geometry);
  await page.getByRole('button',{name:'Add to palette',exact:true}).click();assert.equal(await page.evaluate(()=>window.__bricked.palettes.active.name),'My colors');assert.equal(await page.evaluate(()=>window.__bricked.palettes.recent.length),0);
  await page.getByRole('button',{name:'Close colors & palettes',exact:true}).click();
  const p=await hover(-4,0,8);await page.mouse.click(p.x,p.y);assert.equal(await page.evaluate(()=>window.__bricked.palettes.recent[0]),await page.evaluate(()=>window.__bricked.placement.color));
 });
 await check('Palette create, duplicate, rename, color removal, delete, persistence and literal brick colors',async()=>{
  const colors=await page.evaluate(()=>window.__bricked.grid.snapshot().map(b=>b.color));
  await page.locator('.current-color').click();await page.getByRole('button',{name:'New',exact:true}).click();await page.locator('#palette-name').fill('Evening');await page.getByRole('button',{name:'Save palette',exact:true}).click();
  await page.getByRole('button',{name:'Add to palette',exact:true}).click();await page.getByRole('button',{name:'Duplicate',exact:true}).click();
  await page.getByRole('button',{name:'Rename',exact:true}).click();await page.locator('#palette-name').fill('After dark');await page.getByRole('button',{name:'Save palette',exact:true}).click();
  await page.getByRole('button',{name:'Edit colors',exact:true}).click();await page.locator('.remove-color').first().click();assert.equal(await page.evaluate(()=>window.__bricked.palettes.active.colors.length),0);
  await page.getByRole('button',{name:'Delete',exact:true}).click();await page.getByRole('button',{name:'Delete palette',exact:true}).click();assert.equal(await page.evaluate(()=>window.__bricked.palettes.active.id),'classic');
  assert.deepEqual(await page.evaluate(()=>window.__bricked.grid.snapshot().map(b=>b.color)),colors);
  await page.getByRole('combobox',{name:'Palette',exact:true}).selectOption({label:'My colors'});const selected=await page.evaluate(()=>window.__bricked.palettes.selectedColor);
  await ready();assert.equal(await page.evaluate(()=>window.__bricked.palettes.active.name),'My colors');assert.equal(await page.evaluate(()=>window.__bricked.palettes.selectedColor),selected);
 });
 await check('Palette flyout stays inside fullscreen root',async()=>{
  await page.getByRole('button',{name:'Enter fullscreen',exact:true}).click();await page.locator('.current-color').click();assert.ok(await page.locator('.palette-flyout').isVisible());assert.ok(await page.locator('.palette-flyout').evaluate(e=>document.fullscreenElement.contains(e)));await page.getByRole('button',{name:'Close colors & palettes',exact:true}).click();await page.getByRole('button',{name:'Exit fullscreen',exact:true}).click();
 });
 await page.screenshot({path:'test-results/revision-colors.png'});
}
assert.deepEqual(errors,[]);await writeFile(`test-results/revision-${stage}.json`,JSON.stringify({results,errors},null,2));await rm(`test-results/revision-${stage}-failure.png`,{force:true});
} catch(e){console.error(e,errors);await page.screenshot({path:`test-results/revision-${stage}-failure.png`,timeout:5000}).catch(()=>{});process.exitCode=1;} finally{await browser.close();await server.stop();}
