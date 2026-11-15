// Weapons: firing, recoil, spread, reload, grenades. Hitscan shots test the
// ray against wall meshes first, then against actor hit spheres (head + body).
// A shot that stops at a wall never reaches an actor behind it.
import * as THREE from 'three';
import { WEAPONS } from './state.js';

const _ray = new THREE.Raycaster();
const _dir = new THREE.Vector3();
const _to = new THREE.Vector3();

function raySphere(origin, dir, center, radius) {
  _to.copy(center).sub(origin);
  const tca = _to.dot(dir);
  if (tca < 0) return -1;
  const d2 = _to.lengthSq() - tca * tca;
  const r2 = radius * radius;
  if (d2 > r2) return -1;
  return tca - Math.sqrt(r2 - d2);
}

export function makeLoadout(defId) {
  const def = WEAPONS[defId];
  return { defId, mag: def.mag, reserve: def.reserve, lastShot: -9, reloading: false, reloadEnd: 0, bloom: 0, grenades: 0 };
}

export function fireWeapon(state, world, shooter, origin, baseDir, effects, audio, now) {
  const w = shooter.weapon;
  const def = WEAPONS[w.defId];
  if (w.reloading || now - w.lastShot < 60 / def.rpm) return false;
  if (w.mag <= 0) { audio.dry(); w.lastShot = now; return false; }
  w.lastShot = now;
  w.mag -= 1;
  w.bloom = Math.min(1, w.bloom + (def.id === 'sniper' ? 0.9 : 0.22));

  // Spread grows with movement and bloom, shrinks when crouched and still.
  const moving = shooter.speed > 0.6 ? 1 : 0;
  const spread = def.spread + w.bloom * 0.02 + moving * def.moveSpread + (shooter.crouched ? -0.004 : 0);
  _dir.copy(baseDir);
  _dir.x += (Math.random() * 2 - 1) * spread;
  _dir.y += (Math.random() * 2 - 1) * spread;
  _dir.z += (Math.random() * 2 - 1) * spread;
  _dir.normalize();

  _ray.set(origin, _dir);
  _ray.far = def.range;
  const wallHits = _ray.intersectObjects(world.solids, false);
  const wallDist = wallHits.length ? wallHits[0].distance : def.range;

  let best = null, bestDist = wallDist, bestHead = false;
  for (const a of state.actors) {
    if (a === shooter || !a.alive) continue;
    const head = raySphere(origin, _dir, a.headPos, 0.3);
    const body = raySphere(origin, _dir, a.bodyPos, 0.52);
    let d = -1, headHit = false;
    if (head >= 0 && (body < 0 || head < body)) { d = head; headHit = true; }
    else if (body >= 0) { d = body; }
    if (d >= 0 && d < bestDist) { best = a; bestDist = d; bestHead = headHit; }
  }
  const end = origin.clone().addScaledVector(_dir, bestDist);
  effects.tracer(origin, end, def.tracer);
  effects.muzzle(origin, _dir);
  audio.shot(def.id);

  if (best) {
    let dmg = def.damage * (bestHead ? def.headMult : 1);
    if (best.armor > 0) {
      const absorbed = Math.min(best.armor, dmg * 0.5);
      best.armor -= absorbed;
      dmg -= absorbed;
    }
    best.hp -= dmg;
    effects.impact(end, bestHead);
    if (shooter.isPlayer) audio.hit(bestHead);
    if (best.hp <= 0) {
      best.hp = 0;
      best.alive = false;
      return { hit: best, head: bestHead, killed: true, damage: dmg };
    }
    return { hit: best, head: bestHead, killed: false, damage: dmg };
  }
  if (wallDist < def.range) effects.impact(end, false);
  return { hit: null, head: false, killed: false, damage: 0 };
}

export function startReload(w, now) {
  const def = WEAPONS[w.defId];
  if (w.reloading || w.reserve <= 0 || w.mag >= def.mag || def.reload <= 0) return;
  w.reloading = true;
  w.reloadEnd = now + def.reload;
}

export function updateReload(w, now, audio) {
  if (!w.reloading) return;
  if (now >= w.reloadEnd) {
    const def = WEAPONS[w.defId];
    const need = def.mag - w.mag;
    const take = Math.min(need, w.reserve);
    w.mag += take;
    w.reserve -= take;
    w.reloading = false;
  }
}

export function throwGrenade(state, world, shooter, origin, dir, now) {
  const w = shooter.weapon;
  if (w.grenades <= 0) return false;
  w.grenades -= 1;
  const g = {
    pos: origin.clone(),
    vel: dir.clone().multiplyScalar(17).add(new THREE.Vector3(0, 4.5, 0)),
    fuse: 3.0, owner: shooter, mesh: null,
  };
  state.grenades.push(g);
  return true;
}

export function updateGrenades(state, world, dt, effects, audio, onDamage) {
  for (let i = state.grenades.length - 1; i >= 0; i--) {
    const g = state.grenades[i];
    g.fuse -= dt;
    g.vel.y -= 18 * dt;
    g.pos.addScaledVector(g.vel, dt);
    // Bounce off the ground and the outer bounds; crates are ignored for simplicity.
    if (g.pos.y < 0.15) { g.pos.y = 0.15; g.vel.y = Math.abs(g.vel.y) * 0.45; g.vel.x *= 0.7; g.vel.z *= 0.7; }
    if (g.pos.x < -31.5 || g.pos.x > 31.5) g.vel.x *= -0.5;
    if (g.pos.z < -21.5 || g.pos.z > 21.5) g.vel.z *= -0.5;
    if (g.mesh) g.mesh.position.copy(g.pos);
    if (g.fuse <= 0) {
      effects.explosion(g.pos);
      audio.boom();
      for (const a of state.actors) {
        if (!a.alive) continue;
        const d = a.pos.distanceTo(g.pos);
        if (d < 5.5) {
          const dmg = Math.round(100 * (1 - d / 5.5) + 20);
          a.hp -= dmg;
          if (a.hp <= 0) { a.hp = 0; a.alive = false; onDamage(a, g.owner, false, true); }
        }
      }
      state.grenades.splice(i, 1);
    }
  }
}
