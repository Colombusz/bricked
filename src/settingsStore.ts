import { CONFIG, DEFAULT_SETTINGS } from './config';
import { readJSON, readText, writeJSON } from './storage';

export type Settings = typeof DEFAULT_SETTINGS;
export function validateSettings(data: unknown): Settings {
  if(!data||typeof data!=='object')return {...DEFAULT_SETTINGS};
  const d=data as Record<string,unknown>;
  if(d.version!==1||!d.values||typeof d.values!=='object')return {...DEFAULT_SETTINGS};
  const values=d.values as Record<string,unknown>;
  for(const [key,initial] of Object.entries(DEFAULT_SETTINGS)){
    const value=values[key];
    if(typeof initial==='boolean'){if(typeof value!=='boolean')return {...DEFAULT_SETTINGS};}
    else if(typeof value!=='number'||!Number.isFinite(value)||value<CONFIG.sensitivityMin||value>CONFIG.sensitivityMax)return {...DEFAULT_SETTINGS};
  }
  return Object.fromEntries(Object.keys(DEFAULT_SETTINGS).map(key=>[key,values[key]])) as Settings;
}
export class SettingsStore {
  value: Settings;
  private listeners=new Set<(settings: Settings)=>void>();
  constructor(){
    const stored=readJSON(CONFIG.settingsStorageKey);this.value=validateSettings(stored);
    if(readText(CONFIG.settingsStorageKey)===null&&readText('bricked.muted')==='true')this.value.sound=false;
  }
  subscribe(listener:(settings: Settings)=>void){this.listeners.add(listener);return()=>this.listeners.delete(listener);}
  set<K extends keyof Settings>(key:K,value:Settings[K]) {
    if(typeof DEFAULT_SETTINGS[key]==='number'){
      if(typeof value!=='number'||!Number.isFinite(value))return;
      value=Number((Math.round(Math.max(CONFIG.sensitivityMin,Math.min(CONFIG.sensitivityMax,value))/CONFIG.sensitivityStep)*CONFIG.sensitivityStep).toFixed(2)) as Settings[K];
    }else if(typeof value!=='boolean')return;
    this.value={...this.value,[key]:value};this.changed();
  }
  reset(){this.value={...DEFAULT_SETTINGS};this.changed();}
  private changed(){writeJSON(CONFIG.settingsStorageKey,{version:1,values:this.value});this.listeners.forEach(listener=>listener(this.value));}
}
