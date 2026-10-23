import { ACESFilmicToneMapping, BoxGeometry, Color, CylinderGeometry, DirectionalLight, Fog, HemisphereLight, InstancedMesh, Matrix4, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, PCFSoftShadowMap, PerspectiveCamera, PlaneGeometry, PMREMGenerator, Scene, WebGLRenderer } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CONFIG } from './config';

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
  const camera = new PerspectiveCamera(CONFIG.fov, root.clientWidth / root.clientHeight, 0.1, 250);
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
  sun.shadow.normalBias = 0.025; sun.shadow.bias = -0.0001; sun.shadow.radius = 4;
  scene.add(sun);
  const n = CONFIG.baseplateSize;
  const baseMaterial = new MeshPhysicalMaterial({ color: 0x859a8b, roughness: 0.42, metalness: 0, clearcoat: 0.35 });
  const base = new Mesh(new RoundedBoxGeometry(n + 0.24, 0.35, n + 0.24, 2, 0.12), baseMaterial);
  base.position.set(0, -0.175, 0); base.receiveShadow = true; base.castShadow = true; scene.add(base);
  const studs = new InstancedMesh(new CylinderGeometry(CONFIG.studRadius, CONFIG.studRadius, CONFIG.studHeight, 16), baseMaterial, n * n);
  const matrix = new Matrix4();
  for (let x = 0; x < n; x++) for (let z = 0; z < n; z++) {
    matrix.makeTranslation(x - n / 2 + 0.5, 0.1, z - n / 2 + 0.5);
    studs.setMatrixAt(x * n + z, matrix);
  }
  studs.receiveShadow = true; scene.add(studs);
  const ground = new Mesh(new PlaneGeometry(1000, 1000), new MeshStandardMaterial({ color: 0xe7ebef, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.38; ground.receiveShadow = true; scene.add(ground);
  // The darker underside gives the plate a readable edge against the studio floor.
  const underside = new Mesh(new BoxGeometry(n - 0.1, 0.1, n - 0.1), new MeshStandardMaterial({ color: new Color(0x788e7e), roughness: 0.6 }));
  underside.position.y = -0.32; scene.add(underside);
  renderer.shadowMap.needsUpdate = true;
  const resize = () => {
    camera.aspect = root.clientWidth / root.clientHeight; camera.updateProjectionMatrix();
    renderer.setSize(root.clientWidth, root.clientHeight);
    renderer.shadowMap.needsUpdate = true;
  };
  return { scene, camera, renderer, resize };
}
