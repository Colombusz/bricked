import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dismissControls } from './devServer.mjs';

const url = process.env.BRICKED_URL || 'http://127.0.0.1:5174';
const results = [];
const stressOnly=process.argv.includes('--stress-only');
const reportPath=stressOnly?'test-results/browser-stress.json':'test-results/browser-results.json';
let server;
try { await fetch(url); }
catch {
  server = spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5174'],{stdio:'pipe'});
  for(let i=0;i<60;i++) {
    try { await fetch(url); break; } catch { await new Promise(resolve=>setTimeout(resolve,250)); }
  }
}
const browser = await chromium.launch({
  headless:true,
  executablePath:process.env.BRICKED_CHROMIUM || chromium.executablePath(),
  args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader'],
});
const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
const page=await context.newPage();
const errors=[];
const monitor=p=>{p.on('pageerror',e=>errors.push(e.message));p.on('console',e=>{if(e.type()==='error')errors.push(e.text());});};
monitor(page);
await mkdir('test-results',{recursive:true});
async function check(name,fn) { if(stressOnly&&!name.startsWith('2,000')&&name!=='No browser console or page errors')return;const start=performance.now();await fn();results.push({name,status:'PASS',durationMs:Math.round(performance.now()-start)});console.log(`PASS ${name}`); }
const count=()=>page.evaluate(()=>window.__bricked.grid.bricks.size);
const wait=async(ms=250)=>page.waitForTimeout(ms);
async function hoverWorld(x,y,z) {
  const p=await page.evaluate(([x,y,z])=>{const c=window.__bricked.world.camera,p=c.position.clone().set(x,y,z).project(c);return{x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2};},[x,y,z]);
  await page.mouse.move(p.x,p.y);await wait(50);return p;
}
async function clearBuild() {
  await page.getByRole('button',{name:'Clear build',exact:true}).click();
  await page.locator('.confirm-clear').click();await wait();
}
async function select(category,id) {
  if(await page.getByRole('tab',{name:category,exact:true}).getAttribute('aria-selected')!=='true') await page.getByRole('tab',{name:category,exact:true}).click();
  const button=page.locator(`[data-type="${id}"]`);
  if(await button.getAttribute('aria-pressed')!=='true') await button.click();
}
try {
  await page.goto(url);await page.waitForFunction(()=>window.__bricked,{timeout:30000});await dismissControls(page);if(stressOnly)await page.evaluate(()=>window.__bricked.world.renderer.setPixelRatio(.35));await wait(500);
  await check('Studio scene, procedural starter, and rendered thumbnails',async()=>{
    assert.equal(await count(),271);
    assert.equal(await page.locator('canvas#scene').count(),1);
    await page.waitForFunction(()=>[...document.querySelectorAll('.part img')].every(i=>i.naturalWidth>=328));
    assert.ok(await page.locator('.part img').evaluateAll(images=>images.every(img=>img.src.startsWith('data:image/png')&&img.naturalWidth>100)));
    await page.screenshot({path:'test-results/desktop.png'});
    // Keep software WebGL rasterization affordable while preserving CSS viewport/input coordinates.
    await page.evaluate(()=>{window.__bricked.world.renderer.setPixelRatio(0.7);window.__bricked.world.resize();});
  });
  await check('Clear confirmation, cancel, undo, and redo',async()=>{
    await page.getByRole('button',{name:'Clear build',exact:true}).click();
    await page.locator('.cancel-clear').click();assert.equal(await count(),271);
    await clearBuild();assert.equal(await count(),0);
    await page.getByRole('button',{name:'Undo',exact:true}).click();assert.equal(await count(),271);
    await page.getByRole('button',{name:'Redo',exact:true}).click();assert.equal(await count(),0);
  });
  let first,second;
  await check('2×4 placement and a second brick exactly one stud offset on top',async()=>{
    await select('Bricks','bricks-2x4');
    const p=await hoverWorld(-4,0,4);
    first=await page.evaluate(()=>({...window.__bricked.placement.candidate}));
    assert.equal(await page.evaluate(()=>window.__bricked.placement.valid),true);
    await page.mouse.click(p.x,p.y);await wait();assert.equal(await count(),1);
    const q=await hoverWorld(first.x+1.7-16,1.2,first.z+1.6-16);
    second=await page.evaluate(()=>({...window.__bricked.placement.candidate}));
    assert.equal(second.y,3);assert.equal(second.x,first.x+1);assert.equal(second.z,first.z);
    await page.mouse.click(q.x,q.y);await wait();assert.equal(await count(),2);
    const positions=await page.evaluate(()=>window.__bricked.grid.snapshot());
    assert.deepEqual(positions.map(b=>b.y),[0,3]);
    assert.equal(await page.evaluate(()=>window.__bricked.grid.occupancy.size),48);
  });
  await check('Slow boundary crossing is integral and hysteresis prevents flicker',async()=>{
    const positions=[];
    for(const x of [5.35,5.6,5.68,5.55,5.34]) {await hoverWorld(x,0,5);positions.push(await page.evaluate(()=>window.__bricked.placement.candidate.x));}
    assert.deepEqual(positions,[20,20,21,21,20]);
    assert.ok(await page.evaluate(()=>{const b=window.__bricked.placement.candidate;return[b.x,b.y,b.z].every(Number.isInteger);}));
  });
  await check('Unsupported ghost is red and ignores clicks; UI hides the ghost',async()=>{
    await page.evaluate(()=>window.__bricked.placement.locks.layer=1);
    const before=await count();const p=await hoverWorld(16.4,.4,0);
    assert.equal(await page.evaluate(()=>window.__bricked.placement.valid),false);
    assert.equal(await page.evaluate(()=>window.__bricked.placement.ghost.visible),true);
    assert.equal(await page.evaluate(()=>window.__bricked.placement.ghost.material.color.getHexString()),'f3343d');
    await page.mouse.click(p.x,p.y);assert.equal(await count(),before);
    await page.getByRole('button',{name:'Ocean blue #247bc0',exact:true}).hover();
    assert.equal(await page.evaluate(()=>window.__bricked.placement.ghost.visible),false);
    await page.evaluate(()=>{window.__bricked.placement.locks.clear();window.__bricked.placement.update()});
  });
  await check('Tiles reject top attachment; floating toggle explicitly allows it',async()=>{
    await select('Tiles','tiles-2x2');const p=await hoverWorld(7,0,-6);
    const tile=await page.evaluate(()=>({...window.__bricked.placement.candidate}));await page.mouse.click(p.x,p.y);await wait();
    await select('Bricks','bricks-1x1');let q=await hoverWorld(tile.x+0.65-16,0.4,tile.z+0.65-16);
    assert.equal(await page.evaluate(()=>window.__bricked.placement.valid),false);
    assert.equal(await page.evaluate(()=>window.__bricked.placement.reason),'Needs a stud underneath');
    const before=await count();await page.mouse.click(q.x,q.y);assert.equal(await count(),before);
    await page.getByRole('button',{name:'Settings',exact:true}).click();await page.locator('#allow-floating').check();
    await page.getByRole('button',{name:'Close settings',exact:true}).click();
    q=await hoverWorld(tile.x+0.65-16,0.4,tile.z+0.65-16);
    assert.equal(await page.evaluate(()=>window.__bricked.placement.valid),true);
    await page.mouse.click(q.x,q.y);await wait();assert.equal(await count(),before+1);
  });
  await check('Delete, eraser, and keyboard undo/redo preserve brick identity',async()=>{
    const before=await count();
    await page.keyboard.press('Delete');assert.equal(await count(),before-1);
    await page.keyboard.press('Control+z');assert.equal(await count(),before);
    await page.keyboard.press('Control+Shift+z');assert.equal(await count(),before-1);
    await page.getByRole('button',{name:'Eraser tool',exact:true}).click();
    const p=await hoverWorld(first.x+1.65-16,2.4,first.z+1.5-16);assert.ok(await page.evaluate(()=>window.__bricked.placement.hit?.brick));
    await page.mouse.click(p.x,p.y);assert.equal(await count(),before-2);
    await page.getByRole('button',{name:'Undo',exact:true}).click();assert.equal(await count(),before-1);
    await page.getByRole('button',{name:'Build tool',exact:true}).click();
  });
  await check('All categories, deselection, colors, rotate, arrows, and bracket keys',async()=>{
    for(const [category,total] of [['Bricks',18],['Plates',21],['Tiles',13]]) {
      await page.getByRole('tab',{name:category,exact:true}).click();assert.equal(await page.locator('.part').count(),total);
      await page.waitForFunction(()=>[...document.querySelectorAll('.part img')].every(i=>i.naturalWidth>=328));
      const legacy=category==='Bricks'?['1x1','1x2','1x3','1x4','1x6','2x2','2x3','2x4','2x6']:category==='Plates'?['1x1','1x2','2x2','2x4','4x4']:['1x1','1x2','2x2'];
      for(const button of await page.locator(legacy.map(size=>`[data-type="${category.toLowerCase()}-${size}"]`).join(',')).all()) {if(await button.getAttribute('aria-pressed')!=='true')await button.click();assert.equal(await button.getAttribute('aria-pressed'),'true');}
    }
    const current=page.locator('.part[aria-pressed="true"]');await current.click();assert.equal(await page.evaluate(()=>window.__bricked.placement.selected),null);
    await page.keyboard.press(']');
    const selected=await page.evaluate(()=>window.__bricked.placement.selected);
    await page.keyboard.press(']');assert.notEqual(await page.evaluate(()=>window.__bricked.placement.selected),selected);
    await page.keyboard.press('[');assert.equal(await page.evaluate(()=>window.__bricked.placement.selected),selected);
    await page.keyboard.press('[');
    for(const button of await page.locator('.strip-colors .palette-swatch').all()) {await button.click();assert.equal(await button.getAttribute('aria-pressed'),'true');}
    const rotation=await page.evaluate(()=>window.__bricked.placement.rotation);await page.getByRole('button',{name:'Rotate brick',exact:true}).click();assert.equal(await page.evaluate(()=>window.__bricked.placement.rotation),(rotation+90)%360);
    await page.keyboard.press('r');assert.equal(await page.evaluate(()=>window.__bricked.placement.rotation),(rotation+180)%360);
    await select('Bricks','bricks-2x4');
  });
  await check('Unity-style camera: Alt orbit, middle pan, dolly, right fly, WASD/QE and F',async()=>{
    const beforeCount=await count();const before=await page.evaluate(()=>window.__bricked.world.camera.position.toArray());
    await page.mouse.move(700,500);await page.keyboard.down('Alt');await page.mouse.down();await page.mouse.move(760,530,{steps:8});await page.mouse.up();await page.keyboard.up('Alt');await wait(600);
    assert.notDeepEqual(await page.evaluate(()=>window.__bricked.world.camera.position.toArray()),before);
    const pivot=await page.evaluate(()=>window.__bricked.controls.pivot.toArray());
    await page.mouse.down({button:'middle'});await page.mouse.move(800,550,{steps:5});await page.mouse.up({button:'middle'});await wait(400);
    assert.notDeepEqual(await page.evaluate(()=>window.__bricked.controls.pivot.toArray()),pivot);
    const distance=await page.evaluate(()=>window.__bricked.world.camera.position.distanceTo(window.__bricked.controls.pivot));await page.mouse.wheel(0,-150);await wait(600);
    assert.ok(await page.evaluate(()=>window.__bricked.world.camera.position.distanceTo(window.__bricked.controls.pivot))<distance);
    await page.mouse.down({button:'right'});await wait(100);
    assert.equal(await page.evaluate(()=>window.__bricked.controls.flying),true);assert.equal(await page.evaluate(()=>window.__bricked.placement.ghost.visible),false);
    await page.mouse.move(825,540,{steps:5});
    for(const key of ['w','a','s','d','q','e']) {
      const position=await page.evaluate(()=>window.__bricked.controls.targetPosition.toArray());
      await page.keyboard.down(key);
      await page.waitForFunction(position=>window.__bricked.controls.targetPosition.toArray().some((v,i)=>Math.abs(v-position[i])>0.001),position,{timeout:5000});
      await page.keyboard.up(key);await wait(120);
      assert.notDeepEqual(await page.evaluate(()=>window.__bricked.controls.targetPosition.toArray()),position,`${key} should move the camera`);
    }
    await page.keyboard.down('Shift');await page.keyboard.down('w');await page.mouse.wheel(0,-50);await wait(150);await page.keyboard.up('w');await page.keyboard.up('Shift');
    await page.mouse.up({button:'right'});await wait(300);
    assert.equal(await page.evaluate(()=>document.pointerLockElement),null);
    assert.equal(await count(),beforeCount);await page.keyboard.press('f');await wait(700);
    assert.ok(await page.evaluate(()=>window.__bricked.world.camera.position.y>=0.7));
    for(const name of ['View along X axis','View from above','View along Z axis']) {await page.getByRole('button',{name,exact:true}).click();await wait(600);}
    await page.getByRole('button',{name:'Frame build',exact:true}).click();await wait(700);
  });
  await check('Native fullscreen and CSS fallback preserve overlay and resize',async()=>{
    await page.getByRole('button',{name:'Enter fullscreen',exact:true}).click();await wait();
    assert.equal(await page.evaluate(()=>document.fullscreenElement?.id),'app');assert.ok(await page.locator('.parts-tray').isVisible());
    assert.ok(await page.evaluate(()=>Math.abs(window.__bricked.world.camera.aspect-innerWidth/innerHeight)<1e-9));
    await page.getByRole('button',{name:'Exit fullscreen',exact:true}).click();await wait();assert.equal(await page.evaluate(()=>document.fullscreenElement),null);
    await page.evaluate(()=>{const root=document.querySelector('#app');Object.defineProperty(root,'requestFullscreen',{value:undefined,configurable:true});Object.defineProperty(root,'webkitRequestFullscreen',{value:undefined,configurable:true});});
    await page.getByRole('button',{name:'Enter fullscreen',exact:true}).click();assert.ok(await page.locator('#app').evaluate(e=>e.classList.contains('maximized')));
    await page.keyboard.press('Escape');assert.equal(await page.locator('#app').evaluate(e=>e.classList.contains('maximized')),false);
    await page.evaluate(()=>{const root=document.querySelector('#app');delete root.requestFullscreen;delete root.webkitRequestFullscreen;});
  });
  await check('Rename, sound toggle, help keyboard control, and accessible dialog close',async()=>{
    await page.locator('.project-name').click();await page.locator('#build-name').fill('My tiny neighborhood');await page.getByRole('button',{name:'Save name',exact:true}).click();assert.match(await page.locator('.project-name').innerText(),/My tiny neighborhood/);
    await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByRole('checkbox',{name:'Sound',exact:true}).uncheck();assert.equal(await page.evaluate(()=>window.__bricked.audio.muted),true);
    await page.getByRole('checkbox',{name:'Sound',exact:true}).check();assert.equal(await page.evaluate(()=>window.__bricked.audio.muted),false);await page.getByRole('button',{name:'Close settings',exact:true}).click();
    await page.keyboard.press('?');assert.equal(await page.locator('.controls-dialog').evaluate(e=>e.open),true);await page.keyboard.press('Escape');assert.equal(await page.locator('.controls-dialog').evaluate(e=>e.open),false);
    await page.getByRole('button',{name:'Show all controls',exact:true}).click();await page.getByRole('button',{name:'Close controls',exact:true}).click();
  });
  await check('JSON download/import, invalid import recovery, and local autosave reload',async()=>{
    const before=await page.evaluate(()=>window.__bricked.grid.snapshot());
    const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Save build',exact:true}).click();const download=await downloadPromise;
    await download.saveAs('test-results/export.json');const exported=JSON.parse(await readFile('test-results/export.json','utf8'));assert.equal(exported.name,'My tiny neighborhood');assert.deepEqual(exported.bricks,before);
    const chooserPromise=page.waitForEvent('filechooser');
    await page.getByRole('button',{name:'Build options',exact:true}).click();await page.getByRole('button',{name:'Import build',exact:true}).click();
    const chooser=await chooserPromise;await chooser.setFiles({name:'broken.json',mimeType:'application/json',buffer:Buffer.from('{wrong')});await wait();assert.match(await page.locator('.toast').innerText(),/not valid JSON/);assert.equal(await count(),before.length);
    await clearBuild();assert.equal(await count(),0);await page.locator('#import-file').setInputFiles('test-results/export.json');await wait();assert.deepEqual(await page.evaluate(()=>window.__bricked.grid.snapshot()),before);
    await wait(400);await page.reload();await page.waitForFunction(()=>window.__bricked);await dismissControls(page);assert.deepEqual(await page.evaluate(()=>window.__bricked.grid.snapshot()),before);
  });
  await check('Mouse wheel carousel and responsive layouts at 600, 768, and 1024px',async()=>{
    for(const width of [600,768,1024]) {
      await page.setViewportSize({width,height:900});await wait();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    }
    await page.setViewportSize({width:600,height:900});await select('Bricks','bricks-1x1');
    const list=page.locator('.parts-list');await list.evaluate(e=>e.scrollLeft=0);const before=await list.evaluate(e=>e.scrollLeft);await list.hover();await page.mouse.wheel(0,220);await wait(400);assert.ok(await list.evaluate(e=>e.scrollLeft)>before);
    await page.setViewportSize({width:1440,height:1000});
  });
  await check('Touch tap, orbit, pinch/pan, carousel swipe and mobile layout',async()=>{
    const mobileContext=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
    const mobile=await mobileContext.newPage();monitor(mobile);await mobile.goto(url,{waitUntil:'domcontentloaded',timeout:60000});await mobile.waitForFunction(()=>window.__bricked,null,{timeout:60000});await dismissControls(mobile);await mobile.waitForTimeout(500);
    await mobile.screenshot({path:'test-results/mobile-starter.png'});
    const cdp=await mobileContext.newCDPSession(mobile);
    const gesture=async(points,moves)=>{
      await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points});
      for(const touchPoints of moves) {await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints});await mobile.waitForTimeout(30);}
      await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await mobile.waitForTimeout(500);
    };
    const initial=await mobile.evaluate(()=>window.__bricked.world.camera.position.toArray());
    await gesture([{x:200,y:450,id:1}],[[{x:210,y:450,id:1}],[{x:240,y:470,id:1}],[{x:260,y:480,id:1}]]);
    assert.notDeepEqual(await mobile.evaluate(()=>window.__bricked.world.camera.position.toArray()),initial);
    const beforePan=await mobile.evaluate(()=>window.__bricked.controls.pivot.toArray());const beforeDistance=await mobile.evaluate(()=>window.__bricked.controls.targetPosition.distanceTo(window.__bricked.controls.pivot));
    await gesture([{x:150,y:440,id:1},{x:250,y:440,id:2}],[[{x:130,y:460,id:1},{x:280,y:460,id:2}],[{x:120,y:480,id:1},{x:300,y:480,id:2}]]);
    assert.notDeepEqual(await mobile.evaluate(()=>window.__bricked.controls.pivot.toArray()),beforePan);assert.notEqual(await mobile.evaluate(()=>window.__bricked.controls.targetPosition.distanceTo(window.__bricked.controls.pivot)),beforeDistance);
    await mobile.getByRole('button',{name:'Clear build',exact:true}).tap();await mobile.locator('.confirm-clear').tap();
    await mobile.getByRole('button',{name:'Frame build',exact:true}).tap();await mobile.waitForTimeout(800);
    const p=await mobile.evaluate(()=>{const c=window.__bricked.world.camera,p=c.position.clone().set(0,0,0).project(c);return{x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2};});
    await mobile.touchscreen.tap(p.x,p.y);assert.equal(await mobile.evaluate(()=>window.__bricked.grid.bricks.size),1);
    const list=mobile.locator('.parts-list');await list.evaluate(e=>e.scrollLeft=0);const lb=await list.boundingBox();const sy=lb.y+lb.height/2,sx=lb.x+lb.width-8;await gesture([{x:sx,y:sy,id:1}],[[{x:sx-25,y:sy,id:1}],[{x:sx-65,y:sy,id:1}],[{x:sx-100,y:sy,id:1}]]);assert.ok(await list.evaluate(e=>e.scrollLeft)>0);
    assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await mobile.screenshot({path:'test-results/mobile.png'});
    for(const viewport of [{width:320,height:568},{width:844,height:390}]) {
      await mobile.setViewportSize(viewport);await mobile.waitForTimeout(250);
      assert.equal(await mobile.evaluate(()=>document.documentElement.scrollHeight>innerHeight||document.documentElement.scrollWidth>innerWidth),false);
      assert.ok(await mobile.locator('.tool-rail').evaluate(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight;}));
    }
    await mobile.evaluate(()=>window.__bricked.stress(500));await mobile.waitForTimeout(1000);assert.equal(await mobile.evaluate(()=>window.__bricked.grid.bricks.size),500);
    await mobileContext.close();
  });
  await check('Starter load option, keyboard stress action and undo',async()=>{
    await page.evaluate(()=>{window.__bricked.world.renderer.setPixelRatio(0.35);window.__bricked.world.resize();});
    await page.getByRole('button',{name:'Build options',exact:true}).click();await page.getByRole('button',{name:'Load starter build',exact:true}).click();await page.locator('[data-confirm]').click();assert.equal(await count(),271);
    await page.keyboard.press('Control+Shift+b');assert.equal(await count(),1000);await page.keyboard.press('Control+z');assert.equal(await count(),271);
  });
  await check('2,000 instanced bricks, growing capacity, and no idle scene renders',async()=>{
    await page.evaluate(()=>{const b=window.__bricked;b.history.replace([]);b.placement.select(null);b.controls.frame()});
    await page.waitForFunction(()=>{const b=window.__bricked,c=b.controls;return b.world.camera.position.distanceToSquared(c.targetPosition)<1e-6&&b.world.camera.quaternion.angleTo(c.targetQuaternion)<.0001&&!c.framing},null,{timeout:60000});
    await page.evaluate(()=>window.__bricked.stress(2000));await wait(1600);assert.equal(await count(),2000);
    const calls=await page.evaluate(()=>window.__bricked.world.renderer.info.render.calls),variants=await page.evaluate(()=>[...window.__bricked.bricks.batches.values()].filter(b=>b.mesh.count>0).length);assert.ok(variants>=20);assert.ok(calls<=variants+5,`${calls} draw calls for ${variants} variants`);
    await page.mouse.move(0,0);await page.waitForFunction(()=>{const b=window.__bricked,c=b.controls;return b.world.camera.position.distanceToSquared(c.targetPosition)<1e-6&&b.world.camera.quaternion.angleTo(c.targetQuaternion)<.0001&&c.velocity.lengthSq()<.00001&&!c.framing});await wait(500);const frame=await page.evaluate(()=>window.__bricked.world.renderer.info.render.frame);await wait(400);assert.equal(await page.evaluate(()=>window.__bricked.world.renderer.info.render.frame),frame);
    results.push({name:'Instancing measurements',bricks:2000,drawCalls:calls});
  });
  await check('No browser console or page errors',async()=>assert.deepEqual(errors,[]));
  await writeFile(reportPath,JSON.stringify(results,null,2));
  await rm('test-results/failure.png',{force:true});
  console.log(`\n${results.filter(r=>r.status==='PASS').length} browser checks passed. Screenshots and results in test-results/.`);
} catch(error) {
  console.error(error);console.error('Browser errors:',errors);if(stressOnly)console.error('Motion state:',await page.evaluate(()=>{const b=window.__bricked,c=b.controls;return {distance:b.world.camera.position.distanceToSquared(c.targetPosition),angle:b.world.camera.quaternion.angleTo(c.targetQuaternion),velocity:c.velocity.lengthSq(),framing:c.framing,frames:b.world.renderer.info.render.frame}}).catch(()=>null));
  await page.screenshot({path:'test-results/failure.png',timeout:5000}).catch(()=>{});
  await writeFile(reportPath,JSON.stringify({results,error:String(error),errors},null,2));
  process.exitCode=1;
} finally {await browser.close();if(server)server.kill('SIGTERM');}
