import {test} from 'node:test';import assert from 'node:assert/strict';
import {PlacementConstraints} from '../src/placementConstraints';import type {Brick} from '../src/bricks/catalog';
const brick:Brick={id:'a',type:'bricks-2x4',color:'#e74c3c',rotation:0,x:10,y:3,z:10};
test('axis locks retain anchor layer, decide by raw travel, and release',()=>{
 const locks=new PlacementConstraints();locks.holdAxis(true,brick);
 assert.deepEqual(locks.apply(brick,10.4,10.2),brick);assert.equal(locks.axis,null);
 const next=locks.apply(brick,12.1,10.7);assert.equal(locks.axis,'x');assert.equal(next.x,12);assert.equal(next.z,10);assert.equal(next.y,3);
 const later=locks.apply(brick,11.3,18,next);assert.equal(later.z,10);assert.equal(later.y,3);assert.equal(later.x,11);
 locks.holdAxis(false,brick);assert.equal(locks.axisActive,false);assert.equal(locks.planeLayer,null);
});
test('Z lock, touch latch, type changes, layer stepping and height clamps',()=>{
 const locks=new PlacementConstraints();locks.toggleAxis(brick);const next=locks.apply(brick,10.2,12.3);assert.equal(next.x,10);assert.equal(locks.axis,'z');
 locks.toggleLayer(brick);locks.stepLayer(1,brick);assert.equal(locks.layer,6);assert.equal(locks.anchor?.y,6);
 locks.stepLayer(1,{...brick,type:'plates-1x1'});assert.equal(locks.layer,7);
 for(let i=0;i<100;i++)locks.stepLayer(1,brick);assert.equal(locks.layer,93);
 locks.clear();assert.equal(locks.layer,null);assert.equal(locks.axis,null);assert.equal(locks.axisActive,false);
});
