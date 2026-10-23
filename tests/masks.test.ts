import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Ray,Vector3,Mesh,MeshBasicMaterial,Raycaster,DoubleSide} from 'three';
import {CATALOG,TYPES,footprint,canMirror,type Brick} from '../src/bricks/catalog';
import {brickGeometry} from '../src/bricks/geometry';
import {Grid} from '../src/grid';
import {History} from '../src/history';
import {parseBuild} from '../src/persistence';
import {stressBuild} from '../src/starter';
const part=(overrides:Partial<Brick>={}):Brick=>({id:'a',type:'plates-l-3x3-t1',color:'#e74c3c',rotation:0,x:10,y:0,z:10,...overrides});
const signature=(b:Brick)=>{const m=footprint(b);return `${m.width}x${m.depth}:${m.cells.map(c=>`${c.x},${c.z}`).sort().join(';')}`};
test('all 76 catalog entries have unique stable ids, labels and cached masks',()=>{
 assert.equal(CATALOG.length,76);assert.equal(new Set(CATALOG.map(t=>t.id)).size,76);
 for(const [category,straight] of [['Bricks',18],['Plates',21],['Tiles',13]]){
  const types=CATALOG.filter(t=>t.category===category);assert.equal(types.filter(t=>t.shape==='rect').length,straight);assert.equal(types.filter(t=>t.shape==='L').length,8);assert.equal(new Set(types.map(t=>t.label)).size,types.length);
 }
 for(const type of CATALOG)for(const mirror of [false,true])for(const rotation of [0,90,180,270]){
  const b=part({type:type.id,rotation,mirror}),mask=footprint(b);
  assert.equal(mask,footprint(b));assert.equal(mask.cells.length,type.w*type.d-(type.shape==='L'?(type.w-type.arm!)*(type.d-type.arm!):0));
  assert.equal(mask.outline.length,type.shape==='L'?6:4);
  const grid=new Grid();assert.ok(grid.add(b));assert.equal(grid.occupancy.size,mask.cells.length*type.heightPlates);
  for(const c of mask.cells)assert.equal(grid.at(b.x+c.x,b.y,b.z+c.z)?.id,b.id);
  grid.remove(b.id);assert.equal(grid.occupancy.size,0);
 }
});
test('L orientation convention, four rotations and reflection handedness',()=>{
 for(const type of CATALOG.filter(t=>t.shape==='L')){
  const b=part({type:type.id}),m=footprint(b);
  assert.ok(m.cells.every(c=>c.x<type.arm!||c.z<type.arm!));assert.equal(new Set([0,90,180,270].map(rotation=>signature({...b,rotation}))).size,4);
  assert.equal(canMirror(type.id),type.w!==type.d);
  if(canMirror(type.id))assert.ok(![0,90,180,270].some(rotation=>signature({...b,rotation})===signature({...b,mirror:true})));
 }
 assert.equal(canMirror('bricks-2x4'),false);
});
test('notches admit bricks and DDA rays; only occupied cells provide or receive support',()=>{
 const grid=new Grid(),l=part();assert.ok(grid.add(l));
 const notch=part({id:'notch',type:'bricks-1x1',x:11,z:11});assert.ok(grid.validate(notch).valid);assert.ok(grid.add(notch));
 assert.equal(grid.raycast(new Ray(new Vector3(-4.5,10,-4.5),new Vector3(0,-1,0)))?.brick?.id,'notch');
 grid.remove('notch');assert.equal(grid.raycast(new Ray(new Vector3(-4.5,10,-4.5),new Vector3(0,-1,0)))?.brick,null);
 grid.clear();grid.add(notch);assert.ok(grid.validate(l).valid);assert.ok(grid.add(l));
 grid.clear();grid.add(part({type:'bricks-1x1',x:11,z:11}));assert.equal(grid.supported(part({id:'up',y:3})),false);
 grid.clear();grid.add(part({type:'bricks-1x1'}));assert.equal(grid.supported(part({id:'up',y:3})),true);
 for(const type of CATALOG.filter(t=>t.category==='Tiles')){
  grid.clear();grid.add(part({type:type.id}));assert.equal(grid.supported(part({id:'up',type:'bricks-1x1',y:1})),false);
 }
 grid.clear();grid.add(part({type:'bricks-l-3x3-t1'}));assert.ok(grid.validate(part({id:'cross',type:'bricks-l-3x3-t1',rotation:180,y:3})).valid);
});
test('procedural bodies have open notches and studs only on occupied cells, for both mirrors',()=>{
 for(const id of ['bricks-l-2x3-t1','plates-l-4x4-t2','tiles-l-3x3-t1','plates-8x8'])for(const mirror of [false,true]){
  const type=TYPES.get(id)!,geometry=brickGeometry(id,mirror),mesh=new Mesh(geometry,new MeshBasicMaterial({side:DoubleSide}));mesh.updateMatrixWorld();
  assert.equal(geometry,brickGeometry(id,mirror));const mask=footprint(part({type:id,mirror}));
  for(let x=0;x<mask.width;x++)for(let z=0;z<mask.depth;z++){
   const ray=new Raycaster(new Vector3(x+.5-type.w/2,10,z+.5-type.d/2),new Vector3(0,-1,0));const hits=ray.intersectObject(mesh);
   const occupied=mask.cells.some(c=>c.x===x&&c.z===z);assert.equal(hits.length>0,occupied,`${id} ${mirror} cell ${x},${z}`);
   if(occupied)assert.ok(Math.abs(hits[0].point.y-(type.heightPlates*.4-.007+(type.studs?.2:0)))<1e-5);
  }
  for(let i=0;i<mask.outline.length;i++){
   const a=mask.outline[i],b=mask.outline[(i+1)%mask.outline.length],nx=-Math.sign(b.z-a.z),nz=Math.sign(b.x-a.x);
   for(const [inset,expected] of [[.02,true],[.005,false]] as const){
    const ray=new Raycaster(new Vector3((a.x+b.x)/2+nx*inset-type.w/2,10,(a.z+b.z)/2+nz*inset-type.d/2),new Vector3(0,-1,0));
    assert.equal(ray.intersectObject(mesh).length>0,expected,`${id} mirrored=${mirror} edge ${i} inset ${inset}`);
   }
  }
  mesh.material.dispose();
 }
});
test('mirror persists through place/delete/clear undo and old saves default to unmirrored',()=>{
 const grid=new Grid(),history=new History(grid),b=part({type:'bricks-l-2x3-t1',mirror:true,rotation:270});history.place(b);history.delete(b.id);history.undo();assert.deepEqual(grid.snapshot(),[b]);history.redo();history.undo();history.clear();history.undo();assert.deepEqual(grid.snapshot(),[b]);
 const old=part({type:'bricks-2x4'}),file=(bricks:unknown[])=>JSON.stringify({version:1,name:'Old',bricks});assert.equal(parseBuild(file([old])).bricks[0].mirror,false);
 const warnings:string[]=[],warn=console.warn;console.warn=(...args)=>warnings.push(args.join(' '));
 try{const loaded=parseBuild(file([b,{...old,id:'unknown',type:'future-part'}]));assert.equal(loaded.skipped,1);assert.deepEqual(loaded.bricks,[b]);assert.equal(warnings.length,1)}finally{console.warn=warn}
 assert.throws(()=>parseBuild(file([{...old,mirror:'yes'}])));
});
test('stress build includes at least 20 types and mirrored Ls without overlaps',()=>{
 const build=stressBuild(2000),grid=new Grid();assert.equal(build.length,2000);assert.ok(new Set(build.map(b=>b.type)).size>=20);assert.ok(build.some(b=>b.mirror&&TYPES.get(b.type)!.shape==='L'));
 for(const b of build)assert.ok(grid.add(b),`${b.id} fits`);
});
