import { Box3, MathUtils, PerspectiveCamera, Quaternion, Spherical, Vector2, Vector3 } from 'three';
import { CONFIG, DEFAULT_SETTINGS } from './config';
import { isEditing } from './input';
import type { Settings } from './settingsStore';

export class CameraController {
  settings: Settings = {...DEFAULT_SETTINGS};
  readonly pivot = new Vector3(0, 1.5, 0);
  readonly targetPosition = new Vector3(29, 27, 34);
  private targetQuaternion = new Quaternion();
  private velocity = new Vector3();
  private keys = new Set<string>();
  private mode: 'fly' | 'orbit' | 'pan' | null = null;
  private last = new Vector2();
  private touches = new Map<number, Vector2>();
  private yaw = 0;
  private pitch = 0;
  private speed: number = CONFIG.flySpeed;
  private framing = false;
  private viewportInsets = { top: 0, right: 0, bottom: 0, left: 0 };
  onChange = () => {};
  get navigating() { return this.mode !== null || this.touches.size > 0; }
  get flying() { return this.mode === 'fly'; }

  constructor(readonly camera: PerspectiveCamera, readonly canvas: HTMLCanvasElement) {
    this.targetPosition.multiplyScalar(Math.max(1, 0.86 / camera.aspect));
    camera.position.copy(this.targetPosition);
    camera.lookAt(this.pivot);
    this.targetQuaternion.copy(camera.quaternion);
    this.readAngles();
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('pointerdown', e => this.down(e));
    window.addEventListener('pointermove', e => this.move(e));
    window.addEventListener('pointerup', e => this.up(e));
    canvas.addEventListener('pointercancel', e => this.up(e));
    canvas.addEventListener('wheel', e => this.wheel(e), { passive: false });
    window.addEventListener('keydown', e => {
      if (isEditing(e.target) || document.querySelector('dialog[open]')) return;
      this.keys.add(e.code);
      if (this.flying && ['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','Space'].includes(e.code)) e.preventDefault();
      this.onChange();
    });
    window.addEventListener('keyup', e => { this.keys.delete(e.code); this.onChange(); });
    window.addEventListener('blur', () => { this.keys.clear(); this.endFly(); this.mode = null; this.touches.clear(); });
    document.addEventListener('pointerlockchange', () => { if (!document.pointerLockElement) this.endFly(); });
  }

  private readAngles() {
    const d = new Vector3(0, 0, -1).applyQuaternion(this.targetQuaternion);
    this.yaw = Math.atan2(-d.x, -d.z);
    this.pitch = Math.asin(d.y);
  }

  private down(e: PointerEvent) {
    if (e.pointerType === 'touch') {
      this.touches.set(e.pointerId, new Vector2(e.clientX, e.clientY));
      this.canvas.setPointerCapture(e.pointerId);
      this.framing = false;
      this.onChange();
      return;
    }
    this.framing = false;
    this.last.set(e.clientX, e.clientY);
    if (e.button === 2) {
      this.mode = 'fly';
      this.readAngles();
      try { this.canvas.requestPointerLock()?.catch(() => {}); } catch { /* Drag look works when pointer lock is unavailable. */ }
    } else if (e.button === 1) { this.mode = 'pan'; e.preventDefault(); }
    else if (e.button === 0 && e.altKey) this.mode = 'orbit';
    if (this.mode) { this.canvas.classList.add('navigating'); this.onChange(); }
  }

  private move(e: PointerEvent) {
    if (e.pointerType === 'touch' && this.touches.has(e.pointerId)) {
      const old = this.touches.get(e.pointerId)!;
      const next = new Vector2(e.clientX, e.clientY);
      const delta = next.clone().sub(old);
      if (this.touches.size === 1) this.orbit(delta.x, delta.y);
      else {
        const other = [...this.touches.entries()].find(([id]) => id !== e.pointerId)![1];
        const before = old.distanceTo(other);
        const after = next.distanceTo(other);
        if (before > 0 && after > 0) this.dolly(Math.log(before / after));
        this.pan(delta.x / 2, delta.y / 2);
      }
      this.touches.set(e.pointerId, next);
      this.onChange();
      return;
    }
    if (!this.mode) return;
    const locked = document.pointerLockElement === this.canvas;
    const dx = locked ? e.movementX : e.clientX - this.last.x;
    const dy = locked ? e.movementY : e.clientY - this.last.y;
    this.last.set(e.clientX, e.clientY);
    if (this.mode === 'orbit') this.orbit(dx, dy);
    if (this.mode === 'pan') this.pan(dx, dy);
    if (this.mode === 'fly') {
      const multiplier=this.settings.master*this.settings.rotation;
      this.yaw -= dx * CONFIG.lookSensitivity * multiplier;
      this.pitch = MathUtils.clamp(this.pitch - dy * CONFIG.lookSensitivity * multiplier * (this.settings.invertY?-1:1), -Math.PI * 0.4944, Math.PI * 0.4944);
      const direction = new Vector3(-Math.sin(this.yaw) * Math.cos(this.pitch), Math.sin(this.pitch), -Math.cos(this.yaw) * Math.cos(this.pitch));
      const temporary = this.camera.clone();
      temporary.position.copy(this.targetPosition);
      temporary.lookAt(this.targetPosition.clone().add(direction));
      this.targetQuaternion.copy(temporary.quaternion);
      this.pivot.copy(this.targetPosition).addScaledVector(direction, 20);
    }
    this.onChange();
  }

  private up(e: PointerEvent) {
    this.touches.delete(e.pointerId);
    if (e.button === 2) this.endFly();
    if (e.pointerType !== 'touch') this.mode = null;
    this.canvas.classList.remove('navigating');
    this.onChange();
  }

  private endFly() {
    if (this.mode === 'fly') this.mode = null;
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
    this.canvas.classList.remove('navigating');
    this.onChange();
  }

  private orbit(dx: number, dy: number) {
    const s = new Spherical().setFromVector3(this.targetPosition.clone().sub(this.pivot));
    const multiplier=this.settings.master*this.settings.rotation;
    s.theta -= dx * CONFIG.orbitSensitivity * multiplier;
    s.phi = MathUtils.clamp(s.phi - dy * CONFIG.orbitSensitivity * multiplier * (this.settings.invertY?-1:1), 0.035, Math.PI - 0.035);
    this.targetPosition.copy(this.pivot).add(new Vector3().setFromSpherical(s));
    this.targetPosition.y = Math.max(CONFIG.cameraMinHeight, this.targetPosition.y);
    this.aimAtPivot();
  }

  private pan(dx: number, dy: number) {
    const distance = this.targetPosition.distanceTo(this.pivot);
    const scale = distance * Math.tan(MathUtils.degToRad(CONFIG.fov / 2)) * 2 / this.canvas.clientHeight * this.settings.master * this.settings.pan;
    const offset = new Vector3(-dx * scale, dy * scale, 0).applyQuaternion(this.targetQuaternion);
    this.pivot.add(offset); this.targetPosition.add(offset);
    this.targetPosition.y = Math.max(CONFIG.cameraMinHeight, this.targetPosition.y);
  }

  private dolly(delta: number) {
    const offset = this.targetPosition.clone().sub(this.pivot);
    offset.multiplyScalar(Math.exp(delta*this.settings.master*this.settings.zoom));
    offset.clampLength(CONFIG.minDollyDistance, CONFIG.maxDollyDistance);
    this.targetPosition.copy(this.pivot).add(offset);
    this.targetPosition.y = Math.max(CONFIG.cameraMinHeight, this.targetPosition.y);
  }

  private wheel(e: WheelEvent) {
    e.preventDefault(); this.framing = false;
    if (this.flying) this.speed = MathUtils.clamp(this.speed * Math.exp(-e.deltaY * CONFIG.flyWheelSensitivity), 1, 100);
    else this.dolly(MathUtils.clamp(e.deltaY * CONFIG.dollySensitivity, -0.5, 0.5));
    this.onChange();
  }

  private aimAtPivot() {
    const temporary = this.camera.clone(); temporary.position.copy(this.targetPosition); temporary.lookAt(this.pivot);
    this.targetQuaternion.copy(temporary.quaternion);
  }

  setViewportInsets(insets: typeof this.viewportInsets) {
    this.viewportInsets = insets;
    const width = this.canvas.clientWidth, height = this.canvas.clientHeight;
    if (!width || !height) return;
    this.camera.setViewOffset(width, height, (insets.right - insets.left) / 2, (insets.bottom - insets.top) / 2, width, height);
    this.onChange();
  }

  frame(bounds?: Box3) {
    const size = bounds && !bounds.isEmpty() ? bounds.getSize(new Vector3()) : new Vector3(32, 0, 32);
    this.pivot.copy(bounds && !bounds.isEmpty() ? bounds.getCenter(new Vector3()) : new Vector3(0, 0, 0));
    const extent = Math.max(size.x, size.y, size.z, 10);
    const { top, right, bottom, left } = this.viewportInsets;
    const available = Math.min((this.canvas.clientWidth - left - right) / this.canvas.clientWidth, (this.canvas.clientHeight - top - bottom) / this.canvas.clientHeight);
    const distance = extent / (2 * Math.tan(Math.PI / 6)) * 1.55 / Math.min(1, this.camera.aspect) / Math.max(0.3, available);
    const direction = this.targetPosition.clone().sub(this.pivot).normalize();
    if (direction.y < 0.2) direction.set(0.6, 0.6, 0.8).normalize();
    this.targetPosition.copy(this.pivot).addScaledVector(direction, distance);
    this.targetPosition.y = Math.max(3, this.targetPosition.y);
    this.aimAtPivot(); this.framing = true; this.onChange();
  }

  snapAxis(axis: 'x' | 'y' | 'z') {
    const distance = this.targetPosition.distanceTo(this.pivot);
    const direction = axis === 'x' ? new Vector3(1, 0.15, 0) : axis === 'y' ? new Vector3(0.001, 1, 0) : new Vector3(0, 0.15, 1);
    this.targetPosition.copy(this.pivot).addScaledVector(direction.normalize(), distance);
    this.aimAtPivot(); this.framing = true; this.onChange();
  }

  update(dt: number) {
    const desired = new Vector3();
    if (this.flying) {
      const forward = new Vector3(0, 0, -1).applyQuaternion(this.targetQuaternion);
      const right = new Vector3(1, 0, 0).applyQuaternion(this.targetQuaternion);
      if (this.keys.has('KeyW')) desired.add(forward);
      if (this.keys.has('KeyS')) desired.sub(forward);
      if (this.keys.has('KeyD')) desired.add(right);
      if (this.keys.has('KeyA')) desired.sub(right);
      if (this.keys.has('KeyE')) desired.y += 1;
      if (this.keys.has('KeyQ')) desired.y -= 1;
      desired.normalize().multiplyScalar(this.speed * this.settings.master * this.settings.fly * (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? 3 : 1));
    }
    const smoothing = 1 - Math.exp(-CONFIG.cameraDamping * dt);
    this.velocity.lerp(desired, smoothing);
    this.targetPosition.addScaledVector(this.velocity, dt);
    this.targetPosition.y = Math.max(CONFIG.cameraMinHeight, this.targetPosition.y);
    const changed = this.camera.position.distanceToSquared(this.targetPosition) > 0.000001 || this.camera.quaternion.angleTo(this.targetQuaternion) > 0.0001;
    this.camera.position.lerp(this.targetPosition, smoothing);
    this.camera.quaternion.slerp(this.targetQuaternion, smoothing);
    this.camera.updateMatrixWorld();
    if (!changed) this.framing = false;
    return changed || this.velocity.lengthSq() > 0.00001 || this.framing;
  }
}
