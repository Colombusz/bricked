import { Color, DynamicDrawUsage, InstancedMesh, MeshPhysicalMaterial, Object3D, Scene } from 'three';
import { CONFIG } from '../config';
import { TYPES, dimensions, type Brick } from './catalog';
import { brickGeometry } from './geometry';

interface Batch { mesh: InstancedMesh; capacity: number; bricks: Brick[] }
export class BrickRenderer {
  private batches = new Map<string, Batch>();
  private transforms = new Object3D();
  private animations = new Map<string, number>();
  readonly material = new MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.25, metalness: 0, clearcoat: 0.8, clearcoatRoughness: 0.15 });
  constructor(private scene: Scene) {}
  clear() {
    this.animations.clear();
    for(const batch of this.batches.values()){batch.mesh.count=0;batch.mesh.visible=false;batch.bricks=[];}
  }
  sync(bricks: Iterable<Brick>) {
    const groups = new Map<string, Brick[]>();
    for (const brick of bricks) {
      const key=brick.mirror?`${brick.type}:mirror`:brick.type;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(brick);
    }
    for(const [key,batch] of this.batches)if(!groups.has(key)){batch.bricks=[];batch.mesh.count=0;batch.mesh.visible=false;}
    for (const [key,group] of groups) {
      const type=TYPES.get(group[0].type)!;
      let batch = this.batches.get(key);
      if (!batch || batch.capacity < group.length) {
        const capacity = Math.max(32, 2 ** Math.ceil(Math.log2(group.length)));
        if (batch) { this.scene.remove(batch.mesh); batch.mesh.dispose(); }
        const mesh = new InstancedMesh(brickGeometry(type,Boolean(group[0].mirror)), this.material, capacity);
        mesh.instanceMatrix.setUsage(DynamicDrawUsage); mesh.castShadow = true; mesh.receiveShadow = true;
        mesh.count = 0; this.scene.add(mesh);
        batch = { mesh, capacity, bricks: [] }; this.batches.set(key, batch);
      }
      batch.bricks = group; batch.mesh.count = group.length;batch.mesh.visible=true;
      group.forEach((brick, index) => {
        this.writeMatrix(batch!, brick, index, 0, 1);
        batch!.mesh.setColorAt(index, new Color(brick.color));
      });
      batch.mesh.instanceMatrix.needsUpdate = true;
      if (batch.mesh.instanceColor) batch.mesh.instanceColor.needsUpdate = true;
      batch.mesh.computeBoundingSphere();
    }
  }

  private writeMatrix(batch: Batch, brick: Brick, index: number, drop: number, squash: number) {
    const d = dimensions(brick), half = CONFIG.gridOriginOffset;
    this.transforms.position.set(brick.x + d.width / 2 - half, brick.y * CONFIG.plateHeight + drop, brick.z + d.depth / 2 - half);
    this.transforms.rotation.set(0, brick.rotation * Math.PI / 180, 0);
    this.transforms.scale.set(1, squash, 1); this.transforms.updateMatrix();
    batch.mesh.setMatrixAt(index, this.transforms.matrix);
  }

  animate(id: string) { if (!matchMedia('(prefers-reduced-motion: reduce)').matches) this.animations.set(id, performance.now()); }
  update(now: number) {
    if (!this.animations.size) return false;
    const completed: string[] = [];
    for (const [id, start] of this.animations) {
      const t = Math.min((now - start) / CONFIG.placementDuration, 1);
      for (const batch of this.batches.values()) {
        const index = batch.bricks.findIndex(b => b.id === id);
        if (index < 0) continue;
        const drop = CONFIG.placementDrop * (1 - t) ** 3;
        const squash = 1 - CONFIG.placementSquash * Math.sin(t * Math.PI);
        this.writeMatrix(batch, batch.bricks[index], index, drop, squash);
        batch.mesh.setColorAt(index, new Color(batch.bricks[index].color).multiplyScalar(1 + Math.sin(t * Math.PI) * CONFIG.placementPulse));
        batch.mesh.instanceMatrix.needsUpdate = true; batch.mesh.instanceColor!.needsUpdate = true;
      }
      if (t === 1) completed.push(id);
    }
    completed.forEach(id => this.animations.delete(id));
    return true;
  }
}
