import { Box3, Ray, Vector3 } from 'three';
import { CONFIG } from './config';
import { dimensions, TYPES, type Brick } from './bricks/catalog';

export interface GridHit { brick: Brick | null; point: Vector3; normal: Vector3; cell: Vector3 }
export type Validity = { readonly valid: boolean; readonly reason: string };
const OUTSIDE:Validity={valid:false,reason:'Outside the playground'},OCCUPIED:Validity={valid:false,reason:'This space is occupied'},UNSUPPORTED:Validity={valid:false,reason:'Needs a stud underneath'},VALID:Validity={valid:true,reason:'Click to place'};
class Occupancy {
  private rows=new Map<number,Map<number,Map<number,string>>>();
  size=0;
  get(x:number,y:number,z:number){return this.rows.get(x)?.get(z)?.get(y);}
  set(x:number,y:number,z:number,id:string){
    let row=this.rows.get(x);if(!row){row=new Map();this.rows.set(x,row);}
    let column=row.get(z);if(!column){column=new Map();row.set(z,column);}
    if(!column.has(y))this.size++;column.set(y,id);
  }
  delete(x:number,y:number,z:number){
    const row=this.rows.get(x),column=row?.get(z);if(!column?.delete(y))return;
    this.size--;if(!column.size)row!.delete(z);if(!row!.size)this.rows.delete(x);
  }
  clear(){this.rows.clear();this.size=0;}
}
export class Grid {
  readonly bricks = new Map<string, Brick>();
  readonly occupancy = new Occupancy();
  private cellBounds=new Box3();
  private boundsPoint=new Vector3();
  private boundsDirty=false;

  at(x: number, y: number, z: number) {
    if(y<0||y>=CONFIG.maxBuildHeight)return;
    const id = this.occupancy.get(x, y, z); return id ? this.bricks.get(id) : undefined;
  }

  inBounds(brick: Brick) {
    const d=dimensions(brick);
    return Number.isSafeInteger(brick.x)&&Number.isSafeInteger(brick.z)&&Number.isSafeInteger(brick.y)&&Number.isSafeInteger(brick.x+d.width)&&Number.isSafeInteger(brick.z+d.depth)&&brick.y>=0&&brick.y+d.height<=CONFIG.maxBuildHeight;
  }

  collides(brick: Brick) {
    const d = dimensions(brick);
    for (let i=0;i<d.cells.length;i++) {
      const cell=d.cells[i];
      for (let y = brick.y; y < brick.y + d.height; y++) if (this.at(brick.x+cell.x, y, brick.z+cell.z)) return true;
    }
    return false;
  }

  supported(brick: Brick) {
    if (brick.y === 0) return true;
    const d = dimensions(brick);
    for (let i=0;i<d.cells.length;i++) {
      const cell=d.cells[i];
      const below = this.at(brick.x+cell.x, brick.y - 1, brick.z+cell.z);
      if (below && TYPES.get(below.type)!.studs && below.y + dimensions(below).height === brick.y) return true;
    }
    return false;
  }

  validate(brick: Brick, allowFloating = false): Validity {
    if (!this.inBounds(brick)) return OUTSIDE;
    if (this.collides(brick)) return OCCUPIED;
    if (!allowFloating && !this.supported(brick)) return UNSUPPORTED;
    return VALID;
  }

  lift(brick: Brick, next: Brick = { ...brick }) {
    if(next!==brick)Object.assign(next,brick);
    while (this.collides(next) && next.y + dimensions(next).height < CONFIG.maxBuildHeight) next.y++;
    return next;
  }

  add(brick: Brick) {
    if (!this.inBounds(brick) || this.collides(brick) || this.bricks.has(brick.id)) return false;
    const d = dimensions(brick);
    this.bricks.set(brick.id, { ...brick });
    for (const cell of d.cells) for (let y = brick.y; y < brick.y + d.height; y++) this.occupancy.set(brick.x+cell.x, y, brick.z+cell.z, brick.id);
    this.boundsDirty=true;return true;
  }

  remove(id: string) {
    const brick = this.bricks.get(id);
    if (!brick) return;
    const d = dimensions(brick);
    for (const cell of d.cells) for (let y = brick.y; y < brick.y + d.height; y++) this.occupancy.delete(brick.x+cell.x, y, brick.z+cell.z);
    this.bricks.delete(id);this.boundsDirty=true; return brick;
  }

  clear() { this.bricks.clear(); this.occupancy.clear();this.cellBounds.makeEmpty();this.boundsDirty=false; }
  snapshot() { return [...this.bricks.values()].map(brick => ({ ...brick })); }
  replace(bricks: Brick[]) { this.clear(); bricks.forEach(brick => this.add(brick)); }
  bounds() {
    const box = new Box3(), half = CONFIG.gridOriginOffset;
    for (const brick of this.bricks.values()) {
      const d = dimensions(brick);
      for(const cell of d.cells){
        box.expandByPoint(new Vector3(brick.x+cell.x-half,brick.y*CONFIG.plateHeight,brick.z+cell.z-half));
        box.expandByPoint(new Vector3(brick.x+cell.x+1-half,(brick.y+d.height)*CONFIG.plateHeight+(TYPES.get(brick.type)!.studs?CONFIG.studHeight:0),brick.z+cell.z+1-half));
      }
    }
    return box;
  }

  private rayOrigin=new Vector3();
  private rayDirection=new Vector3();
  private rayCell=new Vector3();
  private rayStep=new Vector3();
  private rayDelta=new Vector3();
  private rayNext=new Vector3();
  private rayPoint=new Vector3();
  private rayHit:GridHit={brick:null,point:new Vector3(),normal:new Vector3(),cell:new Vector3()};

  private updateCellBounds(){
    if(!this.boundsDirty)return;
    this.cellBounds.makeEmpty();
    for(const brick of this.bricks.values()){
      const d=dimensions(brick);
      this.cellBounds.expandByPoint(this.boundsPoint.set(brick.x,brick.y,brick.z));
      this.cellBounds.expandByPoint(this.boundsPoint.set(brick.x+d.width,brick.y+d.height,brick.z+d.depth));
    }
    this.boundsDirty=false;
  }
  // Clip to occupied bounds first, then walk exact cells. Coordinates have no horizontal boundary.
  raycast(ray: Ray): GridHit | null {
    if(!this.bricks.size)return this.baseHit(ray);
    this.updateCellBounds();
    const origin=this.rayOrigin.copy(ray.origin),direction=this.rayDirection.copy(ray.direction);
    origin.x+=CONFIG.gridOriginOffset;origin.z+=CONFIG.gridOriginOffset;origin.y/=CONFIG.plateHeight;direction.y/=CONFIG.plateHeight;
    let enter=0,entryAxis=1;
    let exit:number=CONFIG.worldViewDistance;
    const min=this.cellBounds.min,max=this.cellBounds.max;
    for(let axis=0;axis<3;axis++){
      const o=origin.getComponent(axis),d=direction.getComponent(axis),lo=min.getComponent(axis),hi=max.getComponent(axis);
      if(Math.abs(d)<1e-10){if(o<lo||o>=hi)return this.baseHit(ray);continue;}
      const a=(lo-o)/d,b=(hi-o)/d,near=Math.min(a,b),far=Math.max(a,b);
      if(near>enter){enter=near;entryAxis=axis;}exit=Math.min(exit,far);
    }
    if(enter>exit||exit<0)return this.baseHit(ray);
    const p=this.rayPoint.copy(origin).addScaledVector(direction,enter+1e-7),cell=this.rayCell.set(Math.floor(p.x),Math.floor(p.y),Math.floor(p.z));
    const step=this.rayStep,delta=this.rayDelta,next=this.rayNext;
    for(let axis=0;axis<3;axis++){
      const d=direction.getComponent(axis),c=cell.getComponent(axis);
      step.setComponent(axis,Math.sign(d));delta.setComponent(axis,d===0?Infinity:Math.abs(1/d));
      next.setComponent(axis,d===0?Infinity:((c+(d>0?1:0))-origin.getComponent(axis))/d);
    }
    let t=enter,axis=entryAxis;
    while(t<=exit&&cell.y>=0&&cell.y<CONFIG.maxBuildHeight){
      const brick=this.at(cell.x,cell.y,cell.z);
      if(brick){const hit=this.rayHit;hit.brick=brick;ray.at(t,hit.point);hit.normal.set(0,0,0).setComponent(axis,-step.getComponent(axis));hit.cell.copy(cell);return hit;}
      axis=next.x<next.y?(next.x<next.z?0:2):(next.y<next.z?1:2);t=next.getComponent(axis);
      cell.setComponent(axis,cell.getComponent(axis)+step.getComponent(axis));next.setComponent(axis,next.getComponent(axis)+delta.getComponent(axis));
    }
    return this.baseHit(ray);
  }
  private baseHit(ray:Ray):GridHit|null{
    if(ray.direction.y>=-1e-8)return null;
    const t=-ray.origin.y/ray.direction.y;if(t<0||t>CONFIG.worldViewDistance)return null;
    const hit=this.rayHit,p=ray.at(t,hit.point),half=CONFIG.gridOriginOffset;
    hit.brick=null;hit.normal.set(0,1,0);hit.cell.set(Math.floor(p.x+half),0,Math.floor(p.z+half));return hit;
  }
}
