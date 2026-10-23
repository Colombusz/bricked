import { BufferGeometry, Float32BufferAttribute, LineBasicMaterial, LineLoop, Mesh, MeshPhysicalMaterial, PerspectiveCamera, Raycaster, Scene, Vector2 } from 'three';
import { CONFIG } from './config';
import { dimensions, type Brick } from './bricks/catalog';
import { brickGeometry } from './bricks/geometry';
import { Grid, type GridHit } from './grid';

export function snapWithHysteresis(raw: number, previous: number | undefined, hysteresis = CONFIG.snapHysteresis) {
  if (previous !== undefined && Math.abs(raw - previous) <= 0.5 + hysteresis) return previous;
  return Math.round(raw);
}

export function targetBrick(grid: Grid, hit: GridHit, template: Brick, previous?: Brick): Brick {
  const d = dimensions(template), half = CONFIG.baseplateSize / 2;
  let x = snapWithHysteresis(hit.point.x + half - d.width / 2, previous?.x);
  let z = snapWithHysteresis(hit.point.z + half - d.depth / 2, previous?.z);
  let y = 0;
  if (hit.brick) {
    const b = hit.brick, bd = dimensions(b);
    if (hit.normal.y > 0) y = b.y + bd.height;
    else if (hit.normal.y < 0) y = b.y - d.height;
    else {
      y = b.y;
      if (hit.normal.x) x = hit.normal.x > 0 ? b.x + bd.width : b.x - d.width;
      if (hit.normal.z) z = hit.normal.z > 0 ? b.z + bd.depth : b.z - d.depth;
    }
  }
  return grid.lift({ ...template, x, y, z });
}

export class Placement {
  selected: string | null = 'bricks-2x4';
  color = '#e74c3c';
  rotation = 0;
  allowFloating = false;
  erasing = false;
  active = false;
  blocked = false;
  candidate: Brick | null = null;
  hit: GridHit | null = null;
  valid = false;
  reason = '';
  readonly ghost: Mesh;
  readonly outline: LineLoop;
  private pointer = new Vector2();
  private raycaster = new Raycaster();
  private ghostMaterial = new MeshPhysicalMaterial({ color: this.color, transparent: true, opacity: 0.52, roughness: 0.3, clearcoat: 0.7, depthWrite: false });
  private outlineMaterial = new LineBasicMaterial({ color: 0xe74c3c, transparent: true, opacity: 0.85, depthTest: false });
  onChange = () => {};

  constructor(private grid: Grid, private scene: Scene, private camera: PerspectiveCamera, canvas: HTMLCanvasElement) {
    this.ghost = new Mesh(brickGeometry(this.selected!), this.ghostMaterial);
    this.ghost.renderOrder = 5; this.ghost.visible = false; this.scene.add(this.ghost);
    this.outline = new LineLoop(new BufferGeometry(), this.outlineMaterial);
    this.outline.renderOrder = 6; this.outline.visible = false; this.scene.add(this.outline);
    window.addEventListener('pointermove', e => {
      const rect = canvas.getBoundingClientRect();
      this.setPointer((e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height, e.target === canvas);
    });
    canvas.addEventListener('pointerleave', () => { this.active = false; this.update(); this.onChange(); });
    window.addEventListener('blur', () => { this.active = false; this.update(); this.onChange(); });
  }

  setPointer(x: number, y: number, active = true) {
    this.active = active; this.pointer.set(x * 2 - 1, -y * 2 + 1); this.update(); this.onChange();
  }

  select(type: string | null) {
    this.selected = type; this.erasing = false; this.candidate = null;
    if (type) this.ghost.geometry = brickGeometry(type);
    this.update(); this.onChange();
  }
  rotate() { this.rotation = (this.rotation + 90) % 360; this.candidate = null; this.update(); this.onChange(); }
  setColor(color: string) { this.color = color; this.update(); this.onChange(); }

  update() {
    this.ghost.visible = false; this.outline.visible = false;
    if (!this.active || this.blocked) { this.hit = null; return; }
    this.raycaster.setFromCamera(this.pointer, this.camera);
    this.hit = this.grid.raycast(this.raycaster.ray);
    if (!this.hit) { this.candidate = null; return; }
    if (this.erasing) {
      if (this.hit.brick) { this.drawOutline(this.hit.brick); this.outlineMaterial.color.set('#e74c3c'); }
      return;
    }
    if (!this.selected) return;
    const template: Brick = { id: 'ghost', type: this.selected, color: this.color, rotation: this.rotation, x: 0, y: 0, z: 0 };
    this.candidate = targetBrick(this.grid, this.hit, template, this.candidate ?? undefined);
    const check = this.grid.validate(this.candidate, this.allowFloating);
    this.valid = check.valid; this.reason = check.reason;
    const d = dimensions(this.candidate), half = CONFIG.baseplateSize / 2;
    this.ghost.position.set(this.candidate.x + d.width / 2 - half, this.candidate.y * CONFIG.plateHeight, this.candidate.z + d.depth / 2 - half);
    this.ghost.rotation.y = this.rotation * Math.PI / 180;
    this.ghostMaterial.color.set(this.valid ? this.color : '#f3343d');
    this.ghostMaterial.emissive.set(this.valid ? this.color : '#ff1425');
    this.ghostMaterial.emissiveIntensity = this.valid ? 0.12 : 0.4;
    this.ghost.visible = true;
    this.outlineMaterial.color.set(this.valid ? '#365f79' : '#e62438');
    this.drawOutline(this.candidate);
  }

  private drawOutline(brick: Brick) {
    const d = dimensions(brick), half = CONFIG.baseplateSize / 2;
    const x = brick.x - half, z = brick.z - half, y = brick.y * CONFIG.plateHeight + 0.015;
    const positions = [x,y,z, x+d.width,y,z, x+d.width,y,z+d.depth, x,y,z+d.depth];
    this.outline.geometry.dispose();
    this.outline.geometry = new BufferGeometry();
    this.outline.geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
    this.outline.visible = true;
  }

  commit() {
    this.update();
    if (this.blocked || !this.active || !this.candidate || !this.valid || this.erasing || !this.selected) return null;
    return { ...this.candidate, id: crypto.randomUUID() };
  }
}
