import { COLORS, dimensions, canMirror, type Brick } from './bricks/catalog';
import { CONFIG } from './config';

export function starterBuild(): Brick[] {
  const bricks: Brick[]=[];
  const add=(type:string,x:number,y:number,z:number,color:string,rotation=0) => bricks.push({id:`starter-${bricks.length}`,type,color,rotation,x,y,z});
  const red='#e74c3c', cream='#f4f3ed', sand='#d3b88a', blue='#247bc0', yellow='#f4c740', green='#3d9257';
  // The front faces +z. Window openings are filled with blue pieces, all on the same stud grid.
  for(let y=0;y<12;y+=3) {
    for(let x=11;x<19;x+=2) for(let z=12;z<18;z+=3) add('bricks-2x3',x,y,z,cream);
    for(let x=10;x<20;x+=2) add('bricks-1x2',x,y,11,cream,90);
    for(let z=12;z<19;z++) { add('bricks-1x1',10,y,z,cream); add('bricks-1x1',19,y,z,cream); }
    for(let x=11;x<19;x++) {
      const door=x>=14&&x<=15;
      const window=(x===12||x===13||x===17||x===18)&&y>=3&&y<9;
      add('bricks-1x1',x,y,18,door?blue:window?yellow:cream);
    }
  }
  // A studded, stepped roof gives the tiny house its toy silhouette without slope parts.
  for(let layer=0;layer<5;layer++) {
    const x0=9+layer, width=12-layer*2;
    for(let x=x0;x<x0+width;x+=2) for(let z=10;z<20;z+=2) add('plates-2x2',x,12+layer,z,red);
  }
  add('bricks-1x2',17,16,13,sand); add('bricks-1x2',17,19,13,sand);
  add('tiles-1x2',17,22,13,'#80523c');
  // Front step, path, flower beds, and two blocky trees are editable pieces too.
  add('plates-2x4',13,0,19,sand,90);
  for(let z=21;z<26;z+=2) add('tiles-2x2',14,0,z,sand);
  for(const x of [8,20]) {
    add('plates-2x4',x,0,21,green,90);
    for(let i=0;i<4;i++) add('bricks-1x1',x+i,1,21,i%2?yellow:red);
  }
  for(const [x,z] of [[6,13],[23,16]]) {
    add('bricks-1x1',x,0,z,'#80523c'); add('bricks-1x1',x,3,z,'#80523c'); add('bricks-1x1',x,6,z,'#80523c');
    add('plates-4x4',x-1,9,z-1,green); add('bricks-2x4',x-1,10,z-1,green);
    add('bricks-2x2',x-1,13,z,green); add('plates-2x2',x-1,16,z,'#a6c83e');
  }
  return bricks;
}

const STRESS_TYPES=[
  'bricks-1x1','bricks-1x2','bricks-1x3','bricks-1x4','bricks-2x2','bricks-2x3','bricks-2x4','bricks-3x3',
  'plates-1x1','plates-1x2','plates-2x2','plates-2x3','plates-2x4','plates-3x3',
  'tiles-1x1','tiles-1x2','tiles-2x2','tiles-2x3',
  'bricks-l-2x2-t1','bricks-l-2x3-t1','bricks-l-2x4-t1','plates-l-3x3-t1','plates-l-3x3-t2','tiles-l-4x4-t1',
];
export function stressBuild(count=1000): Brick[] {
  const bricks:Brick[]=[];
  let x=0,z=0,y=0,rowDepth=0;
  for(let i=0;i<count;i++) {
    const type=STRESS_TYPES[i%STRESS_TYPES.length],rotation=(Math.floor(i/STRESS_TYPES.length)%4)*90;
    const brick:Brick={id:`stress-${i}`,type,color:COLORS[i%COLORS.length].hex,rotation,mirror:canMirror(type)&&Math.floor(i/STRESS_TYPES.length)%2===1,x:0,y:0,z:0};
    const d=dimensions(brick);
    if(x+d.width>CONFIG.baseplateSize){x=0;z+=rowDepth;rowDepth=0;}
    if(z+d.depth>CONFIG.baseplateSize){x=0;z=0;y+=3;rowDepth=0;}
    if(y+d.height>CONFIG.maxBuildHeight)break;
    brick.x=x;brick.y=y;brick.z=z;bricks.push(brick);x+=d.width;rowDepth=Math.max(rowDepth,d.depth);
  }
  return bricks;
}
