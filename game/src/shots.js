// Screenshot poses: ?shot=start|play|site|end&seed=N stages a deterministic
// scene so the screenshots show the real game, not a staged mock.
import { PHASE } from './state.js';

export function parseShot() {
  const q = new URLSearchParams(location.search);
  return { shot: q.get('shot'), seed: parseInt(q.get('seed') || '1', 10) || 1 };
}

export function applyShot(state, actors) {
  const { shot } = parseShot();
  if (!shot) return null;
  state.shot = shot;
  const p = actors[state.playerId];
  const vanguards = actors.filter((a) => a.team === 'vanguard' && !a.isPlayer);
  const embers = actors.filter((a) => a.team === 'ember');
  const put = (a, x, z, yaw) => { a.pos.set(x, 0, z); a.yaw = yaw; a.alive = true; a.hp = 100; };
  if (shot === 'start') {
    state.phase = PHASE.BUY;
    put(p, -2, 17, 0);
    put(vanguards[0], -6, 16, 0);
    put(vanguards[1], 2, 16, 0);
    put(embers[0], 0, -10, Math.PI);
    embers.slice(1).forEach((e) => { e.alive = false; });
  } else if (shot === 'play') {
    state.phase = PHASE.LIVE;
    state.roundTime = 62;
    put(p, -3, 8, 0);
    put(embers[0], -2, -4, Math.PI);
    put(embers[1], 6, -2, Math.PI + 0.4);
    put(vanguards[0], -8, 10, 0);
    put(vanguards[1], 4, 12, 0);
    embers.slice(2).forEach((e) => { e.alive = false; });
    vanguards.slice(2).forEach((v) => { v.alive = false; });
  } else if (shot === 'site') {
    state.phase = PHASE.PLANTED;
    state.spike.state = 'planted';
    state.plantTime = 24;
    put(p, -4, -8, -0.59);
    put(embers[0], 1.5, -13, Math.PI);
    put(embers[1], 8, -10, Math.PI + 0.5);
    put(vanguards[0], -9, -12, -0.5);
    embers.slice(2).forEach((e) => { e.alive = false; });
    vanguards.slice(1).forEach((v) => { v.alive = false; });
  } else if (shot === 'end') {
    state.phase = PHASE.ROUND_END;
    state.roundEndAt = 1e9;
    state.score.vanguard = 4;
    state.score.ember = 2;
    state.banner = { text: 'ROUND WON', sub: 'EMBER ELIMINATED', until: 1e9 };
    put(p, -3, 8, 0);
    put(vanguards[0], -8, 10, 0);
    embers.forEach((e) => { e.alive = false; });
    vanguards.slice(1).forEach((v) => { v.alive = false; });
  }
  return shot;
}
