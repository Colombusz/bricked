import { COLORS } from '../../bricks/catalog';
import { CONFIG } from '../../config';
import { readJSON, writeJSON } from '../../storage';

export interface Palette { id: string; name: string; colors: string[] }
export interface PaletteState { version: 1; palettes: Palette[]; activeId: string; selectedColor: string; recent: string[] }
export type PaletteChange = 'color' | 'palette' | 'recent';
export const CLASSIC: Palette = {id:'classic', name:'Classic', colors:COLORS.map(c=>c.hex)};
export const isHex = (value: unknown): value is string => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
export function normalizeHex(value: string) {
  const hex = value.trim().replace(/^#/, '');
  if (/^[0-9a-f]{6}$/i.test(hex)) return `#${hex.toLowerCase()}`;
  if (/^[0-9a-f]{3}$/i.test(hex)) return `#${[...hex.toLowerCase()].map(c=>c+c).join('')}`;
  return null;
}
const defaults = (): PaletteState => ({version:1, palettes:[], activeId:'classic', selectedColor:CLASSIC.colors[0], recent:[]});
export function validatePaletteState(data: unknown): PaletteState {
  if (!data || typeof data !== 'object') return defaults();
  const d = data as Record<string,unknown>;
  if (d.version !== 1 || !Array.isArray(d.palettes) || d.palettes.length >= CONFIG.maxPalettes || !isHex(d.selectedColor) || !Array.isArray(d.recent) || d.recent.length > CONFIG.maxRecentColors || !d.recent.every(isHex)) return defaults();
  const ids = new Set(['classic']), palettes: Palette[] = [];
  for (const value of d.palettes) {
    if (!value || typeof value !== 'object') return defaults();
    const p = value as Record<string,unknown>;
    if (typeof p.id !== 'string' || !p.id || p.id.length > 100 || ids.has(p.id) || typeof p.name !== 'string' || !p.name.trim() || p.name.length > 40 || !Array.isArray(p.colors) || p.colors.length > CONFIG.maxPaletteColors || !p.colors.every(isHex)) return defaults();
    ids.add(p.id); palettes.push({id:p.id, name:p.name.trim(), colors:[...new Set(p.colors.map(c=>c.toLowerCase()))]});
  }
  return {version:1, palettes, activeId:typeof d.activeId === 'string' && ids.has(d.activeId) ? d.activeId : 'classic', selectedColor:d.selectedColor.toLowerCase(), recent:[...new Set((d.recent as string[]).map(c=>c.toLowerCase()))]};
}

export class PaletteStore {
  private state = validatePaletteState(readJSON(CONFIG.paletteStorageKey));
  private listeners = new Set<(change: PaletteChange) => void>();
  get palettes() { return [CLASSIC, ...this.state.palettes]; }
  get active() { return this.palettes.find(p=>p.id === this.state.activeId)!; }
  get selectedColor() { return this.state.selectedColor; }
  get recent() { return this.state.recent; }
  get editable() { return this.active.id !== 'classic'; }
  subscribe(listener: (change: PaletteChange) => void) { this.listeners.add(listener); return () => this.listeners.delete(listener); }
  private changed(change: PaletteChange) { writeJSON(CONFIG.paletteStorageKey,this.state); this.listeners.forEach(listener=>listener(change)); }
  selectColor(color: string) { if (!isHex(color) || this.selectedColor === color.toLowerCase()) return; this.state.selectedColor=color.toLowerCase(); this.changed('color'); }
  selectPalette(id: string) { if (!this.palettes.some(p=>p.id===id)) return; this.state.activeId=id; this.changed('palette'); }
  create(name: string, colors: string[] = []): string | null {
    if (this.palettes.length >= CONFIG.maxPalettes) return `You can save up to ${CONFIG.maxPalettes} palettes.`;
    if (!name.trim()) return 'Give your palette a name.';
    const palette = {id:crypto.randomUUID(), name:name.trim().slice(0,40), colors:[...new Set(colors.filter(isHex).map(c=>c.toLowerCase()))].slice(0,CONFIG.maxPaletteColors)};
    this.state.palettes.push(palette); this.state.activeId=palette.id; this.changed('palette'); return null;
  }
  rename(name: string) { if (!this.editable) return 'Classic is read-only. Duplicate it to make a copy.'; if (!name.trim()) return 'Give your palette a name.'; this.active.name=name.trim().slice(0,40); this.changed('palette'); return null; }
  duplicate() { return this.create(`${this.active.name.slice(0,35)} copy`,this.active.colors); }
  deleteActive() {
    if (!this.editable) return;
    this.state.palettes=this.state.palettes.filter(p=>p.id!==this.active.id); this.state.activeId='classic'; this.changed('palette');
  }
  addColor() {
    if (!this.editable) {
      const mine=this.state.palettes.find(p=>p.name==='My colors');
      if (mine) this.state.activeId=mine.id;
      else { const error=this.create('My colors'); if (error) return error; }
    }
    if (this.active.colors.includes(this.selectedColor)) { this.changed('palette'); return null; }
    if (this.active.colors.length >= CONFIG.maxPaletteColors) { this.changed('palette'); return `A palette holds up to ${CONFIG.maxPaletteColors} colors.`; }
    this.active.colors.push(this.selectedColor); this.changed('palette'); return null;
  }
  removeColor(color: string) { if (!this.editable) return; this.active.colors=this.active.colors.filter(c=>c!==color); this.changed('palette'); }
  recordUsed(color: string) { if (!isHex(color)) return; const hex=color.toLowerCase(); this.state.recent=[hex,...this.recent.filter(c=>c!==hex)].slice(0,CONFIG.maxRecentColors); this.changed('recent'); }
}
