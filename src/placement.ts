import { BufferGeometry, Color, Float32BufferAttribute, Line, LineBasicMaterial, LineLoop, Mesh, MeshPhysicalMaterial, PerspectiveCamera, Plane, Raycaster, Scene, Vector2, Vector3 } from 'three';
import { CONFIG } from './config';
import { canMirror, dimensions, type Brick } from './bricks/catalog';
import { brickGeometry } from './bricks/geometry';
import { Grid, type GridHit } from './grid';
import { PlacementConstraints } from './placementConstraints';
import { snapWithHysteresis } from './snapping';
export { snapWithHysteresis } from './snapping';

export function targetBrick(grid: Grid, hit: GridHit, template: Brick, previous?: Brick, output: Brick = {...template}): Brick {
  const d = dimensions(template), half = CONFIG.gridOriginOffset;
  let x = snapWithHysteresis(hit.point.x + half - d.width / 2, previous?.x);
  let z = snapWithHysteresis(hit.point.z + half - d.depth / 2, previous?.z);
  let y = 0;
  if (hit.brick) {
    const b = hit.brick, bd = dimensions(b);
    if (hit.normal.y > 0) y = b.y + bd.height;
    else if (hit.normal.y < 0) y = b.y - d.height;
    else {
      y = b.y;
      if (hit.normal.x) x = hit.normal.x > 0 ? hit.cell.x + 1 : hit.cell.x - d.width;
      if (hit.normal.z) z = hit.normal.z > 0 ? hit.cell.z + 1 : hit.cell.z - d.depth;
    }
  }
  Object.assign(output,template);output.x=x;output.y=y;output.z=z;
  return grid.lift(output,output);
}

export class Placement {
  selected: string | null = 'bricks-2x4';
  color = '#e74c3c';
  rotation = 0;
  mirror = false;
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
  private template:Brick={id:'ghost',type:'bricks-2x4',color:this.color,rotation:0,mirror:false,x:0,y:0,z:0};
  private candidateBuffer:Brick={...this.template};
  private layerPlane=new Plane(new Vector3(0,1,0));
  private planePoint=new Vector3();
  private pointer = new Vector2();
  private raycaster = new Raycaster();
  private plasticColor=new Color(this.color);
  private ghostMaterial = new MeshPhysicalMaterial({ color: this.color, transparent: true, opacity: 0.52, roughness: 0.3, clearcoat: 0.7, depthWrite: false });
  private outlineMaterial = new LineBasicMaterial({ color: 0xe74c3c, transparent: true, opacity: 0.85, depthTest: false });
  onChange = () => {};

  constructor(private grid: Grid, private scene: Scene, private camera: PerspectiveCamera, canvas: HTMLCanvasElement) {
    this.ghost = new Mesh(brickGeometry(this.selected!), this.ghostMaterial);
    this.ghost.renderOrder = 5; this.ghost.visible = false; this.scene.add(this.ghost);
    const outlineGeometry=new BufferGeometry();outlineGeometry.setAttribute('position',new Float32BufferAttribute(new Float32Array(24),3));
    this.outline = new LineLoop(outlineGeometry, this.outlineMaterial);
    this.outline.renderOrder = 6; this.outline.visible = false; this.scene.add(this.outline);
    this.outline.frustumCulled = false;
    const guideGeometry=new BufferGeometry();guideGeometry.setAttribute('position',new Float32BufferAttribute(new Float32Array(6),3));
    this.guide=new Line(guideGeometry,new LineBasicMaterial({color:0xd64937,transparent:true,opacity:0.7,depthTest:false}));
    this.guide.visible=false;this.guide.renderOrder=7;this.guide.frustumCulled=false;this.scene.add(this.guide);
    let left=0,top=0,width=1,height=1;
    const measure=()=>{const rect=canvas.getBoundingClientRect();left=rect.left;top=rect.top;width=rect.width;height=rect.height;};measure();new ResizeObserver(measure).observe(canvas);
    window.addEventListener('pointermove', e => {
      this.setPointer((e.clientX-left)/width,(e.clientY-top)/height,e.target===canvas);
    });
    canvas.addEventListener('pointerleave', () => { this.active = false; this.update(); this.onChange(); });
    window.addEventListener('blur', () => { this.active = false; this.update(); this.onChange(); });
  }

  setPointer(x: number, y: number, active = true) {
    this.active = active; this.pointer.set(x * 2 - 1, -y * 2 + 1); this.update(); this.onChange();
  }

  select(type: string | null) {
    this.selected = type; this.erasing = false; this.candidate = null;
    if (type) { if(!canMirror(type))this.mirror=false;this.syncTemplate();this.ghost.geometry = brickGeometry(type,this.mirror); this.locks.clampHeight(dimensions(this.template).height); }
    else this.locks.clear();
    this.update(); this.onChange();
  }
  holdAxis(held: boolean) { if(!this.selected||this.erasing)return;this.locks.holdAxis(held,this.candidate);this.update();this.onChange(); }
  toggleAxis() {if(!this.selected||this.erasing)return;this.locks.toggleAxis(this.candidate);this.update();this.onChange();}
  toggleLayer() {if(!this.selected||this.erasing)return;this.locks.toggleLayer(this.candidate);this.update();this.onChange();}
  stepLayer(direction: number) {if(!this.selected||this.erasing)return;this.locks.stepLayer(direction,this.candidate??this.template);this.update();this.onChange();}
  rotate() { this.rotation = (this.rotation + 90) % 360; this.candidate = null; this.update(); this.onChange(); }
  toggleMirror() {if(!this.selected||this.erasing||!canMirror(this.selected))return;this.mirror=!this.mirror;this.ghost.geometry=brickGeometry(this.selected,this.mirror);this.candidate=null;this.update();this.onChange();}
  private syncTemplate(){const t=this.template;t.type=this.selected!;t.color=this.color;t.rotation=this.rotation;t.mirror=this.mirror;}
  setColor(color: string) {
    this.color = color;this.plasticColor.set(color);
    if (this.candidate) this.candidate.color = color;
    if (this.valid) { this.ghostMaterial.color.copy(this.plasticColor); this.ghostMaterial.emissive.copy(this.plasticColor); }
    this.onChange();
  }

  update() {
    this.ghost.visible = false; this.outline.visible = false; this.guide.visible = false;
    if (!this.active || this.blocked) { this.hit = null; return; }
    this.raycaster.setFromCamera(this.pointer, this.camera);
    this.hit = this.grid.raycast(this.raycaster.ray);
    if (this.erasing) {
      if (this.hit?.brick) { this.drawOutline(this.hit.brick); this.outlineMaterial.color.setHex(0xe74c3c); }
      return;
    }
    if (!this.selected) return;
    this.syncTemplate();const template=this.template;
    if(this.locks.axisActive&&!this.locks.anchor&&this.hit)this.locks.capture(targetBrick(this.grid,this.hit,template,this.candidate??undefined,this.candidateBuffer));
    const layer=this.locks.planeLayer;
    if(layer!==null){
      this.layerPlane.constant=-layer*CONFIG.plateHeight;
      const point=this.raycaster.ray.intersectPlane(this.layerPlane,this.planePoint);
      if(!point){this.candidate=null;return;}
      const d=dimensions(template),half=CONFIG.gridOriginOffset;
      this.candidate=this.locks.apply(template,point.x+half-d.width/2,point.z+half-d.depth/2,this.candidate??undefined,this.candidateBuffer);
    } else {
      if(!this.hit){this.candidate=null;return;}
      this.candidate = targetBrick(this.grid, this.hit, template, this.candidate ?? undefined,this.candidateBuffer);
    }
    const check = this.grid.validate(this.candidate, this.allowFloating);
    this.valid = check.valid; this.reason = check.reason;
    const d = dimensions(this.candidate), half = CONFIG.gridOriginOffset;
    this.ghost.position.set(this.candidate.x + d.width / 2 - half, this.candidate.y * CONFIG.plateHeight, this.candidate.z + d.depth / 2 - half);
    this.ghost.rotation.y = this.rotation * Math.PI / 180;
    if(this.valid){this.ghostMaterial.color.copy(this.plasticColor);this.ghostMaterial.emissive.copy(this.plasticColor);}
    else{this.ghostMaterial.color.setHex(0xf3343d);this.ghostMaterial.emissive.setHex(0xff1425);}
    this.ghostMaterial.emissiveIntensity = this.valid ? 0.12 : 0.4;
    this.ghost.visible = true;
    this.outlineMaterial.color.setHex(this.valid?0x365f79:0xe62438);
    this.drawOutline(this.candidate);
    if(this.locks.axisActive&&this.locks.axis){
      const axis=this.locks.axis,p=this.ghost.position,y=p.y+0.03,length=CONFIG.axisGuideLength;
      const positions=this.guide.geometry.getAttribute('position');
      positions.setXYZ(0,axis==='x'?p.x-length:p.x,y,axis==='z'?p.z-length:p.z);
      positions.setXYZ(1,axis==='x'?p.x+length:p.x,y,axis==='z'?p.z+length:p.z);positions.needsUpdate=true;
      (this.guide.material as LineBasicMaterial).color.setHex(axis==='x'?0xd64937:0x3b7ebe);this.guide.visible=true;
    }
  }

  private drawOutline(brick: Brick) {
    const d = dimensions(brick), half = CONFIG.gridOriginOffset;
    const x = brick.x - half, z = brick.z - half, y = brick.y * CONFIG.plateHeight + 0.015;
    const attribute=this.outline.geometry.getAttribute('position');
    for(let i=0;i<d.outline.length;i++)attribute.setXYZ(i,x+d.outline[i].x,y,z+d.outline[i].z);
    attribute.needsUpdate=true;this.outline.geometry.setDrawRange(0,d.outline.length);
    this.outline.visible = true;
  }

  commit() {
    this.update();
    if (this.blocked || !this.active || !this.candidate || !this.valid || this.erasing || !this.selected) return null;
    return { ...this.candidate, id: crypto.randomUUID() };
  }
}
