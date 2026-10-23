import {chromium} from '@playwright/test';import assert from 'node:assert/strict';import {writeFile,mkdir} from 'node:fs/promises';import {revisionServer,dismissControls} from './devServer.mjs';
const server=await revisionServer();const browser=await chromium.launch({executablePath:chromium.executablePath(),args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});const errors=[],results=[];
try{
 await mkdir('test-results',{recursive:true});
 for(const unavailable of [false,true]){
  const context=await browser.newContext({viewport:{width:1100,height:800},deviceScaleFactor:.5,acceptDownloads:true});
  await context.addInitScript(unavailable=>{
   if(unavailable){Object.defineProperty(window,'localStorage',{get(){throw new Error('Storage unavailable')}});return;}
   localStorage.setItem('bricked.palettes.v1',JSON.stringify({version:1,palettes:[],selectedColor:'bad',activeId:'bad',recent:[]}));
   localStorage.setItem('bricked.settings.v1',JSON.stringify({version:99,values:{master:99}}));
   localStorage.setItem('bricked.carousel.v1',JSON.stringify({version:99,collapsed:true}));
   localStorage.setItem('bricked.build.v1',JSON.stringify({version:1,name:'Before the palette revision',bricks:[{id:'legacy-a',type:'bricks-2x4',color:'#e74c3c',rotation:0,x:12,y:0,z:12},{id:'legacy-b',type:'bricks-2x4',color:'#247bc0',rotation:0,x:13,y:3,z:12}]}));
  },unavailable);
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',e=>{if(e.type()==='error')errors.push(e.text())});await page.goto(server.url,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__bricked);await dismissControls(page);
  if(unavailable){
   await page.evaluate(()=>{window.__bricked.palettes.selectColor('#12ab89');window.__bricked.palettes.create('Memory only');window.__bricked.settings.set('master',2)});
   assert.equal(await page.evaluate(()=>window.__bricked.placement.color),'#12ab89');assert.equal(await page.evaluate(()=>window.__bricked.palettes.active.name),'Memory only');assert.equal(await page.evaluate(()=>window.__bricked.controls.settings.master),2);
   const download=page.waitForEvent('download');await page.getByRole('button',{name:'Save build',exact:true}).click();await download;
   results.push({name:'Unavailable localStorage: app, in-memory palettes/settings, and JSON export still work',status:'PASS'});
  }else{
   assert.equal(await page.evaluate(()=>window.__bricked.palettes.active.id),'classic');assert.equal(await page.evaluate(()=>window.__bricked.palettes.selectedColor),'#e74c3c');assert.equal(await page.evaluate(()=>window.__bricked.settings.value.master),1);assert.equal(await page.evaluate(()=>window.__bricked.carousel.collapsed),false);
   assert.deepEqual(await page.evaluate(()=>window.__bricked.grid.snapshot().map(b=>({id:b.id,color:b.color,x:b.x,y:b.y}))),[{id:'legacy-a',color:'#e74c3c',x:12,y:0},{id:'legacy-b',color:'#247bc0',x:13,y:3}]);
   results.push({name:'Corrupt preferences fall back; pre-revision v1 build loads literal colors and exact cells',status:'PASS'});
   const measurements=await page.evaluate(()=>{
    const b=window.__bricked;b.stress(2000);b.toolbar.clearButton.click();document.querySelector('.confirm-clear').click();const milliseconds=b.metrics.lastClearMs;const count=b.grid.bricks.size;b.history.undo();const restored=b.grid.bricks.size;b.history.clear();return{milliseconds,count,restored};
   });
   assert.equal(measurements.count,0);assert.equal(measurements.restored,2000);assert.ok(measurements.milliseconds<100);results.push({name:'Batched 2,000-brick clear and one-step undo',status:'PASS',...measurements});
  }
  await context.close();
 }
 assert.deepEqual(errors,[]);await writeFile('test-results/revision-storage.json',JSON.stringify({results,errors},null,2));for(const result of results)console.log('PASS',result.name);
}catch(e){console.error(e,errors);process.exitCode=1;}finally{await browser.close();await server.stop();}
