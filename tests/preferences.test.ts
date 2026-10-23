import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PaletteStore, validatePaletteState, normalizeHex, CLASSIC} from '../src/ui/colorPanel/paletteStore';
import {hsvToHex, hexToHSV} from '../src/ui/colorPanel/colorWheel';
import {CONFIG} from '../src/config';
import {readJSON,writeJSON} from '../src/storage';
import {SettingsStore,validateSettings} from '../src/settingsStore';
import {DEFAULT_SETTINGS} from '../src/config';

const memory=new Map<string,string>();
Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>memory.get(key)??null,setItem:(key:string,value:string)=>memory.set(key,value)}});

test('HSV maps primaries, gray, black and arbitrary color round trips',()=>{
 assert.equal(hsvToHex({h:0,s:1,v:1}),'#ff0000');assert.equal(hsvToHex({h:120,s:1,v:1}),'#00ff00');assert.equal(hsvToHex({h:240,s:1,v:1}),'#0000ff');
 for(const color of ['#12ab89','#394f82','#000000','#ffffff','#777777'])assert.equal(hsvToHex(hexToHSV(color)),color);
 assert.equal(normalizeHex('aBc'),'#aabbcc');assert.equal(normalizeHex('#12ab89'),'#12ab89');assert.equal(normalizeHex('banana'),null);
});
test('palette data validation rejects corruption and forged Classic overrides',()=>{
 assert.equal(validatePaletteState(null).activeId,'classic');
 const valid={version:1,palettes:[{id:'mine',name:'Mine',colors:['#aabbcc']}],activeId:'mine',selectedColor:'#112233',recent:['#aabbcc']};
 assert.equal(validatePaletteState(valid).activeId,'mine');
 assert.equal(validatePaletteState({...valid,selectedColor:'red'}).activeId,'classic');
 assert.equal(validatePaletteState({...valid,palettes:[{id:'classic',name:'Fake',colors:[]}]}).palettes.length,0);
 assert.equal(validatePaletteState({...valid,palettes:[{id:'mine',name:'Mine',colors:['bad']}]}).palettes.length,0);
});
test('Classic remains read-only, Add creates My colors and ignores duplicates',()=>{
 memory.clear();const store=new PaletteStore();const classic=[...CLASSIC.colors];
 assert.ok(store.rename('Other'));store.deleteActive();assert.equal(store.active.id,'classic');
 store.selectColor('#12ab89');assert.equal(store.addColor(),null);assert.equal(store.active.name,'My colors');assert.deepEqual(store.active.colors,['#12ab89']);
 store.addColor();assert.equal(store.active.colors.length,1);store.removeColor('#12ab89');assert.equal(store.active.colors.length,0);
 assert.deepEqual(CLASSIC.colors,classic);
});
test('palette limits are enforced, recent means placed colors, preferences survive load',()=>{
 memory.clear();const store=new PaletteStore();store.create('Many colors');
 for(let i=0;i<CONFIG.maxPaletteColors;i++){store.selectColor(`#${i.toString(16).padStart(6,'0')}`);assert.equal(store.addColor(),null);}
 store.selectColor('#aabbcc');assert.ok(store.addColor());assert.equal(store.active.colors.length,CONFIG.maxPaletteColors);
 assert.equal(store.recent.length,0);for(let i=0;i<20;i++)store.recordUsed(`#${i.toString(16).padStart(6,'0')}`);
 assert.equal(store.recent.length,12);store.recordUsed('#000010');assert.equal(store.recent[0],'#000010');assert.equal(new Set(store.recent).size,store.recent.length);
 const restored=new PaletteStore();assert.equal(restored.selectedColor,'#aabbcc');assert.equal(restored.active.name,'Many colors');assert.deepEqual(restored.recent,store.recent);
 for(let i=store.palettes.length;i<CONFIG.maxPalettes;i++)assert.equal(store.create(`Palette ${i}`),null);
 assert.ok(store.create('One too many'));assert.equal(store.palettes.length,CONFIG.maxPalettes);
});
test('safe storage falls back without access and malformed JSON never escapes',()=>{
 memory.set('broken','{bad');assert.equal(readJSON('broken'),null);
 const previous=Object.getOwnPropertyDescriptor(globalThis,'localStorage')!;
 Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw new Error('Unavailable')}});
 assert.equal(readJSON('any'),null);assert.equal(writeJSON('any',{}),false);const store=new PaletteStore();store.selectColor('#12ab89');assert.equal(store.selectedColor,'#12ab89');assert.equal(store.create('Memory only'),null);
 Object.defineProperty(globalThis,'localStorage',previous);
});
test('settings validate ranges, persist all controls, clamp updates, and reset independently',()=>{
 memory.clear();assert.deepEqual(validateSettings({version:1,values:{...DEFAULT_SETTINGS,master:99}}),DEFAULT_SETTINGS);
 assert.deepEqual(validateSettings({version:1,values:{...DEFAULT_SETTINGS,rotation:NaN}}),DEFAULT_SETTINGS);
 const store=new SettingsStore();store.set('master',2);store.set('pan',.5);store.set('allowFloating',true);store.set('sound',false);
 const restored=new SettingsStore();assert.equal(restored.value.master,2);assert.equal(restored.value.pan,.5);assert.equal(restored.value.allowFloating,true);assert.equal(restored.value.sound,false);
 restored.set('master',99);assert.equal(restored.value.master,3);restored.reset();assert.deepEqual(restored.value,DEFAULT_SETTINGS);
});
