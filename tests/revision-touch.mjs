import {chromium} from '@playwright/test';import assert from 'node:assert/strict';import {writeFile,mkdir} from 'node:fs/promises';
import {revisionServer} from './devServer.mjs';
const server=await revisionServer();
const browser=await chromium.launch({executablePath:chromium.executablePath(),args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
const page=await context.newPage(),errors=[],results=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())});await mkdir('test-results',{recursive:true});
const check=async(name,fn)=>{await fn();results.push({name,status:'PASS'});console.log('PASS',name)};
const inside=locator=>locator.evaluate(e=>{const r=e.getBoundingClientRect();return r.top>=0&&r.left>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1});
try{
 await page.goto(server.url,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__bricked);
 const cdp=await context.newCDPSession(page);
 await check('Touch color wheel, hex, long-press editing and material-only preview',async()=>{
  const count=await page.evaluate(()=>window.__bricked.grid.bricks.size),camera=await page.evaluate(()=>window.__bricked.controls.targetPosition.toArray());
  await page.getByRole('button',{name:'Add a custom color',exact:true}).tap();assert.ok(await inside(page.locator('.palette-flyout')));
  const wheel=page.getByRole('slider',{name:'Hue and saturation',exact:true});await wheel.scrollIntoViewIfNeeded();const r=await wheel.boundingBox();
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:r.x+r.width*.7,y:r.y+r.height*.5,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:r.x+r.width*.75,y:r.y+r.height*.7,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  await page.getByRole('textbox',{name:'Hex color',exact:true}).fill('#8f34c1');assert.equal(await page.evaluate(()=>window.__bricked.placement.color),'#8f34c1');
  await page.getByRole('button',{name:'Add to palette',exact:true}).tap();await page.waitForFunction(()=>window.__bricked.palettes.active.name==='My colors');assert.equal(await page.evaluate(()=>window.__bricked.palettes.active.name),'My colors');
  const color=page.locator('.palette-grid .palette-swatch').first();await color.scrollIntoViewIfNeeded();const box=await color.boundingBox();await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width/2,y:box.y+box.height/2,id:1}]});await page.waitForTimeout(650);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.ok(await page.locator('.remove-color').first().isVisible());await page.locator('.remove-color').first().tap();assert.equal(await page.evaluate(()=>window.__bricked.palettes.active.colors.length),0);
  assert.equal(await page.evaluate(()=>window.__bricked.grid.bricks.size),count);assert.deepEqual(await page.evaluate(()=>window.__bricked.controls.targetPosition.toArray()),camera);
  await page.getByRole('button',{name:'Close colors & palettes',exact:true}).tap();
 });
 await check('Touch lock chips, settings and compact layouts remain reachable',async()=>{
  await page.locator('.axis-chip').tap();await page.locator('.layer-chip').tap();await page.getByRole('button',{name:'Raise locked layer',exact:true}).tap();assert.equal(await page.evaluate(()=>window.__bricked.placement.locks.axisActive),true);assert.equal(await page.evaluate(()=>window.__bricked.placement.locks.layer),3);
  for(const viewport of [{width:390,height:844},{width:320,height:568},{width:844,height:390}]){
   await page.setViewportSize(viewport);await page.waitForTimeout(200);assert.ok(await inside(page.locator('.tool-rail')));assert.ok(await inside(page.locator('.lock-controls')));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth||document.documentElement.scrollHeight>innerHeight),false);
   await page.getByRole('button',{name:'Settings',exact:true}).tap();assert.ok(await inside(page.locator('.settings-popover')));await page.locator('.fine-tune summary').tap();assert.ok(await inside(page.locator('.settings-popover')));await page.getByRole('button',{name:'Close settings',exact:true}).tap();
   await page.locator('.current-color').tap();assert.ok(await inside(page.locator('.palette-flyout')));await page.getByRole('button',{name:'Close colors & palettes',exact:true}).tap();
  }
  await page.setViewportSize({width:390,height:844});await page.locator('.axis-chip').tap();await page.locator('.layer-chip').tap();await page.screenshot({path:'test-results/revision-phone.png'});
 });
 await check('Solid panel padding blocks placement and camera wheel input',async()=>{
  for(const selector of ['.parts-tray','.tool-rail','.color-strip']){
   const rect=await page.locator(selector).boundingBox(),x=rect.x+2,y=rect.y+rect.height/2;
   const before=await page.evaluate(()=>({count:window.__bricked.grid.bricks.size,camera:window.__bricked.controls.targetPosition.toArray()}));await page.mouse.move(x,y);await page.mouse.wheel(0,-50);await page.mouse.click(x,y);
   assert.equal(await page.evaluate(()=>window.__bricked.placement.ghost.visible),false);assert.deepEqual(await page.evaluate(()=>({count:window.__bricked.grid.bricks.size,camera:window.__bricked.controls.targetPosition.toArray()})),before);
  }
 });
 await check('Touch L-filter swipe, Rotate and Mirror keep placement armed without canvas input',async()=>{
  await page.getByRole('tab',{name:'Bricks',exact:true}).tap();await page.getByRole('button',{name:'L-shapes filter',exact:true}).tap();
  await page.getByRole('button',{name:'L-shaped brick 2×3, 1-wide arms',exact:true}).tap();
  const before=await page.evaluate(()=>({rotation:window.__bricked.placement.rotation,count:window.__bricked.grid.bricks.size,camera:window.__bricked.controls.targetPosition.toArray()}));
  await page.getByRole('button',{name:'Rotate brick',exact:true}).tap();await page.getByRole('button',{name:'Mirror piece',exact:true}).tap();
  assert.equal(await page.evaluate(()=>window.__bricked.placement.rotation),(before.rotation+90)%360);assert.equal(await page.evaluate(()=>window.__bricked.placement.mirror),true);
  const list=page.locator('.parts-list');await list.evaluate(e=>e.scrollLeft=0);const r=await list.boundingBox(),x=r.x+r.width-5,y=r.y+r.height/2;
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y,id:1}]});for(const delta of [25,55,90])await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-delta,y,id:1}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(300);assert.ok(await list.evaluate(e=>e.scrollLeft)>0);
  assert.equal(await page.evaluate(()=>window.__bricked.grid.bricks.size),before.count);assert.deepEqual(await page.evaluate(()=>window.__bricked.controls.targetPosition.toArray()),before.camera);assert.equal(await page.evaluate(()=>window.__bricked.placement.selected),'bricks-l-2x3-t1');
 });
 assert.deepEqual(errors,[]);await writeFile('test-results/revision-touch.json',JSON.stringify({results,errors},null,2));
}catch(e){console.error(e,errors);await page.screenshot({path:'test-results/revision-touch-failure.png',timeout:5000}).catch(()=>{});process.exitCode=1;}finally{await browser.close();await server.stop();}
