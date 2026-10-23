export type Category = 'Bricks' | 'Plates' | 'Tiles';
export interface BrickType { id: string; category: Category; shape: 'rect' | 'L'; w: number; d: number; arm?: number; heightPlates: number; studs: boolean; label: string; name: string }
export interface Cell { readonly x: number; readonly z: number }
export interface Footprint { readonly width: number; readonly depth: number; readonly height: number; readonly cells: readonly Cell[]; readonly outline: readonly Cell[] }

function parts(category: Category, height: number, sizes: [number, number][]): BrickType[] {
  return sizes.map(([width, depth]) => ({ id: `${category.toLowerCase()}-${width}x${depth}`, category, shape: 'rect' as const, w: width, d: depth, heightPlates: height, studs: category !== 'Tiles', label: `${width}×${depth}`, name: `${category.slice(0,-1)} ${width}×${depth}` }));
}
function lParts(category: Category, heightPlates: number): BrickType[] {
  const sizes = [[2,2,1],[2,3,1],[2,4,1],[3,3,1],[3,3,2],[4,4,1],[4,4,2],[6,6,2]];
  return sizes.map(([w,d,arm])=>({id:`${category.toLowerCase()}-l-${w}x${d}-t${arm}`,category,shape:'L',w,d,arm,heightPlates,studs:category!=='Tiles',label:`L ${w}×${d}${arm===1?'':`·${arm}`}`,name:`L-shaped ${category.slice(0,-1).toLowerCase()} ${w}×${d}, ${arm}-wide arms`}));
}
export const CATALOG = [
  ...parts('Bricks', 3, [[1,1],[1,2],[1,3],[1,4],[1,6],[1,8],[1,10],[1,12],[2,2],[2,3],[2,4],[2,6],[2,8],[2,10],[3,3],[4,4],[4,6],[4,8]]),
  ...parts('Plates', 1, [[1,1],[1,2],[1,3],[1,4],[1,6],[1,8],[1,10],[1,12],[2,2],[2,3],[2,4],[2,6],[2,8],[2,10],[3,3],[4,4],[4,6],[4,8],[6,6],[6,8],[8,8]]),
  ...parts('Tiles', 1, [[1,1],[1,2],[1,3],[1,4],[1,6],[1,8],[2,2],[2,3],[2,4],[2,6],[3,3],[4,4],[6,6]]),
  ...lParts('Bricks',3), ...lParts('Plates',1), ...lParts('Tiles',1),
];
export const TYPES = new Map(CATALOG.map(type => [type.id, type]));
export const COLORS = [
  { name: 'Coral red', hex: '#e74c3c' }, { name: 'Ocean blue', hex: '#247bc0' },
  { name: 'Sunshine', hex: '#f4c740' }, { name: 'Leaf green', hex: '#3d9257' },
  { name: 'Cloud white', hex: '#f4f3ed' }, { name: 'Carbon black', hex: '#293038' },
  { name: 'Tangerine', hex: '#f18b36' }, { name: 'Light gray', hex: '#b9c1c6' },
  { name: 'Slate gray', hex: '#65737e' }, { name: 'Cocoa', hex: '#80523c' },
  { name: 'Sand', hex: '#d3b88a' }, { name: 'Bubblegum', hex: '#ec96b4' },
  { name: 'Lime', hex: '#a6c83e' }, { name: 'Grape', hex: '#9270bb' },
];
export interface Brick { id: string; type: string; color: string; rotation: number; mirror?: boolean; x: number; y: number; z: number }
type Orientation = Pick<Brick, 'type' | 'rotation' | 'mirror'>;
const masks = new Map<string, readonly Footprint[]>();

// Trace only exposed cell edges, then discard collinear vertices. No internal edges remain.
function outline(cells: readonly Cell[]): readonly Cell[] {
  const edges = new Map<string, {a: Cell; b: Cell}>();
  const key = (p: Cell) => `${p.x},${p.z}`;
  for (const {x,z} of cells) {
    const corners=[{x,z},{x:x+1,z},{x:x+1,z:z+1},{x,z:z+1}];
    for(let i=0;i<4;i++){
      const a=corners[i],b=corners[(i+1)%4],reverse=`${key(b)}:${key(a)}`;
      if(edges.has(reverse))edges.delete(reverse);else edges.set(`${key(a)}:${key(b)}`,{a,b});
    }
  }
  const next = new Map([...edges.values()].map(e=>[key(e.a),e.b]));
  const start=edges.values().next().value!.a,points: Cell[]=[];
  let p=start;
  do {points.push(p);p=next.get(key(p))!;}while(key(p)!==key(start));
  return points.filter((p,i)=>{
    const a=points[(i+points.length-1)%points.length],b=points[(i+1)%points.length];
    return (p.x-a.x)*(b.z-p.z)!==(p.z-a.z)*(b.x-p.x);
  });
}
function deriveMasks(type: BrickType): readonly Footprint[] {
  const base: Cell[]=[];
  for(let x=0;x<type.w;x++)for(let z=0;z<type.d;z++)if(type.shape==='rect'||x<type.arm!||z<type.arm!)base.push({x,z});
  const orientations: Footprint[]=[];
  for(const mirror of [false,true])for(let rotation=0;rotation<4;rotation++){
    const width=rotation%2?type.d:type.w,depth=rotation%2?type.w:type.d;
    const cells=base.map(cell=>{
      let x=mirror?type.w-1-cell.x:cell.x,z=cell.z,w=type.w,d=type.d;
      for(let i=0;i<rotation;i++){const nx=z;z=w-1-x;x=nx;[w,d]=[d,w];}
      return {x,z};
    });
    orientations.push({width,depth,height:type.heightPlates,cells,outline:outline(cells)});
  }
  return orientations;
}
export function footprint(brick: Orientation): Footprint {
  let cached=masks.get(brick.type);
  if(!cached){cached=deriveMasks(TYPES.get(brick.type)!);masks.set(brick.type,cached);}
  return cached[(brick.mirror?4:0)+brick.rotation/90];
}
export const dimensions = footprint;
const mirrorable = new Set<string>();
// Warm the tiny masks once; geometry and GPU resources remain lazy.
for(const type of CATALOG){
  const mirrored=footprint({type:type.id,rotation:0,mirror:true});
  const signature=(m:Footprint)=>`${m.width},${m.depth}:${m.cells.map(c=>`${c.x},${c.z}`).sort().join(';')}`;
  if(![0,90,180,270].some(rotation=>signature(footprint({type:type.id,rotation}))===signature(mirrored)))mirrorable.add(type.id);
}
export function canMirror(type: string) { return mirrorable.has(type); }
