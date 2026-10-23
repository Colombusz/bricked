import { ACESFilmicToneMapping, AmbientLight, DirectionalLight, Mesh, MeshPhysicalMaterial, PerspectiveCamera, PMREMGenerator, Scene, Vector3, WebGLRenderer } from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CATALOG } from './catalog';
import { brickGeometry } from './geometry';

export function renderThumbnails() {
  const renderer = new WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(164, 108); renderer.setPixelRatio(1.5);
  renderer.setClearColor(0x000000, 0); renderer.toneMapping = ACESFilmicToneMapping; renderer.toneMappingExposure = 1;
  const scene = new Scene();
  const room = new RoomEnvironment(), pmrem = new PMREMGenerator(renderer);
  const env = pmrem.fromScene(room, 0.04); scene.environment = env.texture; scene.environmentIntensity = 0.6;
  const light = new DirectionalLight(0xffffff, 2.5); light.position.set(-3, 6, 4); scene.add(light, new AmbientLight(0xffffff, 1));
  const camera = new PerspectiveCamera(35, 164/108, 0.1, 100);
  const material = new MeshPhysicalMaterial({ color: '#e74c3c', roughness: 0.23, clearcoat: 0.8 });
  const images = new Map<string, string>();
  for (const type of CATALOG) {
    const mesh = new Mesh(brickGeometry(type), material); scene.add(mesh);
    const center = new Vector3(0, type.height * 0.2, 0);
    const distance = Math.max(type.width, type.depth, 2.7) * 2.25;
    camera.position.copy(center).add(new Vector3(0.95, 0.85, 1.25).normalize().multiplyScalar(distance));
    camera.lookAt(center);
    renderer.render(scene, camera);
    images.set(type.id, renderer.domElement.toDataURL('image/png'));
    scene.remove(mesh);
  }
  material.dispose(); env.dispose(); room.dispose(); pmrem.dispose(); renderer.dispose(); renderer.forceContextLoss();
  return images;
}
