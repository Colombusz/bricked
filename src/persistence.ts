import { TYPES, type Brick } from './bricks/catalog';
import { CONFIG } from './config';
import { Grid } from './grid';

export interface BuildFile { version: 1; name: string; bricks: Brick[] }
export function parseBuild(text: string): BuildFile {
  if (text.length > 5_000_000) throw new Error('This file is too large. Use a build under 5 MB.');
  let data: unknown;
  try { data = JSON.parse(text); } catch { throw new Error('This is not valid JSON. Choose a Bricked build file.'); }
  if (!data || typeof data !== 'object') throw new Error('Choose a Bricked build file.');
  const file = data as Record<string, unknown>;
  if (file.version !== 1 || !Array.isArray(file.bricks) || file.bricks.length > 10000) throw new Error('Use a version 1 Bricked file with at most 10,000 pieces.');
  const grid = new Grid();
  const bricks: Brick[] = [];
  for (const item of file.bricks) {
    if (!item || typeof item !== 'object') throw new Error('The build contains an invalid piece.');
    const b = item as Record<string, unknown>;
    if (typeof b.id !== 'string' || b.id.length > 100 || !b.id || typeof b.type !== 'string' || !TYPES.has(b.type) || typeof b.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(b.color)
      || ![0,90,180,270].includes(b.rotation as number) || ![b.x,b.y,b.z].every(v => typeof v === 'number' && Number.isInteger(v))) throw new Error('The build contains an invalid piece or grid position.');
    const brick: Brick = { id: b.id, type: b.type, color: b.color, rotation: b.rotation as number, x: b.x as number, y: b.y as number, z: b.z as number };
    if (!grid.add(brick)) throw new Error('The build contains overlapping pieces or pieces outside the playground.');
    bricks.push(brick);
  }
  return { version: 1, name: typeof file.name === 'string' ? file.name.slice(0,60) : 'Untitled build', bricks };
}
export function loadBuild(): BuildFile | null {
  const stored = localStorage.getItem(CONFIG.autosaveKey);
  return stored ? parseBuild(stored) : null;
}
export function saveBuild(name: string, bricks: Brick[]) { localStorage.setItem(CONFIG.autosaveKey, JSON.stringify({ version:1, name, bricks })); }
export function exportBuild(name: string, bricks: Brick[]) {
  const blob = new Blob([JSON.stringify({ version:1, name, bricks },null,2)], { type:'application/json' });
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = `${name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'bricked-build'}.json`;
  link.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
}
