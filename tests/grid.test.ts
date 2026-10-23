import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Ray, Vector3 } from 'three';
import { Grid } from '../src/grid';
import { snapWithHysteresis, targetBrick } from '../src/placement';
import { type Brick } from '../src/bricks/catalog';
import { History } from '../src/history';
import { parseBuild } from '../src/persistence';
import { starterBuild } from '../src/starter';

const brick = (override: Partial<Brick> = {}): Brick => ({ id: 'a', type: 'bricks-2x4', color: '#e74c3c', rotation: 0, x: 12, y: 0, z: 12, ...override });
test('2×4 stacking offset by one stud occupies exact plate cells', () => {
  const grid = new Grid(); assert.ok(grid.add(brick()));
  const upper = brick({ id: 'b', x: 13, y: 3 });
  assert.ok(grid.validate(upper).valid); assert.ok(grid.add(upper));
  assert.equal(grid.occupancy.size, 48); assert.equal(grid.at(13,2,12)?.id, 'a'); assert.equal(grid.at(13,3,12)?.id, 'b');
  assert.equal(grid.add(brick({ id:'collision' })), false);
});
test('tiles cannot support bricks, one stud allows overhang, floating is explicit', () => {
  const grid = new Grid(); grid.add(brick({type:'tiles-2x2'}));
  const upper = brick({y:1}); assert.equal(grid.validate(upper).valid, false); assert.ok(grid.validate(upper,true).valid);
  grid.clear(); grid.add(brick({type:'bricks-1x1'}));
  assert.ok(grid.validate(brick({x:11,z:9,y:3})).valid);
});
test('bounds, rotation, height limits and collision lift', () => {
  const grid = new Grid(); grid.add(brick());
  assert.equal(grid.lift(brick()).y,3);
  assert.equal(grid.validate(brick({x:31})).valid,false);
  assert.equal(grid.validate(brick({y:95})).valid,false);
  assert.equal(grid.validate(brick({x:29,z:20,rotation:90})).valid,false);
});
test('DDA returns exact top and side faces', () => {
  const grid = new Grid(); grid.add(brick());
  const top = grid.raycast(new Ray(new Vector3(-3,10,-3),new Vector3(0,-1,0)))!;
  assert.equal(top.brick?.id,'a'); assert.deepEqual(top.normal.toArray(),[0,1,0]); assert.ok(Math.abs(top.point.y-1.2)<1e-8);
  const side = grid.raycast(new Ray(new Vector3(8,0.6,-3),new Vector3(-1,0,0)))!;
  assert.equal(side.brick?.id,'a'); assert.deepEqual(side.normal.toArray(),[1,0,0]);
  const next = targetBrick(grid,side,brick({id:'b'})); assert.equal(next.x,14); assert.equal(next.y,0);
});
test('hysteresis holds boundaries and every output is integral', () => {
  assert.equal(snapWithHysteresis(3.6,3),3); assert.equal(snapWithHysteresis(3.66,3),4);
  assert.equal(snapWithHysteresis(3.4,4),4); assert.equal(snapWithHysteresis(3.34,4),3);
  for(let i=-500;i<500;i++) assert.ok(Number.isInteger(snapWithHysteresis(i/100,3)));
});
test('removal restores occupancy and supports repeat placement', () => {
  const grid=new Grid(); grid.add(brick()); grid.remove('a'); assert.equal(grid.occupancy.size,0); assert.ok(grid.add(brick()));
});
test('batched clear is one command and restoring it preserves every brick identity',()=>{
  const grid=new Grid(),history=new History(grid);history.place(brick());history.place(brick({id:'b',x:13,y:3}));
  const before=grid.snapshot();history.clear();assert.equal(grid.bricks.size,0);assert.equal(grid.occupancy.size,0);
  history.undo();assert.deepEqual(grid.snapshot(),before);assert.equal(grid.occupancy.size,48);history.redo();assert.equal(grid.bricks.size,0);
});
test('starter build obeys collision and support rules for every piece', () => {
  const grid=new Grid();
  for(const part of starterBuild()) { assert.ok(grid.validate(part).valid, `${part.id} must be supported`);assert.ok(grid.add(part)); }
  assert.equal(grid.bricks.size,starterBuild().length);
});
test('command history preserves place/delete ordering and invalidates redo on edits', () => {
  const grid=new Grid(),history=new History(grid);
  history.place(brick());history.place(brick({id:'b',x:13,y:3}));history.delete('a');
  assert.equal(grid.bricks.size,1);history.undo();assert.equal(grid.bricks.size,2);
  history.undo();assert.equal(grid.bricks.size,1);history.redo();assert.equal(grid.bricks.size,2);
  history.redo();assert.equal(grid.bricks.size,1);history.undo();
  history.place(brick({id:'c',x:20}));assert.equal(history.canRedo,false);
  history.replace([]);assert.equal(grid.bricks.size,0);history.undo();assert.equal(grid.bricks.size,3);
});
test('import rejects overlap, out-of-bounds, duplicate IDs, and malformed data atomically', () => {
  const file=(bricks:unknown[])=>JSON.stringify({version:1,name:'Test',bricks});
  assert.equal(parseBuild(file([brick()])).bricks.length,1);
  assert.throws(()=>parseBuild(file([brick(),brick({id:'b'})])));
  assert.throws(()=>parseBuild(file([brick(),brick({x:20})])));
  assert.throws(()=>parseBuild(file([brick({x:99})])));
  assert.throws(()=>parseBuild(file([brick({x:0.5})])));
  assert.throws(()=>parseBuild(file([brick({color:'<script>'})])));
  assert.throws(()=>parseBuild('not json'));
});
