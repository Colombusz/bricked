import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {revisionServer,dismissControls} from './devServer.mjs';
const stage=process.argv[2]||'all',server=await revisionServer();
const browser=await chromium.launch({executablePath:chromium.executablePath(),args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:.5});
await context.addInitScript(()=>{const original=HTMLCanvasElement.prototype.getContext,contexts=new Set();HTMLCanvasElement.prototype.getContext=function(...args){const ctx=original.apply(this,args);if(ctx&&String(args[0]).startsWith('webgl'))contexts.add(ctx);window.__webglContexts=contexts.size;return ctx;}});
const page=await context.newPage(),errors=[],results=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())});
async function check(name,fn){await fn();results.push({name,status:'PASS'});console.log('PASS',name)}
async function ready(){await page.goto(server.url,{waitUntil:'domcontentloaded',timeout:60000});await page.waitForFunction(()=>window.__bricked,null,{timeout:60000});await dismissControls(page);}
try{
 await ready();
 if(stage==='1'||stage==='all'){
  await check('Q/E enable and step layer once; limits flash; obsolete keys do nothing',async()=>{
   await page.evaluate(()=>{const b=window.__bricked;b.history.replace([]);b.placement.select('bricks-2x4');b.placement.setPointer(.5,.5)});
   await page.keyboard.press('e');assert.equal(await page.evaluate(()=>window.__bricked.placement.locks.layer),3);assert.equal(await page.evaluate(()=>window.__bricked.placement.candidate.y),3);assert.match(await page.locator('.layer-chip').innerText(),/Layer 3/);
   await page.keyboard.down('e');await page.keyboard.down('e');await page.keyboard.up('e');assert.equal(await page.evaluate(()=>window.__bricked.placement.locks.layer),6);
   await page.keyboard.press('q');await page.keyboard.press('PageUp');await page.keyboard.press('PageDown');assert.equal(await page.evaluate(()=>window.__bricked.placement.locks.layer),3);
   await page.evaluate(()=>window.__bricked.placement.locks.layer=93);await page.keyboard.press('e');assert.equal(await page.evaluate(()=>window.__bricked.placement.locks.layer),93);assert.ok(await page.evaluate(()=>window.__bricked.placement.locks.limitPulse)>0);
   await page.evaluate(()=>{window.__bricked.placement.select('plates-1x1');window.__bricked.placement.locks.clear()});await page.keyboard.press('e');assert.equal(await page.evaluate(()=>window.__bricked.placement.locks.layer),1);
   await page.evaluate(()=>window.__bricked.placement.select(null));await page.keyboard.press('e');await page.keyboard.press('q');assert.equal(await page.evaluate(()=>window.__bricked.placement.locks.layer),null);const orientation=await page.evaluate(()=>window.__bricked.placement.rotation);await page.keyboard.press('r');assert.equal(await page.evaluate(()=>window.__bricked.placement.rotation),(orientation+90)%360);
  });
  await check('Right mouse Q/E fly without stepping; text fields ignore layer keys',async()=>{
   await page.evaluate(()=>{window.__bricked.placement.select('bricks-2x4');window.__bricked.placement.locks.layer=6});await page.mouse.move(700,500);await page.mouse.down({button:'right'});
   for(const key of ['q','e']){const before=await page.evaluate(()=>window.__bricked.controls.targetPosition.y);await page.keyboard.down(key);await page.waitForFunction(y=>Math.abs(window.__bricked.controls.targetPosition.y-y)>.01,before);await page.keyboard.up(key);assert.equal(await page.evaluate(()=>window.__bricked.placement.locks.layer),6)}await page.mouse.up({button:'right'});
   await page.evaluate(()=>{const input=document.createElement('input');input.id='test-text';document.querySelector('#app').append(input);input.focus()});await page.keyboard.press('e');await page.keyboard.press('q');assert.equal(await page.evaluate(()=>window.__bricked.placement.locks.layer),6);await page.locator('#test-text').evaluate(e=>e.remove());
   await page.getByRole('button',{name:'Add a custom color',exact:true}).click();const hex=page.getByRole('textbox',{name:'Hex color',exact:true});await hex.focus();await hex.press('q');await hex.press('e');assert.equal(await page.evaluate(()=>window.__bricked.placement.locks.layer),6);await page.getByRole('button',{name:'Close colors & palettes',exact:true}).click();
  });
 }
 if(stage==='3'||stage==='all'){
  await ready();
  await check('Expanded straight catalog counts, large plate masks and placement',async()=>{
   for(const [category,total] of [['Bricks',18],['Plates',21],['Tiles',13]]){await page.getByRole('tab',{name:category,exact:true}).click();assert.equal(await page.locator('.part').count(),total)}
   await page.getByRole('tab',{name:'Plates',exact:true}).click();await page.locator('[data-type="plates-8x8"]').click();
   const placed=await page.evaluate(()=>{const b=window.__bricked;b.history.replace([]);b.placement.setPointer(.5,.5);const p=b.placement.commit();return {candidate:p,success:p&&b.history.place(p),cells:b.grid.occupancy.size}});
   assert.ok(placed.success);assert.equal(placed.cells,64);assert.equal(placed.candidate.type,'plates-8x8');
  });
 }
 if(stage==='4'||stage==='all'){
  await ready();
  await check('L ghost outline, R orientations, M handedness, mask notch placement and stacking',async()=>{
   const state=await page.evaluate(async()=>{
    const {footprint}=await import('/src/bricks/catalog.ts');const b=window.__bricked;b.history.replace([]);b.placement.select('plates-l-2x3-t1');b.placement.setPointer(.5,.5);
    const rotations=[];for(let i=0;i<4;i++){rotations.push(footprint(b.placement.candidate).cells.map(c=>`${c.x},${c.z}`).sort().join(';'));b.placement.rotate()}
    return {rotations,outline:b.placement.outline.geometry.drawRange.count,geometry:b.placement.ghost.geometry.uuid};
   });assert.equal(new Set(state.rotations).size,4);assert.equal(state.outline,6);await page.keyboard.press('m');assert.ok(await page.evaluate(()=>window.__bricked.placement.mirror));assert.notEqual(await page.evaluate(()=>window.__bricked.placement.ghost.geometry.uuid),state.geometry);
   const result=await page.evaluate(()=>{
    const b=window.__bricked;b.placement.locks.clear();b.history.replace([]);
    const part=(id,type,x,y,z,rotation=0,mirror=false)=>({id,type,x,y,z,rotation,mirror,color:'#e74c3c'});
    const l=part('L','plates-l-3x3-t1',12,0,12),inside=part('inside','bricks-1x1',13,0,13);b.history.place(inside);const wrap=b.grid.validate(l).valid;b.history.place(l);
    b.placement.select('plates-l-3x3-t1');b.placement.setPointer(.5,.5);const outline=b.placement.outline.geometry.drawRange.count;
    b.history.replace([part('lower','bricks-l-3x3-t1',12,0,12)]);const top=part('upper','bricks-l-3x3-t1',12,3,12,180);const cross=b.grid.validate(top).valid;b.history.place(top);
    return {wrap,outline,cross,count:b.grid.bricks.size};
   });assert.ok(result.wrap);assert.ok(result.cross);assert.equal(result.outline,6);assert.equal(result.count,2);
   await page.evaluate(()=>{window.__bricked.placement.select('bricks-l-3x3-t1')});await page.keyboard.press('m');assert.equal(await page.evaluate(()=>window.__bricked.placement.mirror),false);
  });
  await check('Mirror and orientation survive delete/undo, autosave and reload',async()=>{
   await page.evaluate(()=>{const b=window.__bricked;b.history.replace([]);b.history.place({id:'mirror',type:'bricks-l-2x4-t1',color:'#247bc0',rotation:270,mirror:true,x:12,y:0,z:12});b.history.delete('mirror');b.history.undo()});
   await page.waitForFunction(()=>JSON.parse(localStorage.getItem('bricked.build.v1')).bricks[0]?.mirror===true);await ready();
   const saved=await page.evaluate(()=>window.__bricked.grid.bricks.get('mirror'));assert.equal(saved.mirror,true);assert.equal(saved.rotation,270);
   await page.screenshot({path:'test-results/catalog-L-stage.png'});
  });
 }
 if(stage==='5'||stage==='all'){
  await ready();
  await check('Lazy 2x thumbnails use two total WebGL contexts, with no unseen category renders',async()=>{
   await page.waitForFunction(()=>[...document.querySelectorAll('.part img')].every(i=>i.naturalWidth===328));
   assert.equal(await page.evaluate(()=>window.__bricked.carousel.thumbnails.images.size),18);assert.equal(await page.evaluate(()=>window.__webglContexts),2);
   assert.equal(await page.locator('.group-start').count(),2);
  });
  await check('L filter, ordering, labels, preserved selection and view scroll reset',async()=>{
   const selected=await page.evaluate(()=>window.__bricked.placement.selected);await page.getByRole('tab',{name:'Plates',exact:true}).click();assert.equal(await page.evaluate(()=>window.__bricked.placement.selected),selected);
   await page.locator('.parts-list').evaluate(e=>e.scrollLeft=300);await page.getByRole('button',{name:'L-shapes filter',exact:true}).click();assert.equal(await page.locator('.part').count(),8);assert.equal(await page.evaluate(()=>window.__bricked.placement.selected),selected);assert.equal(await page.locator('.parts-list').evaluate(e=>e.scrollLeft),0);
   for(const category of ['Bricks','Plates','Tiles']){await page.getByRole('tab',{name:category,exact:true}).click();assert.equal(await page.locator('.part').count(),8);assert.ok(await page.locator('.parts-tray').evaluate(e=>e.getBoundingClientRect().height<=72));}
   await page.waitForFunction(()=>[...document.querySelectorAll('.part img')].every(i=>i.naturalWidth===328));assert.equal(await page.evaluate(()=>window.__webglContexts),2);
   await page.getByRole('button',{name:'L-shaped tile 4×4, 2-wide arms',exact:true}).click();assert.equal(await page.evaluate(()=>window.__bricked.placement.selected),'tiles-l-4x4-t2');
   await page.getByRole('button',{name:'Collapse parts',exact:true}).click();await ready();assert.ok(await page.getByRole('button',{name:'Expand parts',exact:true}).isVisible());assert.equal(await page.evaluate(()=>window.__bricked.carousel.lShapes),true);await page.waitForFunction(()=>window.__bricked.carousel.thumbnails.images.has('bricks-2x4'));assert.equal(await page.evaluate(()=>window.__bricked.carousel.thumbnails.images.size),1);await page.getByRole('button',{name:'Expand parts',exact:true}).click();
   await page.getByRole('tab',{name:'Plates',exact:true}).click();await page.getByRole('button',{name:'L-shaped plate 2×3, 1-wide arms',exact:true}).click();await page.waitForFunction(()=>[...document.querySelectorAll('.part img')].every(i=>i.naturalWidth===328));await page.screenshot({path:'test-results/catalog-L-filter.png'});
  });
  await check('Compact phone rotate/mirror controls fit, remain in fullscreen and block scene input',async()=>{
   await page.evaluate(()=>{const p=window.__bricked.placement;p.toggleAxis();p.locks.layer=93;p.onChange()});
   for(const viewport of [{width:390,height:844},{width:320,height:568},{width:844,height:390}]){
    await page.setViewportSize(viewport);assert.ok((await page.locator('.parts-tray').boundingBox()).height<=(viewport.width<=750?56:72));
    assert.ok(await page.getByRole('button',{name:'Rotate brick',exact:true}).isVisible());assert.ok(await page.getByRole('button',{name:'Mirror piece',exact:true}).isVisible());
    const boxes=await page.locator('.lock-controls button:visible').evaluateAll(elements=>elements.map(e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom}}));for(const r of boxes){assert.ok(r.left>=0&&r.right<=viewport.width,JSON.stringify({viewport,r}));assert.ok(r.top>=0&&r.bottom<=viewport.height)}
    if(viewport.width===320){const swatches=await page.locator('.color-strip').boundingBox();assert.ok(boxes.every(r=>r.right<=swatches.x||r.left>=swatches.x+swatches.width||r.bottom<=swatches.y||r.top>=swatches.y+swatches.height));await page.screenshot({path:'test-results/catalog-phone-320-locks.png'})}
   }
   await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Enter fullscreen',exact:true}).click();await page.waitForFunction(()=>document.fullscreenElement||document.querySelector('#app').classList.contains('maximized'));assert.ok(await page.locator('.lock-controls').evaluate(e=>(document.fullscreenElement||document.querySelector('#app.maximized')).contains(e)));
   const count=await page.evaluate(()=>window.__bricked.grid.bricks.size),rotation=await page.evaluate(()=>window.__bricked.placement.rotation);await page.getByRole('button',{name:'Rotate brick',exact:true}).click();assert.equal(await page.evaluate(()=>window.__bricked.placement.rotation),(rotation+90)%360);await page.getByRole('button',{name:'Mirror piece',exact:true}).click();assert.equal(await page.evaluate(()=>window.__bricked.placement.mirror),true);assert.equal(await page.evaluate(()=>window.__bricked.grid.bricks.size),count);
   await page.screenshot({path:'test-results/catalog-phone.png'});await page.getByRole('button',{name:'Exit fullscreen',exact:true}).click();
   await page.evaluate(()=>window.__bricked.placement.select('plates-l-3x3-t1'));assert.equal(await page.getByRole('button',{name:'Mirror piece',exact:true}).isVisible(),false);await page.setViewportSize({width:1440,height:1000});
  });
 }
 if(stage==='6'||stage==='all'){
  await ready();
  await check('Mouse placement fits a notch in either order and real ghost support excludes the notch',async()=>{
   await page.evaluate(()=>{const b=window.__bricked;b.history.replace([]);b.placement.select('plates-l-3x3-t1');b.placement.rotation=0;b.placement.mirror=false;b.placement.locks.layer=0;b.controls.snapAxis('y')});
   await page.waitForFunction(()=>window.__bricked.world.camera.position.distanceTo(window.__bricked.controls.targetPosition)<.02);
   const point=async(y=0)=>page.evaluate(y=>{const c=window.__bricked.world.camera,p=c.position.clone().set(-2.5,y,-2.5).project(c);return{x:(p.x+1)*innerWidth/2,y:(1-p.y)*innerHeight/2}},y);
   let p=await point();await page.mouse.click(p.x,p.y);assert.equal(await page.evaluate(()=>window.__bricked.grid.bricks.size),1);
   await page.evaluate(()=>window.__bricked.placement.select('bricks-1x1'));await page.mouse.click(p.x,p.y);
   let snapshot=await page.evaluate(()=>window.__bricked.grid.snapshot());assert.equal(snapshot.length,2);assert.ok(snapshot.every(b=>b.y===0));assert.equal(snapshot.find(b=>b.type==='bricks-1x1').x,13);
   await page.evaluate(()=>window.__bricked.history.replace([]));await page.mouse.click(p.x,p.y);await page.evaluate(()=>window.__bricked.placement.select('plates-l-3x3-t1'));await page.mouse.click(p.x,p.y);
   assert.ok(await page.evaluate(()=>window.__bricked.grid.snapshot().every(b=>b.y===0)));assert.equal(await page.evaluate(()=>window.__bricked.grid.bricks.size),2);
   await page.evaluate(()=>{const b=window.__bricked;b.history.replace([{id:'notch-support',type:'bricks-1x1',color:'#247bc0',rotation:0,x:13,y:0,z:13}]);b.placement.locks.layer=3});p=await point(1.2);await page.mouse.move(p.x,p.y);assert.equal(await page.evaluate(()=>window.__bricked.placement.valid),false);assert.equal(await page.evaluate(()=>window.__bricked.placement.ghost.material.color.getHexString()),'f3343d');await page.mouse.click(p.x,p.y);assert.equal(await page.evaluate(()=>window.__bricked.grid.bricks.size),1);
   await page.evaluate(()=>{const b=window.__bricked;b.history.replace([{id:'real-support',type:'bricks-1x1',color:'#247bc0',rotation:0,x:12,y:0,z:12}])});assert.ok(await page.evaluate(()=>window.__bricked.placement.valid));
   await page.screenshot({path:'test-results/catalog-supported-L.png'});
  });
  await check('Old save loads, unknown types warn and toast, valid pieces remain',async()=>{
   const warnings=[];page.on('console',e=>{if(e.type()==='warning')warnings.push(e.text())});
   const old={id:'old',type:'bricks-2x4',color:'#247bc0',rotation:90,x:10,y:0,z:10};
   await page.locator('#import-file').setInputFiles({name:'future.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({version:1,name:'Compatible',bricks:[old,{...old,id:'future',type:'not-released-yet'}]}))});
   await page.waitForFunction(()=>window.__bricked.grid.bricks.has('old'));assert.match(await page.locator('.toast').innerText(),/1 pieces skipped/);assert.ok(warnings.some(w=>w.includes('not-released-yet')));
   const loaded=await page.evaluate(()=>window.__bricked.grid.snapshot());assert.deepEqual(loaded,[{...old,mirror:false}]);
  });
  await check('Ghost reuses candidate/ray/outline buffers; large plates stay within the input budget',async()=>{
   const measurements=await page.evaluate(()=>{
    const b=window.__bricked,p=b.placement;b.history.replace([]);p.locks.clear();p.locks.layer=0;p.setPointer(.5,.5);
    const result=[];for(const type of ['bricks-1x1','plates-8x8']){p.select(type);p.setPointer(.5,.5);const candidate=p.candidate,hit=p.hit,array=p.outline.geometry.attributes.position.array;const start=performance.now();for(let i=0;i<3000;i++)p.update();result.push({type,averageMs:(performance.now()-start)/3000,reuses: candidate===p.candidate&&hit===p.hit&&array===p.outline.geometry.attributes.position.array})}return result;
   });for(const result of measurements){assert.ok(result.reuses);assert.ok(result.averageMs<1,JSON.stringify(result))}results.push({name:'Ghost CPU timings',measurements});
  });
  await check('Mixed 2,000-piece stress uses 24 types, bounded draw calls, fast clear and one-step restore',async()=>{
   const result=await page.evaluate(()=>{const b=window.__bricked;b.placement.select(null);b.world.renderer.setPixelRatio(.25);b.stress(2000);b.controls.update(1);b.world.renderer.render(b.world.scene,b.world.camera);const count=b.grid.bricks.size,types=new Set([...b.grid.bricks.values()].map(p=>p.type)).size,variants=[...b.bricks.batches.values()].filter(v=>v.mesh.count>0).length,calls=b.world.renderer.info.render.calls;b.toolbar.clearButton.click();document.querySelector('.confirm-clear').click();const clearMs=b.metrics.lastClearMs,empty=b.grid.bricks.size;b.history.undo();const restored=b.grid.snapshot();b.history.clear();return{count,types,variants,calls,clearMs,empty,restored:restored.length,hasMirror:restored.some(p=>p.mirror),emptyVisible:[...b.bricks.batches.values()].some(v=>v.mesh.visible)}});
   assert.equal(result.count,2000);assert.equal(result.types,24);assert.ok(result.calls<=result.variants+5);assert.ok(result.clearMs<100);assert.equal(result.empty,0);assert.equal(result.restored,2000);assert.ok(result.hasMirror);assert.equal(result.emptyVisible,false);results.push({name:'Mixed stress measurements',...result});
  });
 }
 assert.deepEqual(errors,[]);await mkdir('test-results',{recursive:true});await writeFile(`test-results/catalog-${stage}.json`,JSON.stringify({results,errors},null,2));
}finally{await browser.close();await server.stop()}
