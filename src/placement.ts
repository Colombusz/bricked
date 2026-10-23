import { BufferGeometry, Float32BufferAttribute, Line, LineBasicMaterial, LineLoop, Mesh, MeshPhysicalMaterial, PerspectiveCamera, Plane, Raycaster, Scene, Vector2, Vector3 } from 'three';
import { CONFIG } from './config';
import { dimensions, type Brick } from './bricks/catalog';
import { brickGeometry } from './bricks/geometry';
import { Grid, type GridHit } from './grid';
import { PlacementConstraints } from './placementConstraints';
import { snapWithHysteresis } from './snapping';
export { snapWithHysteresis } from './snapping';

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
  readonly locks = new PlacementConstraints();
  readonly guide: Line;
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
    this.outline.frustumCulled = false;
    const guideGeometry=new BufferGeometry();guideGeometry.setAttribute('position',new Float32BufferAttribute(new Float32Array(6),3));
    this.guide=new Line(guideGeometry,new LineBasicMaterial({color:0xd64937,transparent:true,opacity:0.7,depthTest:false}));
    this.guide.visible=false;this.guide.renderOrder=7;this.guide.frustumCulled=false;this.scene.add(this.guide);
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
    if (type) { this.ghost.geometry = brickGeometry(type); this.locks.clampHeight(dimensions({type,rotation:this.rotation}).height); }
    else this.locks.clear();
    this.update(); this.onChange();
  }
  holdAxis(held: boolean) { if(!this.selected||this.erasing)return;this.locks.holdAxis(held,this.candidate);this.update();this.onChange(); }
  toggleAxis() {if(!this.selected||this.erasing)return;this.locks.toggleAxis(this.candidate);this.update();this.onChange();}
  toggleLayer() {if(!this.selected||this.erasing)return;this.locks.toggleLayer(this.candidate);this.update();this.onChange();}
  stepLayer(direction: number) {if(!this.selected||this.erasing)return;this.locks.stepLayer(direction,this.candidate??{id:'ghost',type:this.selected,color:this.color,rotation:this.rotation,x:0,y:0,z:0});this.update();this.onChange();}
  rotate() { this.rotation = (this.rotation + 90) % 360; this.candidate = null; this.update(); this.onChange(); }
  setColor(color: string) {
    this.color = color;
    if (this.candidate) this.candidate.color = color;
    if (this.valid) { this.ghostMaterial.color.set(color); this.ghostMaterial.emissive.set(color); }
    this.onChange();
  }

  update() {
    this.ghost.visible = false; this.outline.visible = false; this.guide.visible = false;
    if (!this.active || this.blocked) { this.hit = null; return; }
    this.raycaster.setFromCamera(this.pointer, this.camera);
    this.hit = this.grid.raycast(this.raycaster.ray);
    if (this.erasing) {
      if (this.hit?.brick) { this.drawOutline(this.hit.brick); this.outlineMaterial.color.set('#e74c3c'); }
      return;
    }
    if (!this.selected) return;
    const template: Brick = { id: 'ghost', type: this.selected, color: this.color, rotation: this.rotation, x: 0, y: 0, z: 0 };
    if(this.locks.axisActive&&!this.locks.anchor&&this.hit)this.locks.capture(targetBrick(this.grid,this.hit,template,this.candidate??undefined));
    const layer=this.locks.planeLayer;
    if(layer!==null){
      const plane=new Plane(new Vector3(0,1,0),-layer*CONFIG.plateHeight);
      const point=this.raycaster.ray.intersectPlane(plane,new Vector3());
      if(!point){this.candidate=null;return;}
      const d=dimensions(template),half=CONFIG.baseplateSize/2;
      this.candidate=this.locks.apply(template,point.x+half-d.width/2,point.z+half-d.depth/2,this.candidate??undefined);
    } else {
      if(!this.hit){this.candidate=null;return;}
      this.candidate = targetBrick(this.grid, this.hit, template, this.candidate ?? undefined);
    }
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
    if(this.locks.axisActive&&this.locks.axis){
      const axis=this.locks.axis,p=this.ghost.position,y=p.y+0.03,half=CONFIG.baseplateSize/2;
      const positions=this.guide.geometry.getAttribute('position');
      positions.setXYZ(0,axis==='x'?-half:p.x,y,axis==='z'?-half:p.z);
      positions.setXYZ(1,axis==='x'?half:p.x,y,axis==='z'?half:p.z);positions.needsUpdate=true;
      (this.guide.material as LineBasicMaterial).color.set(axis==='x'?'#d64937':'#3b7ebe');this.guide.visible=true;
    }
  }

  private drawOutline(brick: Brick) {
    const d = dimensions(brick), half = CONFIG.baseplateSize / 2;
    const x = brick.x - half, z = brick.z - half, y = brick.y * CONFIG.plateHeight + 0.015;
    const positions = [x,y,z, x+d.width,y,z, x+d.width,y,z+d.depth, x,y,z+d.depth];
    if(!this.outline.geometry.getAttribute('position'))this.outline.geometry.setAttribute('position',new Float32BufferAttribute(positions,3));
    else {const attribute=this.outline.geometry.getAttribute('position');(attribute.array as Float32Array).set(positions);attribute.needsUpdate=true;}
    this.outline.visible = true;
  }

  commit() {
    this.update();
    if (this.blocked || !this.active || !this.candidate || !this.valid || this.erasing || !this.selected) return null;
    return { ...this.candidate, id: crypto.randomUUID() };
  }
}
