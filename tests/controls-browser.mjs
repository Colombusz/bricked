import {chromium} from '@playwright/test';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {revisionServer,dismissControls} from './devServer.mjs';

const server=await revisionServer();
const browser=await chromium.launch({executablePath:chromium.executablePath(),args:['--no-sandbox','--enable-unsafe-swiftshader','--use-angle=swiftshader']});
const errors=[],results=[];
const context=await browser.newContext({viewport:{width:1280,height:900},deviceScaleFactor:.5});
const page=await context.newPage();
function monitor(page){page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});}
monitor(page);
async function check(name,run){await run();results.push({name,status:'PASS'});console.log('PASS',name);}
async function ready(page){await page.waitForFunction(()=>window.__bricked,null,{timeout:60000});}
const dialog=page.getByRole('dialog',{name:'Building and camera controls',exact:true});
try{
 await mkdir('test-results',{recursive:true});
 await page.goto(server.url,{waitUntil:'domcontentloaded'});await ready(page);
 await check('Welcome opens automatically, focuses its close button, and blocks building shortcuts',async()=>{
  assert.ok(await dialog.isVisible());
  assert.ok(await page.getByRole('button',{name:'Close controls',exact:true}).evaluate(button=>document.activeElement===button));
  assert.ok(await page.evaluate(()=>window.__bricked.placement.blocked&&!window.__bricked.placement.ghost.visible));
  const before=await page.evaluate(()=>({bricks:window.__bricked.grid.snapshot(),rotation:window.__bricked.placement.rotation,camera:window.__bricked.controls.targetPosition.toArray()}));
  for(const key of ['r','Delete','Control+z','f'])await page.keyboard.press(key);
  assert.deepEqual(await page.evaluate(()=>({bricks:window.__bricked.grid.snapshot(),rotation:window.__bricked.placement.rotation,camera:window.__bricked.controls.targetPosition.toArray()})),before);
  await page.keyboard.press('Tab');assert.ok(await page.getByRole('button',{name:'Start building',exact:true}).evaluate(button=>document.activeElement===button));
  await page.keyboard.press('Shift+Tab');assert.ok(await page.getByRole('button',{name:'Close controls',exact:true}).evaluate(button=>document.activeElement===button));
  await page.screenshot({path:'test-results/controls-desktop.png'});
  await dismissControls(page);assert.equal(await dialog.count(),0);
  await page.keyboard.press('r');assert.equal(await page.evaluate(()=>window.__bricked.placement.rotation),(before.rotation+90)%360);
 });
 await check('Question-mark tool and key reopen; close, Escape and backdrop dismiss with focus restored',async()=>{
  const help=page.locator('.tool-rail').getByRole('button',{name:'Open controls',exact:true});
  assert.ok(await help.isVisible());assert.equal(await help.getAttribute('aria-controls'),'controls-dialog');
  await help.click();assert.ok(await dialog.isVisible());
  await page.getByRole('button',{name:'Close controls',exact:true}).click();
  assert.ok(await help.evaluate(button=>document.activeElement===button));
  await page.keyboard.press('?');assert.ok(await dialog.isVisible());await page.keyboard.press('Escape');assert.equal(await dialog.count(),0);
  const count=await page.evaluate(()=>window.__bricked.grid.bricks.size);
  await help.click();await page.mouse.click(5,5);assert.equal(await dialog.count(),0);assert.equal(await page.evaluate(()=>window.__bricked.grid.bricks.size),count);
  await page.keyboard.press('h');await page.keyboard.press('?');assert.ok(await dialog.isVisible());await page.keyboard.press('Escape');await page.keyboard.press('h');
 });
 await check('Reload opens the guide again and preserves the saved build',async()=>{
  const before=await page.evaluate(()=>window.__bricked.grid.snapshot().map(brick=>({...brick,mirror:Boolean(brick.mirror)})));
  await page.reload({waitUntil:'domcontentloaded'});await ready(page);assert.ok(await dialog.isVisible());
  assert.deepEqual(await page.evaluate(()=>window.__bricked.grid.snapshot().map(brick=>({...brick,mirror:Boolean(brick.mirror)}))),before);
  await dismissControls(page);
 });
 await check('Touch guide scrolls with reachable close/start buttons in portrait and landscape',async()=>{
  const mobileContext=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:.5,isMobile:true,hasTouch:true});
  const mobile=await mobileContext.newPage();monitor(mobile);
  try{
   await mobile.goto(server.url,{waitUntil:'domcontentloaded'});await ready(mobile);
   for(const viewport of [{width:390,height:844},{width:320,height:568},{width:740,height:390}]){
    await mobile.setViewportSize(viewport);
    const layout=await mobile.locator('.controls-dialog').evaluate(dialog=>{
     const content=dialog.querySelector('.controls-content'),box=dialog.getBoundingClientRect();
     const buttons=[...dialog.querySelectorAll('button')].map(button=>{const r=button.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,height:r.height};});
     return {inside:box.top>=0&&box.left>=0&&box.right<=innerWidth+1&&box.bottom<=innerHeight+1,overflow:document.documentElement.scrollWidth>innerWidth,scrollable:content.scrollHeight>content.clientHeight,buttons};
    });
    assert.ok(layout.inside);assert.equal(layout.overflow,false);assert.ok(layout.scrollable);
    assert.ok(layout.buttons.every(button=>button.top>=0&&button.bottom<=viewport.height&&button.left>=0&&button.right<=viewport.width&&button.height>=44));
    await mobile.locator('.controls-content').evaluate(content=>content.scrollTop=content.scrollHeight);
    assert.ok(await mobile.getByText('On a touchscreen',{exact:true}).isVisible());
   }
   await mobile.setViewportSize({width:390,height:844});await mobile.locator('.controls-content').evaluate(content=>content.scrollTop=0);
   await mobile.screenshot({path:'test-results/controls-phone.png'});
   await mobile.getByRole('button',{name:'Start building',exact:true}).tap();
   const help=mobile.locator('.tool-rail').getByRole('button',{name:'Open controls',exact:true});
   await help.tap();assert.ok(await mobile.locator('.controls-dialog').isVisible());
   await mobile.getByRole('button',{name:'Close controls',exact:true}).tap();assert.equal(await mobile.locator('.controls-dialog').isVisible(),false);
  }finally{await mobileContext.close();}
 });
 assert.deepEqual(errors,[]);
 await writeFile('test-results/controls-browser.json',JSON.stringify({results,errors},null,2));
}catch(error){console.error(error,errors);await page.screenshot({path:'test-results/controls-failure.png',timeout:5000}).catch(()=>{});process.exitCode=1;}
finally{await browser.close();await server.stop();}
