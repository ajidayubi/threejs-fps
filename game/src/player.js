// The player: acceleration-based movement, crouch, collision, camera and
// the viewmodel gun. Position lives in the actor; the mesh follows it.
import * as THREE from 'three';
import { moveCircle } from './world.js';

const EYE_STAND = 1.62;
const EYE_CROUCH = 1.12;
const RADIUS = 0.42;

export function updatePlayer(state, world, input, dt) {
  const p = state.actors[state.playerId];
  if (!p.alive) return;
  const mouse = input.consumeMouse();
  p.yaw -= mouse.dx * 0.0021;
  p.pitch = Math.max(-1.5, Math.min(1.5, p.pitch - mouse.dy * 0.0021));

  const k = input.keys;
  p.crouched = k.has('KeyC') || k.has('ControlLeft');
  const sprint = k.has('ShiftLeft') && !p.crouched;
  const fwd = (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 1 : 0);
  const strafe = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0);
  const speed = p.crouched ? 2.1 : sprint ? 5.6 : 4.2;
  const sin = Math.sin(p.yaw), cos = Math.cos(p.yaw);
  // Forward is -Z rotated by yaw; right is +X rotated by yaw.
  const wx = (-sin) * fwd + cos * strafe;
  const wz = (-cos) * fwd + (-sin) * strafe;
  const len = Math.hypot(wx, wz) || 1;
  const tx = (wx / len) * speed * (fwd || strafe ? 1 : 0);
  const tz = (wz / len) * speed * (fwd || strafe ? 1 : 0);
  const accel = 14;
  p.vel.x += (tx - p.vel.x) * Math.min(1, accel * dt);
  p.vel.z += (tz - p.vel.z) * Math.min(1, accel * dt);
  moveCircle(world.colliders, p.pos, p.vel.x * dt, p.vel.z * dt, RADIUS);
  p.speed = Math.hypot(p.vel.x, p.vel.z);

  const eye = p.crouched ? EYE_CROUCH : EYE_STAND;
  p.eyeY += (eye - p.eyeY) * Math.min(1, 12 * dt);
  p.camera.position.set(p.pos.x, p.eyeY, p.pos.z);
  p.camera.rotation.set(p.pitch, p.yaw, 0, 'YXZ');
  p.headPos.set(p.pos.x, p.eyeY - 0.15, p.pos.z);
  p.bodyPos.set(p.pos.x, p.eyeY - 0.75, p.pos.z);
  updateViewmodel(p, dt);
}

// A low-poly gun built from boxes, parented to the camera so it never clips.
export function buildViewmodel(camera, color) {
  const g = new THREE.Group();
  const dark = new THREE.MeshStandardMaterial({ color: 0x3d434c, roughness: 0.45, metalness: 0.55 });
  const accent = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.3 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.4), dark);
  body.position.set(0, 0, -0.08);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.24, 8), dark);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.015, -0.38);
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.13, 0.08), accent);
  grip.position.set(0, -0.1, 0.06);
  grip.rotation.x = 0.3;
  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.04, 0.06), accent);
  sight.position.set(0, 0.07, -0.12);
  g.add(body, barrel, grip, sight);
  g.scale.setScalar(0.72);
  g.position.set(0.24, -0.22, -0.4);
  camera.add(g);
  return g;
}

function updateViewmodel(p, dt) {
  if (!p.viewmodel) return;
  // Walk bob and recoil kick, both decaying; no allocations.
  p.bobPhase += p.speed * dt * 1.6;
  const bob = Math.min(1, p.speed / 4) * 0.012;
  p.recoil = Math.max(0, p.recoil - dt * 0.35);
  p.viewmodel.position.y = -0.22 + Math.sin(p.bobPhase * 2) * bob + p.recoil * 0.06;
  p.viewmodel.position.x = 0.24 + Math.cos(p.bobPhase) * bob * 0.5;
  p.viewmodel.rotation.x = p.recoil * 0.35;
}
