import { ACESFilmicToneMapping, DirectionalLight, Fog, HemisphereLight, PCFSoftShadowMap, PerspectiveCamera, PMREMGenerator, Scene, WebGLRenderer } from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CONFIG } from './config';
import { InfiniteGround } from './ground';

export function createWorld(root: HTMLElement) {
  const renderer = new WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, CONFIG.maxPixelRatio));
  renderer.setSize(root.clientWidth, root.clientHeight);
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate = false;
  renderer.domElement.id = 'scene';
  renderer.domElement.setAttribute('aria-label', 'Interactive 3D brick playground. Click to place. Alt and drag to orbit. Press ? for controls.');
  renderer.domElement.tabIndex = 0;
  root.prepend(renderer.domElement);
  const scene = new Scene();
  scene.fog = new Fog(0xe9edf1, 100, 200);
  const camera = new PerspectiveCamera(CONFIG.fov, root.clientWidth / root.clientHeight, 0.1, CONFIG.worldViewDistance);
  const pmrem = new PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.04);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.5;
  room.dispose(); pmrem.dispose();
  scene.add(new HemisphereLight(0xe8f2ff, 0xb4b6b9, 1.35));
  const sun = new DirectionalLight(0xfff9ef, 2.7);
  sun.position.set(-20, 35, 20); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -27, right: 27, top: 27, bottom: -27, near: 1, far: 100 });
  sun.shadow.camera.updateProjectionMatrix();
  sun.shadow.normalBias = 0.025; sun.shadow.bias = -0.0001; sun.shadow.radius = 4;
  scene.add(sun);
  const ground=new InfiniteGround(scene,Math.min(8,renderer.capabilities.getMaxAnisotropy()));
  scene.add(sun.target);
  const updateGround=()=>{
    if(ground.update(camera)){
      sun.position.set(ground.centerX-20,35,ground.centerZ+20);sun.target.position.set(ground.centerX,0,ground.centerZ);
      renderer.shadowMap.needsUpdate=true;
    }
    const fog=scene.fog as Fog;fog.near=Math.max(100,camera.position.y*3);fog.far=Math.max(200,camera.position.y*8);
  };
  renderer.shadowMap.needsUpdate = true;
  const resize = () => {
    camera.aspect = root.clientWidth / root.clientHeight; camera.updateProjectionMatrix();
    renderer.setSize(root.clientWidth, root.clientHeight);
    renderer.shadowMap.needsUpdate = true;
  };
  return { scene, camera, renderer, resize, ground, updateGround };
}
