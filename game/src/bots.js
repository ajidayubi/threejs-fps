// Bots: waypoint routes, line-of-sight checks, burst fire, and objective
// behavior. Attackers push Site R and plant; defenders hold, then defuse.
// LOS is checked at 5 Hz per bot (staggered), never every frame.
import * as THREE from 'three';
import { WAYPOINTS, nearestWaypoint, findRoute, moveCircle } from './world.js';
import { fireWeapon, startReload, updateReload } from './weapons.js';
import { PALETTE, mat } from './palette.js';

const _ray = new THREE.Raycaster();
const _eye = new THREE.Vector3();
const _to = new THREE.Vector3();
const _dir = new THREE.Vector3();

export function makeBotMesh(team) {
  const g = new THREE.Group();
  const suit = mat(team === 'vanguard' ? 0x2c4a66 : 0x5e2f26, 0.85);
  const skin = mat(0xc99b6d, 0.8);
  const trim = mat(team === 'vanguard' ? PALETTE.vanguard : PALETTE.ember, 0.5, 0.2);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 1.05, 10), suit);
  body.position.y = 0.95;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 10), skin);
  head.position.y = 1.72;
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.09, 0.1), trim);
  visor.position.set(0, 1.74, 0.24);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.11, 0.62), mat(0x22262c, 0.5, 0.6));
  gun.position.set(0.3, 1.25, 0.35);
  const pad = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.3), trim);
  pad.position.y = 1.42;
  g.add(body, head, visor, gun, pad);
  g.userData.head = head;
  g.userData.body = body;
  return g;
}

export function makeBot(id, team, x, z, yaw) {
  return {
    id, team, isPlayer: false,
    pos: new THREE.Vector3(x, 0, z),
    vel: new THREE.Vector3(),
    yaw, pitch: 0, hp: 100, armor: 0, alive: true,
    weapon: null, speed: 0, crouched: false, eyeY: 1.6,
    headPos: new THREE.Vector3(x, 1.5, z),
    bodyPos: new THREE.Vector3(x, 0.85, z),
    camera: null, viewmodel: null, recoil: 0, bobPhase: 0,
    mesh: null,
    ai: { state: 'advance', route: [], node: -1, target: null, visible: false, losT: Math.random() * 0.2, reactT: 0, burstLeft: 0, burstT: 0, strafeDir: 1, strafeT: 0, holdUntil: 0, thinkT: Math.random() * 0.3 },
  };
}

function hasLOS(world, from, to) {
  _dir.copy(to).sub(from);
  const dist = _dir.length();
  if (dist < 0.5) return true;
  _dir.normalize();
  _ray.set(from, _dir);
  _ray.far = dist;
  return _ray.intersectObjects(world.solids, false).length === 0;
}

function nearestEnemy(state, bot) {
  let best = null, bd = Infinity;
  for (const a of state.actors) {
    if (a.team === bot.team || !a.alive) continue;
    const d = a.pos.distanceToSquared(bot.pos);
    if (d < bd) { bd = d; best = a; }
  }
  return best;
}

function setRoute(bot, targetNode) {
  const from = nearestWaypoint(bot.pos.x, bot.pos.z);
  bot.ai.route = findRoute(from, targetNode);
  bot.ai.node = 0;
}

export function updateBot(state, world, bot, dt, effects, audio, onKill) {
  const ai = bot.ai;
  if (!bot.alive) return;
  ai.thinkT -= dt;
  ai.losT -= dt;

  // Periodic perception: nearest enemy + line of sight.
  if (ai.losT <= 0) {
    ai.losT = 0.2;
    ai.target = nearestEnemy(state, bot);
    if (ai.target) {
      _eye.set(bot.pos.x, 1.55, bot.pos.z);
      _to.set(ai.target.pos.x, ai.target.eyeY - 0.2, ai.target.pos.z);
      ai.visible = hasLOS(world, _eye, _to);
      if (ai.visible && ai.reactT <= 0) ai.reactT = 0.35 + Math.random() * 0.35;
    } else ai.visible = false;
  }
  if (ai.reactT > 0) ai.reactT -= dt;

  let moveTarget = null;
  let wantShoot = false;
  if (ai.visible && ai.target && ai.reactT <= 0) {
    ai.state = 'engage';
    moveTarget = null;
    wantShoot = true;
  } else if (ai.state === 'engage') {
    ai.state = 'advance';
    ai.route = [];
  }

  if (ai.thinkT <= 0) {
    ai.thinkT = 0.5;
    if (state.phase === 'live' || state.phase === 'planted') {
      if (bot.team === 'vanguard') {
        const carrier = state.spike.carrier;
        if (state.spike.state === 'planted') {
          // Attackers guard the planted spike from mid.
          if (!ai.route.length) setRoute(bot, 8);
        } else if (carrier === bot) {
          if (!ai.route.length) setRoute(bot, 11);
        } else if (!ai.route.length) {
          setRoute(bot, Math.random() < 0.5 ? 4 : 6);
        }
      } else {
        if (state.spike.state === 'planted') {
          if (!ai.route.length) setRoute(bot, 11);
        } else if (ai.holdUntil > state.time) {
          // hold position
        } else if (!ai.route.length) {
          const holds = [9, 10, 4, 6, 8];
          setRoute(bot, holds[Math.floor(Math.random() * holds.length)]);
        }
      }
    }
  }

  // Follow the route.
  if (!wantShoot && ai.route.length) {
    const wp = WAYPOINTS[ai.route[ai.node]];
    const dx = wp.x - bot.pos.x, dz = wp.z - bot.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.9) {
      ai.node++;
      if (ai.node >= ai.route.length) {
        ai.route = [];
        if (bot.team === 'ember') ai.holdUntil = state.time + 4 + Math.random() * 5;
      }
    } else {
      moveTarget = wp;
    }
  }

  // Movement.
  const speed = wantShoot ? 1.6 : 3.4;
  if (moveTarget) {
    const dx = moveTarget.x - bot.pos.x, dz = moveTarget.z - bot.pos.z;
    const d = Math.hypot(dx, dz) || 1;
    const wantYaw = Math.atan2(-dx, -dz);
    let dy = wantYaw - bot.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2;
    while (dy < -Math.PI) dy += Math.PI * 2;
    bot.yaw += dy * Math.min(1, 8 * dt);
    bot.vel.x = (dx / d) * speed;
    bot.vel.z = (dz / d) * speed;
    moveCircle(world.colliders, bot.pos, bot.vel.x * dt, bot.vel.z * dt, 0.42);
    bot.speed = speed;
  } else {
    bot.vel.x = 0; bot.vel.z = 0;
    bot.speed = 0;
    if (wantShoot && ai.target) {
      // Strafe while engaging, face the target.
      ai.strafeT -= dt;
      if (ai.strafeT <= 0) { ai.strafeT = 0.7 + Math.random(); ai.strafeDir *= -1; }
      const tx = ai.target.pos.x - bot.pos.x, tz = ai.target.pos.z - bot.pos.z;
      const wantYaw = Math.atan2(-tx, -tz);
      let dy = wantYaw - bot.yaw;
      while (dy > Math.PI) dy -= Math.PI * 2;
      while (dy < -Math.PI) dy += Math.PI * 2;
      bot.yaw += dy * Math.min(1, 10 * dt);
      const px = Math.cos(bot.yaw) * ai.strafeDir, pz = -Math.sin(bot.yaw) * ai.strafeDir;
      moveCircle(world.colliders, bot.pos, px * 1.4 * dt, pz * 1.4 * dt, 0.42);
    }
  }

  // Shooting in bursts with error that grows with range and target speed.
  if (wantShoot && ai.target) {
    const def = bot.weapon.defId;
    ai.burstT -= dt;
    if (ai.burstLeft > 0 && ai.burstT <= 0) {
      ai.burstLeft--;
      ai.burstT = 60 / 600;
      const t = ai.target;
      const dist = bot.pos.distanceTo(t.pos);
      const err = 0.02 + dist * 0.0012 + (t.speed > 1 ? 0.03 : 0);
      _eye.set(bot.pos.x, 1.55, bot.pos.z);
      _to.set(t.pos.x, t.eyeY - 0.3, t.pos.z);
      _dir.copy(_to).sub(_eye).normalize();
      _dir.x += (Math.random() * 2 - 1) * err;
      _dir.y += (Math.random() * 2 - 1) * err * 0.7;
      _dir.z += (Math.random() * 2 - 1) * err;
      _dir.normalize();
      const res = fireWeapon(state, world, bot, _eye, _dir, effects, audio, state.time);
      if (res && res.killed) onKill(bot, res.hit, res.head);
      if (bot.weapon.mag <= 0) startReload(bot.weapon, state.time);
    } else if (ai.burstLeft <= 0 && ai.burstT <= -0.9) {
      ai.burstLeft = 3 + Math.floor(Math.random() * 3);
      ai.burstT = 0;
    }
  }
  updateReload(bot.weapon, state.time, audio);
  bot.weapon.bloom = Math.max(0, bot.weapon.bloom - dt * 1.5);

  // Sync the mesh and hit spheres.
  bot.headPos.set(bot.pos.x, 1.5, bot.pos.z);
  bot.bodyPos.set(bot.pos.x, 0.85, bot.pos.z);
  if (bot.mesh) {
    bot.mesh.position.set(bot.pos.x, 0, bot.pos.z);
    bot.mesh.rotation.y = bot.yaw;
  }
}

export function killMesh(bot) {
  if (!bot.mesh) return;
  bot.mesh.rotation.z = Math.PI / 2;
  bot.mesh.position.y = 0.15;
}
