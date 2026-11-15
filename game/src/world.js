// The map: Sector 7, a walled desert-industrial yard. Lanes, corners and
// sightlines are deliberate: a west hall, an east crate lane, a mid courtyard
// and the reactor pad (Site R) at the south end. Collision is AABBs.
import * as THREE from 'three';
import { PALETTE, mat, emissive, hazardTexture, stripeTexture } from './palette.js';

export const BOUNDS = { x: 32, z: 22 };

export function buildWorld(scene) {
  const colliders = [];   // {x0,z0,x1,z1,top}
  const solids = [];      // meshes the raycaster tests for bullet hits
  const group = new THREE.Group();
  scene.add(group);

  const addBox = (x, z, w, d, h, material, y = 0, collide = true) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x, y + h / 2, z);
    m.castShadow = false;
    m.receiveShadow = true;
    group.add(m);
    solids.push(m);
    if (collide) colliders.push({ x0: x - w / 2, z0: z - d / 2, x1: x + w / 2, z1: z + d / 2, top: y + h });
    return m;
  };

  // Ground: two-tone slabs so movement reads on the floor.
  const groundMat = mat(PALETTE.ground, 0.96);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(BOUNDS.x * 2, BOUNDS.z * 2), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);
  const stripe = stripeTexture('#a8895c', '#97784d');
  stripe.repeat.set(16, 11);
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(BOUNDS.x * 2, BOUNDS.z * 2), new THREE.MeshStandardMaterial({ map: stripe, roughness: 1 }));
  apron.rotation.x = -Math.PI / 2;
  apron.position.y = 0.01;
  apron.receiveShadow = true;
  group.add(apron);

  // Perimeter walls.
  const wallM = mat(PALETTE.wall, 0.95);
  const wallTopM = mat(PALETTE.wallTop, 0.95);
  addBox(0, -BOUNDS.z - 1, BOUNDS.x * 2 + 4, 2, 5, wallM);
  addBox(0, BOUNDS.z + 1, BOUNDS.x * 2 + 4, 2, 5, wallM);
  addBox(-BOUNDS.x - 1, 0, 2, BOUNDS.z * 2 + 4, 5, wallM);
  addBox(BOUNDS.x + 1, 0, 2, BOUNDS.z * 2 + 4, 5, wallM);
  addBox(0, -BOUNDS.z - 1, BOUNDS.x * 2 + 4, 2.4, 0.5, wallTopM, 5);
  addBox(0, BOUNDS.z + 1, BOUNDS.x * 2 + 4, 2.4, 0.5, wallTopM, 5);

  // West lane: the Long Hall — two parallel walls with a gap, crates at its mouth.
  addBox(-21, -6, 1.2, 16, 3.4, wallM);
  addBox(-21, 8, 1.2, 12, 3.4, wallM);
  addBox(-26, -14, 8, 1.2, 2.6, wallM);
  addBox(-14, 14, 6, 1.2, 2.6, wallM);
  addBox(-26, 2, 3, 3, 1.4, mat(PALETTE.crate, 0.9));
  addBox(-26, 5.5, 3, 3, 1.4, mat(PALETTE.crateAlt, 0.9));
  addBox(-26, 3.7, 3, 3, 1.4, mat(PALETTE.crate, 0.9), 1.4);

  // East lane: crate maze with two sightline breaks.
  addBox(22, -8, 4, 4, 1.5, mat(PALETTE.crateAlt, 0.9));
  addBox(22, -3.4, 4, 4, 1.5, mat(PALETTE.crate, 0.9));
  addBox(22, -5.7, 4, 4, 1.5, mat(PALETTE.crateAlt, 0.9), 1.5);
  addBox(26, 4, 3, 3, 1.2, mat(PALETTE.crate, 0.9));
  addBox(18, 10, 5, 1.2, 2.8, wallM);
  addBox(26, 12, 3, 3, 1.4, mat(PALETTE.crateAlt, 0.9));
  addBox(14, -16, 4, 2, 1.1, mat(PALETTE.crate, 0.9));

  // Mid courtyard: low barriers and a double crate that blocks the long sightline.
  addBox(-4, 0, 5, 1.2, 1.3, mat(PALETTE.metalDark, 0.6, 0.4));
  addBox(6, 4, 5, 1.2, 1.3, mat(PALETTE.metalDark, 0.6, 0.4));
  addBox(0, -4, 3.4, 3.4, 1.5, mat(PALETTE.crate, 0.9));
  addBox(0, -4, 3.4, 3.4, 1.5, mat(PALETTE.crateAlt, 0.9), 1.5);
  addBox(-10, 8, 3, 3, 1.2, mat(PALETTE.crateAlt, 0.9));

  // Site R: the reactor pad at the south end, ringed by hazard paint.
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(5.2, 5.6, 0.35, 24), mat(PALETTE.metalDark, 0.7, 0.3));
  pad.position.set(0, 0.18, -14);
  pad.receiveShadow = true;
  group.add(pad);
  const reactor = new THREE.Mesh(new THREE.CylinderGeometry(2.0, 2.4, 4.6, 18), mat(0x3d6079, 0.5, 0.3));
  reactor.position.set(0, 2.65, -14);
  group.add(reactor);
  solids.push(reactor);
  colliders.push({ x0: -2.4, z0: -16.4, x1: 2.4, z1: -11.6, top: 4.95 });
  const glow = new THREE.Mesh(new THREE.TorusGeometry(2.6, 0.12, 10, 32), emissive(PALETTE.reactorGlow, 1.6));
  glow.rotation.x = Math.PI / 2;
  glow.position.set(0, 4.95, -14);
  group.add(glow);
  const glowBand = new THREE.Mesh(new THREE.TorusGeometry(2.15, 0.09, 10, 32), emissive(PALETTE.reactorGlow, 1.1));
  glowBand.rotation.x = Math.PI / 2;
  glowBand.position.set(0, 2.6, -14);
  group.add(glowBand);
  const hz = new THREE.Mesh(new THREE.PlaneGeometry(12, 0.9), new THREE.MeshStandardMaterial({ map: hazardTexture(), roughness: 0.9 }));
  hz.rotation.x = -Math.PI / 2;
  hz.position.set(0, 0.03, -8.2);
  group.add(hz);
  // Pipes behind the reactor.
  addBox(-6, -19.5, 1.4, 1.4, 5.5, mat(PALETTE.metal, 0.5, 0.6));
  addBox(6, -19.5, 1.4, 1.4, 5.5, mat(PALETTE.metal, 0.5, 0.6));
  addBox(0, -20.5, 13, 1.2, 2.2, mat(PALETTE.metalDark, 0.6, 0.4));

  // Spawn cover: a low wall near each spawn so the first seconds are safe.
  addBox(-8, 16, 10, 1.2, 1.4, mat(PALETTE.wall, 0.95));
  addBox(10, -17, 10, 1.2, 1.4, mat(PALETTE.wall, 0.95));

  // Sky: big gradient dome + sun disc + a few drifting dust motes are in effects.
  const sky = new THREE.Mesh(new THREE.SphereGeometry(220, 16, 12), new THREE.MeshBasicMaterial({ color: PALETTE.sky, side: THREE.BackSide, fog: false }));
  scene.add(sky);
  const sun = new THREE.Mesh(new THREE.CircleGeometry(14, 24), new THREE.MeshBasicMaterial({ color: PALETTE.sun, fog: false }));
  sun.position.set(-90, 110, -160);
  sun.lookAt(0, 0, 0);
  scene.add(sun);

  return { colliders, solids, group };
}

// Circle-vs-AABB slide: move x then z, clamping against every collider.
export function moveCircle(colliders, pos, dx, dz, radius) {
  let nx = pos.x + dx;
  for (const c of colliders) {
    if (nx + radius > c.x0 && nx - radius < c.x1 && pos.z + radius > c.z0 && pos.z - radius < c.z1) {
      nx = dx > 0 ? c.x0 - radius : c.x1 + radius;
    }
  }
  pos.x = nx;
  let nz = pos.z + dz;
  for (const c of colliders) {
    if (pos.x + radius > c.x0 && pos.x - radius < c.x1 && nz + radius > c.z0 && nz - radius < c.z1) {
      nz = dz > 0 ? c.z0 - radius : c.z1 + radius;
    }
  }
  pos.z = nz;
  pos.x = Math.max(-BOUNDS.x + 0.6, Math.min(BOUNDS.x - 0.6, pos.x));
  pos.z = Math.max(-BOUNDS.z + 0.6, Math.min(BOUNDS.z - 0.6, pos.z));
}

// Waypoint graph the bots walk: nodes with edges a bot can take.
export const WAYPOINTS = [
  { x: 0, z: 18 },    // 0 vanguard spawn
  { x: -12, z: 16 },  // 1
  { x: 12, z: 16 },   // 2
  { x: -21, z: 2 },   // 3 west hall
  { x: -21, z: -11 }, // 4 west exit
  { x: 22, z: 0 },    // 5 east lane
  { x: 22, z: -12 },  // 6 east exit
  { x: 0, z: 6 },     // 7 mid north
  { x: 0, z: -6 },    // 8 mid south
  { x: -10, z: -14 }, // 9 site west
  { x: 10, z: -14 },  // 10 site east
  { x: 0, z: -14 },   // 11 site R
  { x: -12, z: -18 }, // 12 ember spawn west
  { x: 12, z: -18 },  // 13 ember spawn east
  { x: 0, z: -18 },   // 14 ember spawn
];
export const EDGES = [
  [0, 1], [0, 2], [0, 7], [1, 3], [1, 7], [2, 5], [2, 7], [3, 4], [3, 7],
  [4, 9], [4, 8], [5, 6], [5, 8], [6, 10], [6, 8], [7, 8], [8, 9], [8, 10],
  [8, 11], [9, 11], [10, 11], [9, 12], [10, 13], [11, 12], [11, 13],
  [12, 14], [13, 14], [4, 12], [6, 13],
];

export function nearestWaypoint(x, z) {
  let best = 0, bd = Infinity;
  for (let i = 0; i < WAYPOINTS.length; i++) {
    const dx = WAYPOINTS[i].x - x, dz = WAYPOINTS[i].z - z;
    const d = dx * dx + dz * dz;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

// Breadth-first route over the waypoint graph.
export function findRoute(from, to) {
  if (from === to) return [to];
  const prev = new Array(WAYPOINTS.length).fill(-1);
  const q = [from];
  prev[from] = from;
  while (q.length) {
    const n = q.shift();
    for (const [a, b] of EDGES) {
      const m = a === n ? b : b === n ? a : -1;
      if (m >= 0 && prev[m] === -1) {
        prev[m] = n;
        if (m === to) {
          const path = [to];
          let c = to;
          while (c !== from) { c = prev[c]; path.unshift(c); }
          return path;
        }
        q.push(m);
      }
    }
  }
  return [to];
}
