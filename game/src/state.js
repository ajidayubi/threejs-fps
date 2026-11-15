// Central state: one object, one owner. Every module reads and writes through
// this store; nothing keeps a private copy of round, economy or roster data.
export const PHASE = { MENU: 'menu', BUY: 'buy', LIVE: 'live', PLANTED: 'planted', ROUND_END: 'round_end', MATCH_END: 'match_end' };

export const WEAPONS = {
  pistol: { id: 'pistol', name: 'P9 SIDEARM', price: 0, damage: 26, headMult: 2, mag: 12, reserve: 48, auto: false, rpm: 320, reload: 1.1, spread: 0.011, moveSpread: 0.030, range: 60, kick: 0.011, zoom: 1, tracer: 0xffe9a8 },
  rifle: { id: 'rifle', name: 'VK-9 JACKAL', price: 2700, damage: 32, headMult: 2, mag: 25, reserve: 75, auto: true, rpm: 600, reload: 2.0, spread: 0.008, moveSpread: 0.026, range: 90, kick: 0.016, zoom: 1, tracer: 0xffe9a8 },
  smg: { id: 'smg', name: 'WASP-9', price: 1500, damage: 22, headMult: 2, mag: 30, reserve: 90, auto: true, rpm: 780, reload: 1.6, spread: 0.014, moveSpread: 0.034, range: 55, kick: 0.011, zoom: 1, tracer: 0x9fe8ff },
  sniper: { id: 'sniper', name: 'LONGSHOT .50', price: 4750, damage: 85, headMult: 2, mag: 5, reserve: 15, auto: false, rpm: 48, reload: 3.0, spread: 0.001, moveSpread: 0.06, range: 140, kick: 0.055, zoom: 2.2, tracer: 0xff9a7a },
  grenade: { id: 'grenade', name: 'FRAG GRENADE', price: 300, damage: 100, headMult: 1, mag: 1, reserve: 0, auto: false, rpm: 60, reload: 0, spread: 0, moveSpread: 0, range: 0, kick: 0, zoom: 1, tracer: 0xffffff },
};

export const ECONOMY = { start: 800, kill: 300, win: 3250, loss: 1900, plant: 300, armor: 650 };

export function createState() {
  return {
    phase: PHASE.MENU,
    time: 0,               // total sim time
    round: 1,
    roundsToWin: 5,
    roundTime: 100,        // seconds left in the round
    plantTime: 35,         // seconds left after the spike is planted
    score: { vanguard: 0, ember: 0 },
    money: ECONOMY.start,
    kills: 0, deaths: 0, plants: 0, defuses: 0,
    spike: { state: 'idle', x: 0, z: 0, progress: 0, carrier: null }, // idle|carried|planted|detonated
    site: { x: 0, z: -14, r: 4.5 },   // Site R, the reactor pad
    actors: [],            // player + bots, each an actor object
    playerId: 0,
    grenades: [],
    tracers: [],
    feed: [],              // killfeed lines {text, cls, t}
    banner: { text: '', sub: '', until: 0 },
    roundEndAt: 0,
    winner: null,
    seed: 1,
    shot: null,            // screenshot pose: start|play|site|end
    muted: false,
  };
}
