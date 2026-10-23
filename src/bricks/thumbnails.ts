import { ACESFilmicToneMapping, AmbientLight, DirectionalLight, Mesh, MeshPhysicalMaterial, PerspectiveCamera, PMREMGenerator, Scene, Vector3, WebGLRenderer } from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { type BrickType } from './catalog';
import { brickGeometry } from './geometry';
import { CONFIG } from '../config';

class Thumbnails {
  readonly images=new Map<string,string>();
  onReady=(_id:string,_image:string)=>{};
  private queue:BrickType[]=[];
  private queued=new Set<string>();
  private scheduled=false;
  private renderer:WebGLRenderer|null=null;
  private scene=new Scene();
  private camera=new PerspectiveCamera(35,164/108,.1,100);
  private mesh:Mesh|null=null;
  private center=new Vector3();
  private direction=new Vector3(.95,.85,1.25).normalize();

  request(types:readonly BrickType[]){
    for(const type of types)if(!this.images.has(type.id)&&!this.queued.has(type.id)){this.queue.push(type);this.queued.add(type.id);}
    if(this.queue.length&&!this.scheduled){this.scheduled=true;setTimeout(()=>this.flush(),0);}
  }
  private initialize(){
    const renderer=this.renderer=new WebGLRenderer({alpha:true,antialias:true,preserveDrawingBuffer:true});
    renderer.setSize(164,108);renderer.setPixelRatio(2);renderer.setClearColor(0x000000,0);renderer.toneMapping=ACESFilmicToneMapping;
    const room=new RoomEnvironment(),pmrem=new PMREMGenerator(renderer),env=pmrem.fromScene(room,.04);
    this.scene.environment=env.texture;this.scene.environmentIntensity=.6;room.dispose();pmrem.dispose();
    const light=new DirectionalLight(0xffffff,2.5);light.position.set(-3,6,4);this.scene.add(light,new AmbientLight(0xffffff,1));
    this.mesh=new Mesh(undefined,new MeshPhysicalMaterial({color:'#e74c3c',roughness:.23,clearcoat:.8}));this.scene.add(this.mesh);
  }
  private flush(){
    if(!this.renderer)this.initialize();
    for(let i=0;i<CONFIG.thumbnailBatchSize&&this.queue.length;i++){
      const type=this.queue.shift()!;this.mesh!.geometry=brickGeometry(type);
      this.center.set(0,type.heightPlates*.2,0);
      this.camera.position.copy(this.direction).multiplyScalar(Math.max(type.w,type.d,2.7)*2.25).add(this.center);this.camera.lookAt(this.center);
      this.renderer!.render(this.scene,this.camera);
      const image=this.renderer!.domElement.toDataURL('image/png');this.images.set(type.id,image);this.queued.delete(type.id);this.onReady(type.id,image);
    }
    this.scheduled=false;
    if(this.queue.length){this.scheduled=true;setTimeout(()=>this.flush(),16);}
  }
}

// One offscreen context serves every category throughout the session.
export function renderThumbnails(){return new Thumbnails();}
