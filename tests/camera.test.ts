import {test} from 'node:test';
import assert from 'node:assert/strict';
import {PerspectiveCamera} from 'three';
import {CameraController} from '../src/cameraController';

test('damped camera stays normalized and becomes idle despite quaternion rounding',()=>{
  const previousWindow=globalThis.window,previousDocument=globalThis.document;
  Object.assign(globalThis,{window:{addEventListener(){}},document:{addEventListener(){}}});
  try{
    const camera=new PerspectiveCamera(60,1.44,.1,10000);
    const canvas={clientWidth:1440,clientHeight:1000,addEventListener(){}} as unknown as HTMLCanvasElement;
    const controls=new CameraController(camera,canvas);
    const q=camera.quaternion;q.set(q.x*.9999999976,q.y*.9999999976,q.z*.9999999976,q.w*.9999999976);
    controls.update(1/60);assert.ok(Math.abs(camera.quaternion.length()-1)<1e-12);
    controls.setViewportInsets({top:80,right:76,bottom:100,left:16});controls.frame();
    for(let i=0;i<500;i++)controls.update([1/240,1/60,1/40][i%3]);
    assert.equal(controls.update(1/60),false);
    assert.ok(camera.position.distanceToSquared(controls.targetPosition)<1e-6);
  }finally{Object.assign(globalThis,{window:previousWindow,document:previousDocument});}
});
