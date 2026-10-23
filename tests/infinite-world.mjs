import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {revisionServer,dismissControls} from './devServer.mjs';
const server=await revisionServer();
const browser=await chromium.launch({executablePath:chromium.executablePath(),args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const page=await browser.newPage({viewport:{width:1280,height:900},deviceScaleFactor:.7}),errors=[],results=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())});
async function check(name,fn){await fn();results.push({name,status:'PASS'});console.log('PASS',name)}
async function point(x,y,z){return page.evaluate(([x,y,z])=>{const c=window.__bricked.world.camera,p=c.position.clone().set(x,y,z).project(c);return{x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2}},[x,y,z])}
try{
 await page.goto(server.url,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__bricked);await dismissControls(page);await mkdir('test-results',{recursive:true});
 await page.waitForFunction(()=>[...document.querySelectorAll('.part img')].every(i=>i.naturalWidth>0));
 await page.screenshot({path:'test-results/infinite-world.png'});
 await check('Both former baseplate edges accept real mouse placement, including negative origins',async()=>{
  await page.evaluate(()=>{const b=window.__bricked;b.history.replace([]);b.placement.select('bricks-1x1')});
  for(const x of [20.5,-20.5]){const p=await point(x,0,.5);await page.mouse.move(p.x,p.y);assert.ok(await page.evaluate(()=>window.__bricked.placement.valid));await page.mouse.click(p.x,p.y)}
  const bricks=await page.evaluate(()=>window.__bricked.grid.snapshot());assert.equal(bricks.length,2);assert.ok(bricks.some(b=>b.x<0));assert.ok(bricks.some(b=>b.x>=32));assert.ok(bricks.every(b=>b.y===0));
 });
 await check('Terrain and shadows follow a camera 1,024 studs away; distant L placement and undo work',async()=>{
  await page.evaluate(()=>{const b=window.__bricked,offset=b.controls.targetPosition.clone().set(1024,0,-768);b.controls.targetPosition.add(offset);b.controls.pivot.add(offset);b.placement.select('plates-l-2x3-t1')});
  await page.waitForFunction(()=>window.__bricked.world.camera.position.distanceTo(window.__bricked.controls.targetPosition)<.02);
  const p=await point(1024,0,-768);await page.mouse.move(p.x,p.y);assert.ok(await page.evaluate(()=>window.__bricked.placement.valid));await page.keyboard.press('m');await page.mouse.click(p.x,p.y);
  assert.ok(await page.evaluate(()=>[...window.__bricked.grid.bricks.values()].some(b=>b.mirror&&b.x>1000&&b.z<0)));
  const terrain=await page.evaluate(()=>{const b=window.__bricked;return {x:b.world.ground.plane.position.x,z:b.world.ground.plane.position.z,studs:b.world.ground.studs.count,shadow:b.world.scene.children.find(o=>o.isDirectionalLight).target.position.toArray()}});
  assert.ok(terrain.x>1000&&terrain.z<0);assert.equal(terrain.studs,96*96);assert.ok(terrain.shadow[0]>1000);await page.screenshot({path:'test-results/infinite-world-distant.png'});
  await page.keyboard.press('Control+z');assert.equal(await page.evaluate(()=>window.__bricked.grid.bricks.size),2);await page.keyboard.press('Control+Shift+z');assert.equal(await page.evaluate(()=>window.__bricked.grid.bricks.size),3);
 });
 await check('Distant autosave reload, picking and deletion retain coordinates without aliases',async()=>{
  const before=await page.evaluate(()=>window.__bricked.grid.snapshot());await page.waitForFunction(()=>JSON.parse(localStorage.getItem('bricked.build.v1')).bricks.length===3);await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__bricked);await dismissControls(page);assert.deepEqual(await page.evaluate(()=>window.__bricked.grid.snapshot()),before);
  await page.evaluate(()=>{const b=window.__bricked,offset=b.controls.targetPosition.clone().set(1024,0,-768);b.controls.targetPosition.add(offset);b.controls.pivot.add(offset);b.placement.select('bricks-1x1')});await page.waitForFunction(()=>window.__bricked.world.camera.position.distanceTo(window.__bricked.controls.targetPosition)<.02);
  const far=before.find(b=>b.x>1000),p=await point(far.x+1.5-16,.4,far.z+2.5-16);await page.mouse.move(p.x,p.y);assert.equal(await page.evaluate(()=>window.__bricked.placement.hit?.brick?.id),far.id);await page.keyboard.press('Delete');assert.equal(await page.evaluate(()=>window.__bricked.grid.bricks.size),2);await page.keyboard.press('Control+z');assert.equal(await page.evaluate(()=>window.__bricked.grid.bricks.size),3);
 });
 await check('Infinite ground uses bounded geometry and still renders only on demand',async()=>{
  await page.mouse.move(0,0);await page.waitForFunction(()=>{const b=window.__bricked;return b.world.camera.position.distanceToSquared(b.controls.targetPosition)<1e-6&&b.world.camera.quaternion.angleTo(b.controls.targetQuaternion)<.0001});await page.waitForTimeout(500);const before=await page.evaluate(()=>({frame:window.__bricked.world.renderer.info.render.frame,geometries:window.__bricked.world.renderer.info.memory.geometries}));await page.waitForTimeout(300);assert.equal(await page.evaluate(()=>window.__bricked.world.renderer.info.render.frame),before.frame);
  assert.ok(before.geometries<30);results.push({name:'Ground resource bound',geometries:before.geometries,studInstances:96*96});
 });
 assert.deepEqual(errors,[]);await writeFile('test-results/infinite-world.json',JSON.stringify({results,errors},null,2));
}catch(e){console.error(e,errors);await page.screenshot({path:'test-results/infinite-world-failure.png',timeout:5000}).catch(()=>{});process.exitCode=1;}finally{await browser.close();await server.stop()}
