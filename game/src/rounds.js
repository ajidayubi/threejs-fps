// Rounds: buy phase, live round, plant/defuse, win conditions, economy and
// the match end. The spike starts on the player; if the player dies a living
// Vanguard bot picks it up and carries it to Site R.
import { PHASE, ECONOMY, WEAPONS } from './state.js';
import { makeLoadout } from './weapons.js';

export function setupRound(state, first) {
  const spawnsV = [[-4, 18], [0, 18], [4, 18], [-9, 16], [9, 16]];
  const spawnsE = [[-4, -18], [0, -18], [4, -18], [-12, -17], [12, -17]];
  let vi = 0, ei = 0;
  for (const a of state.actors) {
    a.hp = 100;
    a.alive = true;
    a.armor = a.armorKept ? 100 : 0;
    if (a.team === 'vanguard') {
      const s = spawnsV[vi++ % spawnsV.length];
      a.pos.set(s[0], 0, s[1]);
      a.yaw = 0; // face south (-Z), toward Site R
    } else {
      const s = spawnsE[ei++ % spawnsE.length];
      a.pos.set(s[0], 0, s[1]);
      a.yaw = Math.PI; // face north (+Z), toward the Vanguard push
    }
    a.vel.set(0, 0, 0);
    a.speed = 0;
    if (a.mesh) { a.mesh.rotation.z = 0; a.mesh.position.y = 0; }
    if (a.ai) { a.ai.route = []; a.ai.state = 'advance'; a.ai.target = null; a.ai.holdUntil = 0; }
    if (a.isPlayer) {
      a.eyeY = 1.62;
      a.pitch = 0;
    }
  }
  state.roundTime = 100;
  state.plantTime = 35;
  state.spike = { state: 'carried', x: 0, z: 0, progress: 0, carrier: state.actors[state.playerId] };
  state.grenades.length = 0;
  state.phase = PHASE.BUY;
}

export function startLive(state) {
  state.phase = PHASE.LIVE;
  state.time = state.time; // sim clock keeps running
}

export function buyItem(state, id, audio) {
  const def = WEAPONS[id];
  const p = state.actors[state.playerId];
  if (!def) return false;
  if (id === 'grenade') {
    if (state.money < def.price || p.weapon.grenades >= 2) return false;
    state.money -= def.price;
    p.weapon.grenades += 1;
    audio.click();
    return true;
  }
  if (id === 'armor') {
    if (state.money < ECONOMY.armor || p.armor >= 100) return false;
    state.money -= ECONOMY.armor;
    p.armor = 100;
    p.armorKept = true;
    audio.click();
    return true;
  }
  if (state.money < def.price) return false;
  if (p.weapon.defId === id) return false;
  state.money -= def.price;
  const g = p.weapon.grenades;
  p.weapon = makeLoadout(id);
  p.weapon.grenades = g;
  audio.click();
  return true;
}

export function onKill(state, killer, victim, head, audio) {
  state.feed.unshift({ text: `${killer.team === 'vanguard' ? 'VANGUARD' : 'EMBER'} ${killer.isPlayer ? 'YOU' : 'BOT-' + killer.id}  →  ${victim.team === 'vanguard' ? 'VANGUARD' : 'EMBER'} ${victim.isPlayer ? 'YOU' : 'BOT-' + victim.id}${head ? '  [HEADSHOT]' : ''}`, cls: killer.team, t: state.time });
  if (state.feed.length > 5) state.feed.pop();
  if (killer.isPlayer) {
    state.kills += 1;
    state.money += ECONOMY.kill;
  }
  if (victim.isPlayer) state.deaths += 1;
  if (state.spike.carrier === victim) {
    // Hand the spike to the nearest living Vanguard bot.
    let next = null, bd = Infinity;
    for (const a of state.actors) {
      if (a.team === 'vanguard' && a.alive && a !== victim) {
        const d = a.pos.distanceTo(victim.pos);
        if (d < bd) { bd = d; next = a; }
      }
    }
    state.spike.carrier = next;
    if (!next) state.spike.state = 'dropped';
  }
}

export function aliveCount(state, team) {
  let n = 0;
  for (const a of state.actors) if (a.team === team && a.alive) n++;
  return n;
}

export function checkRoundEnd(state, audio) {
  const v = aliveCount(state, 'vanguard');
  const e = aliveCount(state, 'ember');
  if (state.spike.state === 'planted') {
    if (e === 0) return endRound(state, 'vanguard', 'SITE HELD — SPIKE DETONATED', audio);
    return null;
  }
  if (v === 0) return endRound(state, 'ember', 'VANGUARD ELIMINATED', audio);
  if (e === 0) return endRound(state, 'vanguard', 'EMBER ELIMINATED', audio);
  return null;
}

export function endRound(state, winner, reason, audio) {
  state.phase = PHASE.ROUND_END;
  state.score[winner] += 1;
  state.winner = winner;
  const p = state.actors[state.playerId];
  const won = winner === 'vanguard';
  state.money += won ? ECONOMY.win : ECONOMY.loss;
  state.banner = { text: won ? 'ROUND WON' : 'ROUND LOST', sub: reason, until: state.time + 4 };
  if (won) audio.win(); else audio.lose();
  // Keep armor into the next round only when the player bought it.
  p.armorKept = p.armor > 0;
  return winner;
}

export function plantTick(state, dt, audio) {
  const s = state.spike;
  if (s.state !== 'planted') return;
  state.plantTime -= dt;
  if (state.plantTime <= 0) {
    s.state = 'detonated';
    endRound(state, 'vanguard', 'SPIKE DETONATED — SITE R DESTROYED', audio);
  }
}

// The carrier (player or a bot) channels the plant inside the site radius.
export function updatePlant(state, dt, audio) {
  const s = state.spike;
  if (state.phase !== 'live' || s.state !== 'carried' || !s.carrier || !s.carrier.alive) return;
  const c = s.carrier;
  const dx = c.pos.x - state.site.x, dz = c.pos.z - state.site.z;
  const inside = Math.hypot(dx, dz) < state.site.r;
  if (c.isPlayer) {
    // The player plants by holding E; bots plant automatically.
    if (inside && state.plantHeld) {
      s.progress += dt;
      if (s.progress >= 3) {
        s.state = 'planted';
        s.progress = 0;
        state.phase = 'planted';
        state.money += ECONOMY.plant;
        state.plants += 1;
        state.banner = { text: 'SPIKE PLANTED', sub: 'Defend it — 35 seconds to detonation', until: state.time + 3 };
        audio.plant();
      }
    } else s.progress = Math.max(0, s.progress - dt * 2);
  } else if (inside) {
    s.progress += dt;
    if (s.progress >= 3) {
      s.state = 'planted';
      s.progress = 0;
      state.phase = 'planted';
      state.banner = { text: 'SPIKE PLANTED', sub: 'A teammate planted the spike — defend Site R', until: state.time + 3 };
      audio.plant();
    }
  } else s.progress = 0;
}

// Defuse: an Ember bot inside the site channels for 5 seconds.
export function updateDefuse(state, dt, audio) {
  const s = state.spike;
  if (state.phase !== 'planted' || s.state !== 'planted') return;
  for (const a of state.actors) {
    if (a.team !== 'ember' || !a.alive) continue;
    const d = Math.hypot(a.pos.x - state.site.x, a.pos.z - state.site.z);
    if (d < 2.2) {
      s.progress += dt;
      if (s.progress >= 5) {
        s.state = 'defused';
        state.defuses += 1;
        endRound(state, 'ember', 'SPIKE DEFUSED', audio);
      }
      return;
    }
  }
  s.progress = Math.max(0, s.progress - dt);
}
