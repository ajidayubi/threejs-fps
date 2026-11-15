// DUSTLINE — Sector 7. Bootstrap, fixed-step simulation and rendering.
// The sim runs at a fixed 60 Hz and is kept apart from rendering; the state
// store is the single source of truth for every module.
import * as THREE from 'three';
import { createState, PHASE, WEAPONS, ECONOMY } from './state.js';
import { buildWorld } from './world.js';
import { createInput } from './input.js';
import { updatePlayer, buildViewmodel } from './player.js';
import { makeBot, makeBotMesh, updateBot, killMesh } from './bots.js';
import { fireWeapon, startReload, updateReload, throwGrenade, updateGrenades, makeLoadout } from './weapons.js';
import { createEffects } from './effects.js';
import { createAudio } from './audio.js';
import { createHud } from './hud.js';
import { setupRound, startLive, buyItem, onKill, checkRoundEnd, endRound, plantTick, updatePlant, updateDefuse, aliveCount } from './rounds.js';
import { parseShot, applyShot } from './shots.js';
import { PALETTE } from './palette.js';

const STEP = 1 / 60;

function makeActor(id, team, isPlayer) {
  return {
    id, team, isPlayer,
    pos: new THREE.Vector3(0, 0, 18),
    vel: new THREE.Vector3(),
    yaw: 0, pitch: 0, hp: 100, armor: 0, armorKept: false, alive: true,
    weapon: makeLoadout('pistol'), loadouts: {}, owned: ['pistol'],
    speed: 0, crouched: false, eyeY: 1.62,
    headPos: new THREE.Vector3(), bodyPos: new THREE.Vector3(),
    camera: null, viewmodel: null, recoil: 0, bobPhase: 0,
    mesh: null, ai: null,
  };
}

const app = document.getElementById('app');
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.18;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(PALETTE.fog, 55, 190);
scene.background = new THREE.Color(0x9fc3e0);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.08, 400);
scene.add(camera);

const hemi = new THREE.HemisphereLight(0xbfd4e6, 0x8a6f4d, 1.25);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe3b3, 2.4);
sun.position.set(-40, 60, -30);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -45; sun.shadow.camera.right = 45;
sun.shadow.camera.top = 45; sun.shadow.camera.bottom = -45;
sun.shadow.camera.far = 180;
scene.add(sun);

const world = buildWorld(scene);
const effects = createEffects(scene);
const audio = createAudio();
const state = createState();
const input = createInput(renderer.domElement);

// Roster: the player + 4 Vanguard bots vs 5 Ember bots.
const player = makeActor(0, 'vanguard', true);
player.camera = camera;
player.viewmodel = buildViewmodel(camera, PALETTE.vanguard);
player.loadouts.pistol = player.weapon;
state.actors.push(player);
const botDefs = [
  { team: 'vanguard', gun: 'rifle' }, { team: 'vanguard', gun: 'rifle' },
  { team: 'vanguard', gun: 'smg' }, { team: 'vanguard', gun: 'smg' },
  { team: 'ember', gun: 'rifle' }, { team: 'ember', gun: 'rifle' },
  { team: 'ember', gun: 'smg' }, { team: 'ember', gun: 'sniper' },
  { team: 'ember', gun: 'rifle' },
];
botDefs.forEach((d, i) => {
  const b = makeBot(i + 1, d.team, 0, 0, 0);
  b.weapon = makeLoadout(d.gun);
  b.weapon.reserve = 999;
  b.mesh = makeBotMesh(d.team);
  scene.add(b.mesh);
  state.actors.push(b);
});

const hud = createHud(state, {
  buy: (id) => {
    const ok = buyItem(state, id, audio);
    if (ok && (id === 'rifle' || id === 'smg' || id === 'sniper')) {
      player.loadouts[id] = player.weapon;
      player.owned.push(id);
    }
    return ok;
  },
});

let semiLatch = false;

function switchWeapon(id) {
  if (!player.owned.includes(id) || player.weapon.defId === id) return;
  if (!player.loadouts[id]) player.loadouts[id] = makeLoadout(id);
  player.weapon = player.loadouts[id];
  audio.click();
}

input.onKey = (code) => {
  if (state.phase === PHASE.MENU || state.phase === PHASE.MATCH_END) return;
  if (code === 'KeyR') startReload(player.weapon, state.time);
  if (code === 'KeyG') {
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const origin = camera.position.clone().addScaledVector(dir, 0.5);
    if (throwGrenade(state, world, player, origin, dir, state.time)) audio.click();
  }
  if (code === 'Digit1') switchWeapon('pistol');
  if (code === 'Digit2') switchWeapon('rifle');
  if (code === 'Digit3') switchWeapon('smg');
  if (code === 'Digit4') switchWeapon('sniper');
  if (code === 'KeyB' && state.phase === PHASE.BUY) {
    hud.hideBuy();
    startLive(state);
    input.requestLock();
  }
  if (code === 'KeyM') audio.setMuted(!state.muted);
};

document.getElementById('play-btn').onclick = () => {
  audio.unlock();
  hud.hideMenu();
  setupRound(state, true);
  hud.setPhase(PHASE.BUY);
};
document.getElementById('buy-close').onclick = () => {
  hud.hideBuy();
  startLive(state);
  input.requestLock();
};
document.getElementById('again-btn').onclick = () => {
  state.score.vanguard = 0; state.score.ember = 0;
  state.round = 1; state.money = ECONOMY.start;
  state.kills = 0; state.deaths = 0;
  player.owned = ['pistol'];
  player.loadouts = { pistol: makeLoadout('pistol') };
  player.weapon = player.loadouts.pistol;
  player.armor = 0; player.armorKept = false;
  hud.hideEnd();
  setupRound(state, true);
  hud.setPhase(PHASE.BUY);
};
renderer.domElement.addEventListener('click', () => {
  if ((state.phase === PHASE.LIVE || state.phase === PHASE.PLANTED) && !input.locked) input.requestLock();
});

function playerShoot() {
  const w = player.weapon;
  const def = WEAPONS[w.defId];
  const origin = camera.position.clone();
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  // Recoil kicks the view up; bloom is handled in fireWeapon.
  const res = fireWeapon(state, world, player, origin, dir, effects, audio, state.time);
  if (res) {
    player.pitch += def.kick * 0.55;
    player.recoil = Math.min(1, player.recoil + def.kick * 2.2);
    if (res.hit) {
      hud.showHit(res.head);
      if (res.killed) {
        onKill(state, player, res.hit, res.head, audio);
        killMesh(res.hit);
      }
    }
    if (w.mag <= 0) startReload(w, state.time);
  }
}

function sim(dt) {
  state.time += dt;
  state.plantHeld = input.keys.has('KeyE');
  const p = player;
  const phaseBefore = state.phase;

  if (state.phase === PHASE.LIVE || state.phase === PHASE.PLANTED) {
    if (state.phase === PHASE.LIVE) {
      state.roundTime -= dt;
      if (state.roundTime <= 0) {
        // Time expired before a plant: defenders take the round.
        endRound(state, 'ember', 'TIME EXPIRED — SPIKE NOT PLANTED', audio);
      }
    }
    if (state.phase === PHASE.PLANTED) plantTick(state, dt, audio);

    if (p.alive && (input.locked || state.shot)) {
      updatePlayer(state, world, input, dt);
      const def = WEAPONS[p.weapon.defId];
      if (input.firing && !p.weapon.reloading) {
        if (def.auto) playerShoot();
        else if (!semiLatch) { playerShoot(); semiLatch = true; }
      }
      if (!input.firing) semiLatch = false;
      updateReload(p.weapon, state.time, audio);
      p.weapon.bloom = Math.max(0, p.weapon.bloom - dt * 1.2);
    }
    for (const a of state.actors) {
      if (!a.isPlayer) updateBot(state, world, a, dt, effects, audio, (killer, victim, head) => {
        onKill(state, killer, victim, head, audio);
        killMesh(victim);
        if (victim.isPlayer) {
          input.releaseLock();
          state.banner = { text: 'YOU ARE DOWN', sub: 'Your team fights on — spectate from here', until: state.time + 3 };
          audio.hurt();
        }
      });
    }
    updateGrenades(state, world, dt, effects, audio, (victim, owner, head, boom) => {
      onKill(state, owner, victim, head, audio);
      killMesh(victim);
    });
    updatePlant(state, dt, audio);
    updateDefuse(state, dt, audio);
    checkRoundEnd(state, audio);
    // Any transition into ROUND_END starts the same 4-second banner pause.
    if (state.phase === PHASE.ROUND_END && phaseBefore !== PHASE.ROUND_END) state.roundEndAt = state.time + 4;
  } else if (state.phase === PHASE.ROUND_END) {
    if (state.time >= state.roundEndAt) {
      if (state.score.vanguard >= state.roundsToWin || state.score.ember >= state.roundsToWin) {
        state.phase = PHASE.MATCH_END;
        input.releaseLock();
        hud.showEnd(state.score.vanguard > state.score.ember);
      } else {
        state.round += 1;
        setupRound(state, false);
        hud.setPhase(PHASE.BUY);
      }
    }
  }
  effects.update(dt, state.time);
  hud.tick(dt);
}

function render() {
  for (const a of state.actors) {
    if (a.isPlayer) continue;
    if (a.mesh) {
      a.mesh.position.set(a.pos.x, 0, a.pos.z);
      a.mesh.rotation.y = a.yaw;
    }
  }
  // The camera follows the player every frame, including phases where the
  // sim does not step the player (buy, round end, screenshot poses).
  if (player.alive) {
    camera.position.set(player.pos.x, player.eyeY, player.pos.z);
    camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');
  }
  // Grenade meshes: one small sphere per live grenade, created on demand.
  for (const g of state.grenades) {
    if (!g.mesh) {
      g.mesh = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), new THREE.MeshStandardMaterial({ color: 0x2a2e33, roughness: 0.4, metalness: 0.7 }));
      scene.add(g.mesh);
    }
    g.mesh.position.copy(g.pos);
  }
  if (!player.alive) {
    camera.position.y = Math.max(0.55, camera.position.y - 0.02);
    camera.rotation.z = 0.35;
  } else camera.rotation.z = 0;
  renderer.render(scene, camera);
}

let last = performance.now();
let acc = 0;
function loop(now) {
  requestAnimationFrame(loop);
  let frame = (now - last) / 1000;
  last = now;
  if (frame > 0.25) frame = 0.25;
  acc += frame;
  let steps = 0;
  while (acc >= STEP && steps < 5) {
    sim(STEP);
    acc -= STEP;
    steps++;
  }
  hud.render();
  render();
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Boot: menu, or a staged screenshot pose.
const shot = applyShot(state, state.actors);
if (shot) {
  hud.hideMenu();
  if (state.phase === PHASE.BUY) hud.setPhase(PHASE.BUY);
  else hud.hideBuy();
} else {
  setupRound(state, true);
  hud.showMenu();
}
requestAnimationFrame(loop);
