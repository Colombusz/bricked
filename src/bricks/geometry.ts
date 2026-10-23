import { BufferGeometry, ExtrudeGeometry, LatheGeometry, Shape, Vector2 } from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { CONFIG } from '../config';
import { TYPES, footprint, type BrickType } from './catalog';

const geometries = new Map<string, [BufferGeometry?, BufferGeometry?]>();
export function createStudGeometry(segments = 16) {
  const r = CONFIG.studRadius;
  return new LatheGeometry([
    new Vector2(0, 0), new Vector2(r - 0.015, 0), new Vector2(r, 0.018),
    new Vector2(r, CONFIG.studHeight - 0.025), new Vector2(r - 0.008, CONFIG.studHeight - 0.008),
    new Vector2(r - 0.025, CONFIG.studHeight), new Vector2(0, CONFIG.studHeight),
  ], segments);
}
export function brickGeometry(type: BrickType | string, mirror = false) {
  if (typeof type === 'string') type = TYPES.get(type)!;
  let variants=geometries.get(type.id);
  const variant=mirror?1:0,cached=variants?.[variant];
  if (cached) return cached;
  const h = type.heightPlates * CONFIG.plateHeight;
  const mask=footprint({type:type.id,rotation:0,mirror});
  const inset=CONFIG.seam/2+CONFIG.bodyBevel,shape=new Shape();
  // Offset each edge along its inward normal, including the concave notch edges.
  const points=mask.outline.map((p,i,outline)=>{
    const a=outline[(i+outline.length-1)%outline.length],b=outline[(i+1)%outline.length];
    const dx1=Math.sign(p.x-a.x),dz1=Math.sign(p.z-a.z),dx2=Math.sign(b.x-p.x),dz2=Math.sign(b.z-p.z);
    return new Vector2(p.x-(dz1+dz2)*inset-type.w/2,type.d/2-p.z-(dx1+dx2)*inset);
  });
  shape.setFromPoints(points);shape.closePath();
  const body = new ExtrudeGeometry(shape,{depth:h-CONFIG.bodyVerticalSeam-2*CONFIG.bodyBevel,steps:1,bevelEnabled:true,bevelThickness:CONFIG.bodyBevel,bevelSize:CONFIG.bodyBevel,bevelSegments:CONFIG.bevelSegments,curveSegments:1});
  body.rotateX(-Math.PI/2);body.translate(0,CONFIG.bodyVerticalSeam/2+CONFIG.bodyBevel,0);
  const parts: BufferGeometry[] = [body];
  if (type.studs) {
    const stud = createStudGeometry();
    for (const {x,z} of mask.cells) {
      const copy = stud.clone().toNonIndexed();
      copy.translate(x - type.w / 2 + 0.5, h - CONFIG.bodyVerticalSeam/2, z - type.d / 2 + 0.5);
      parts.push(copy);
    }
    stud.dispose();
  }
  const combined = mergeGeometries(parts, false)!;
  const merged = mergeVertices(combined);
  combined.dispose();
  parts.forEach(part => part.dispose());
  merged.computeBoundingSphere();
  if(!variants){variants=[];geometries.set(type.id,variants);}variants[variant]=merged;
  return merged;
}
