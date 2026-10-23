import { BufferGeometry, LatheGeometry, Vector2 } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG } from '../config';
import { TYPES, type BrickType } from './catalog';

const geometries = new Map<string, BufferGeometry>();
export function createStudGeometry(segments = 16) {
  const r = CONFIG.studRadius;
  return new LatheGeometry([
    new Vector2(0, 0), new Vector2(r - 0.015, 0), new Vector2(r, 0.018),
    new Vector2(r, CONFIG.studHeight - 0.025), new Vector2(r - 0.008, CONFIG.studHeight - 0.008),
    new Vector2(r - 0.025, CONFIG.studHeight), new Vector2(0, CONFIG.studHeight),
  ], segments);
}
export function brickGeometry(type: BrickType | string) {
  if (typeof type === 'string') type = TYPES.get(type)!;
  const cached = geometries.get(type.id);
  if (cached) return cached;
  const h = type.height * CONFIG.plateHeight;
  const body = new RoundedBoxGeometry(type.width - CONFIG.seam, h - 0.014, type.depth - CONFIG.seam, 1, 0.045);
  body.translate(0, h / 2, 0);
  const parts: BufferGeometry[] = [body];
  if (type.studs) {
    const stud = createStudGeometry();
    for (let x = 0; x < type.width; x++) for (let z = 0; z < type.depth; z++) {
      const copy = stud.clone().toNonIndexed();
      copy.translate(x - type.width / 2 + 0.5, h - 0.007, z - type.depth / 2 + 0.5);
      parts.push(copy);
    }
    stud.dispose();
  }
  const combined = mergeGeometries(parts, false)!;
  const merged = mergeVertices(combined);
  combined.dispose();
  parts.forEach(part => part.dispose());
  merged.computeBoundingSphere(); geometries.set(type.id, merged);
  return merged;
}
