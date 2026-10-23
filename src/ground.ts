import { CanvasTexture, CylinderGeometry, DynamicDrawUsage, InstancedMesh, Matrix4, Mesh, MeshPhysicalMaterial, PerspectiveCamera, PlaneGeometry, RepeatWrapping, Scene, SRGBColorSpace, Vector3 } from 'three';
import { CONFIG } from './config';

function studTexture(heightMap: boolean, anisotropy: number) {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
  const context=canvas.getContext('2d')!;
  context.fillStyle=heightMap?'#000':'#859a8b';context.fillRect(0,0,64,64);
  if(!heightMap){context.fillStyle='#798f7f';context.beginPath();context.arc(32.7,33.4,20.2,0,Math.PI*2);context.fill();}
  const gradient=context.createRadialGradient(32,32,17,32,32,19.2);
  gradient.addColorStop(0,heightMap?'#fff':'#8c9f90');gradient.addColorStop(1,heightMap?'#000':'#829786');
  context.fillStyle=gradient;context.beginPath();context.arc(32,32,19.2,0,Math.PI*2);context.fill();
  const texture=new CanvasTexture(canvas);texture.wrapS=texture.wrapT=RepeatWrapping;texture.anisotropy=anisotropy;
  if(!heightMap)texture.colorSpace=SRGBColorSpace;
  return texture;
}

export class InfiniteGround {
  readonly plane:Mesh;
  readonly studs:InstancedMesh;
  centerX=0;
  centerZ=0;
  private direction=new Vector3();
  private matrix=new Matrix4();
  private patchX=Infinity;
  private patchZ=Infinity;
  private map:CanvasTexture;
  private bump:CanvasTexture;
  constructor(scene:Scene,anisotropy:number){
    this.map=studTexture(false,anisotropy);this.bump=studTexture(true,anisotropy);
    this.plane=new Mesh(new PlaneGeometry(1,1),new MeshPhysicalMaterial({map:this.map,bumpMap:this.bump,bumpScale:.08,roughness:.42,clearcoat:.35}));
    this.plane.name='Infinite ground';this.plane.rotation.x=-Math.PI/2;this.plane.receiveShadow=true;scene.add(this.plane);
    const n=CONFIG.groundStudPatchSize;
    this.studs=new InstancedMesh(new CylinderGeometry(CONFIG.studRadius,CONFIG.studRadius,CONFIG.studHeight,8),new MeshPhysicalMaterial({color:0x859a8b,roughness:.42,clearcoat:.35}),n*n);
    this.studs.name='Nearby ground studs';this.studs.instanceMatrix.setUsage(DynamicDrawUsage);this.studs.receiveShadow=true;scene.add(this.studs);
    // Feather the outer studs into the repeating far surface instead of exposing a square edge.
    for(let x=0;x<n;x++)for(let z=0;z<n;z++){
      const dx=x-n/2+.5,dz=z-n/2+.5,r=Math.hypot(dx,dz)/(n/2),t=Math.max(0,Math.min(1,(1-r)/.25));
      const height=Math.max(.001,t*t*(3-2*t));
      this.matrix.makeScale(1,height,1);this.matrix.setPosition(dx,CONFIG.studHeight*height/2,dz);this.studs.setMatrixAt(x*n+z,this.matrix);
    }
    this.studs.instanceMatrix.needsUpdate=true;this.studs.computeBoundingSphere();
  }
  update(camera:PerspectiveCamera){
    const chunk=CONFIG.groundChunkSize;
    camera.getWorldDirection(this.direction);
    const distance=this.direction.y<-.05?Math.min(-camera.position.y/this.direction.y/2,64):32;
    this.centerX=Math.round((camera.position.x+this.direction.x*distance)/chunk)*chunk;
    this.centerZ=Math.round((camera.position.z+this.direction.z*distance)/chunk)*chunk;
    const changed=this.centerX!==this.patchX||this.centerZ!==this.patchZ;
    if(changed){this.patchX=this.centerX;this.patchZ=this.centerZ;this.studs.position.set(this.centerX,0,this.centerZ);}
    this.studs.visible=camera.position.y<CONFIG.groundDetailHeight;
    const size=Math.max(CONFIG.groundPlaneSize,Math.ceil(camera.position.y*32/chunk)*chunk);
    this.plane.position.set(Math.round(camera.position.x/chunk)*chunk,0,Math.round(camera.position.z/chunk)*chunk);
    this.plane.scale.set(size,size,1);this.map.repeat.set(size,size);this.bump.repeat.set(size,size);
    return changed;
  }
}
