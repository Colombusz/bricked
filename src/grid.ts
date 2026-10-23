import { Box3, Ray, Vector3 } from 'three';
import { CONFIG } from './config';
import { dimensions, TYPES, type Brick } from './bricks/catalog';

export interface GridHit { brick: Brick | null; point: Vector3; normal: Vector3; cell: Vector3 }
export type Validity = { valid: boolean; reason: string };
const key = (x: number, y: number, z: number) => `${x},${y},${z}`;
export class Grid {
  readonly bricks = new Map<string, Brick>();
  readonly occupancy = new Map<string, string>();

  at(x: number, y: number, z: number) { const id = this.occupancy.get(key(x, y, z)); return id ? this.bricks.get(id) : undefined; }

  inBounds(brick: Brick) {
    const d = dimensions(brick), n = CONFIG.baseplateSize;
    return brick.x >= 0 && brick.z >= 0 && brick.y >= 0 && brick.x + d.width <= n && brick.z + d.depth <= n && brick.y + d.height <= CONFIG.maxBuildHeight;
  }

  collides(brick: Brick) {
    const d = dimensions(brick);
    for (let x = brick.x; x < brick.x + d.width; x++) for (let y = brick.y; y < brick.y + d.height; y++) for (let z = brick.z; z < brick.z + d.depth; z++) {
      if (this.occupancy.has(key(x, y, z))) return true;
    }
    return false;
  }

  supported(brick: Brick) {
    if (brick.y === 0) return true;
    const d = dimensions(brick);
    for (let x = brick.x; x < brick.x + d.width; x++) for (let z = brick.z; z < brick.z + d.depth; z++) {
      const below = this.at(x, brick.y - 1, z);
      if (below && TYPES.get(below.type)!.studs && below.y + dimensions(below).height === brick.y) return true;
    }
    return false;
  }

  validate(brick: Brick, allowFloating = false): Validity {
    if (!this.inBounds(brick)) return { valid: false, reason: 'Outside the playground' };
    if (this.collides(brick)) return { valid: false, reason: 'This space is occupied' };
    if (!allowFloating && !this.supported(brick)) return { valid: false, reason: 'Needs a stud underneath' };
    return { valid: true, reason: 'Click to place' };
  }

  lift(brick: Brick) {
    const next = { ...brick };
    while (this.collides(next) && next.y + dimensions(next).height < CONFIG.maxBuildHeight) next.y++;
    return next;
  }

  add(brick: Brick) {
    if (!this.inBounds(brick) || this.collides(brick) || this.bricks.has(brick.id)) return false;
    const d = dimensions(brick);
    this.bricks.set(brick.id, { ...brick });
    for (let x = brick.x; x < brick.x + d.width; x++) for (let y = brick.y; y < brick.y + d.height; y++) for (let z = brick.z; z < brick.z + d.depth; z++) this.occupancy.set(key(x, y, z), brick.id);
    return true;
  }

  remove(id: string) {
    const brick = this.bricks.get(id);
    if (!brick) return;
    const d = dimensions(brick);
    for (let x = brick.x; x < brick.x + d.width; x++) for (let y = brick.y; y < brick.y + d.height; y++) for (let z = brick.z; z < brick.z + d.depth; z++) this.occupancy.delete(key(x, y, z));
    this.bricks.delete(id); return brick;
  }

  clear() { this.bricks.clear(); this.occupancy.clear(); }
  snapshot() { return [...this.bricks.values()].map(brick => ({ ...brick })); }
  replace(bricks: Brick[]) { this.clear(); bricks.forEach(brick => this.add(brick)); }
  bounds() {
    const box = new Box3(), half = CONFIG.baseplateSize / 2;
    for (const brick of this.bricks.values()) {
      const d = dimensions(brick);
      box.expandByPoint(new Vector3(brick.x - half, brick.y * CONFIG.plateHeight, brick.z - half));
      box.expandByPoint(new Vector3(brick.x + d.width - half, (brick.y + d.height) * CONFIG.plateHeight + CONFIG.studHeight, brick.z + d.depth - half));
    }
    return box;
  }

  raycast(ray: Ray): GridHit | null {
    const n = CONFIG.baseplateSize;
    const origin = new Vector3(ray.origin.x + n / 2, ray.origin.y / CONFIG.plateHeight, ray.origin.z + n / 2);
    const direction = new Vector3(ray.direction.x, ray.direction.y / CONFIG.plateHeight, ray.direction.z);
    let enter = 0, exit = Infinity, entryAxis = 1;
    const limits = [n, CONFIG.maxBuildHeight, n];
    for (let axis = 0; axis < 3; axis++) {
      const o = origin.getComponent(axis), d = direction.getComponent(axis), limit = limits[axis];
      if (Math.abs(d) < 1e-10) { if (o < 0 || o >= limit) return this.baseHit(ray); continue; }
      const a = -o / d, b = (limit - o) / d;
      const near = Math.min(a, b), far = Math.max(a, b);
      if (near > enter) { enter = near; entryAxis = axis; }
      exit = Math.min(exit, far);
    }
    if (enter > exit || exit < 0) return this.baseHit(ray);
    const p = origin.clone().addScaledVector(direction, enter + 1e-7);
    const cell = new Vector3(Math.floor(p.x), Math.floor(p.y), Math.floor(p.z));
    const step = new Vector3(Math.sign(direction.x), Math.sign(direction.y), Math.sign(direction.z));
    const delta = new Vector3(...[direction.x, direction.y, direction.z].map(d => d === 0 ? Infinity : Math.abs(1 / d)) as [number, number, number]);
    const next = new Vector3();
    for (let axis = 0; axis < 3; axis++) {
      const d = direction.getComponent(axis), c = cell.getComponent(axis);
      next.setComponent(axis, d === 0 ? Infinity : ((c + (d > 0 ? 1 : 0)) - origin.getComponent(axis)) / d);
    }
    let t = enter, axis = entryAxis;
    while (t <= exit && cell.x >= 0 && cell.x < n && cell.y >= 0 && cell.y < CONFIG.maxBuildHeight && cell.z >= 0 && cell.z < n) {
      const brick = this.at(cell.x, cell.y, cell.z);
      if (brick) {
        const normal = new Vector3(); normal.setComponent(axis, -step.getComponent(axis));
        return { brick, point: ray.at(t, new Vector3()), normal, cell: cell.clone() };
      }
      axis = next.x < next.y ? (next.x < next.z ? 0 : 2) : (next.y < next.z ? 1 : 2);
      t = next.getComponent(axis);
      cell.setComponent(axis, cell.getComponent(axis) + step.getComponent(axis));
      next.setComponent(axis, next.getComponent(axis) + delta.getComponent(axis));
    }
    return this.baseHit(ray);
  }

  private baseHit(ray: Ray): GridHit | null {
    if (ray.direction.y >= -1e-8) return null;
    const t = -ray.origin.y / ray.direction.y;
    if (t < 0) return null;
    const p = ray.at(t, new Vector3()), half = CONFIG.baseplateSize / 2;
    // Keep a one-footprint apron targetable so out-of-bounds placements show red.
    if (Math.abs(p.x) > half + 6 || Math.abs(p.z) > half + 6) return null;
    return { brick: null, point: p, normal: new Vector3(0, 1, 0), cell: new Vector3(Math.floor(p.x + half), 0, Math.floor(p.z + half)) };
  }
}
