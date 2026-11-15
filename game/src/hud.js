// HUD: all DOM updates in one place. The sim writes state; this module
// renders it. Buy menu items are built once per buy phase.
import { WEAPONS, ECONOMY, PHASE } from './state.js';

const $ = (id) => document.getElementById(id);

export function createHud(state, callbacks) {
  const els = {
    hud: $('hud'), health: $('health-num'), armor: $('armor-num'),
    ammo: $('ammo-num'), reserve: $('ammo-reserve'), wname: $('weapon-name'),
    money: $('money'), timer: $('timer'), score: $('score'), alive: $('alive'),
    objective: $('objective'), killfeed: $('killfeed'), banner: $('banner'),
    prompt: $('prompt'), progress: $('progress'), progressBar: document.querySelector('#progress > div'),
    crosshair: $('crosshair'), hitmarker: $('hitmarker'), vignette: $('vignette'),
    menu: $('menu'), buy: $('buy'), buyBal: $('buy-bal'), shop: $('shop'),
    end: $('end'), endTitle: $('end-title'), endSub: $('end-sub'), endStats: $('end-stats'),
  };
  let hitT = 0;
  let lastFeedLen = -1;

  const shopDefs = [
    { id: 'rifle', ds: '32 dmg · 25-round mag · 600 RPM. The workhorse.' },
    { id: 'smg', ds: '22 dmg · 30-round mag · 780 RPM. Fast up close.' },
    { id: 'sniper', ds: '85 dmg · 5-round mag · one-shot headshot. Slow and loud.' },
    { id: 'grenade', ds: 'Frag grenade. 100 damage in a 5 m blast. Max 2.' },
    { id: 'armor', ds: 'Full armor. Absorbs half of all damage taken.' },
  ];

  function buildShop() {
    const p = state.actors[state.playerId];
    els.shop.innerHTML = '';
    for (const s of shopDefs) {
      const isArmor = s.id === 'armor';
      const def = isArmor ? { name: 'KEVLAR ARMOR' } : WEAPONS[s.id];
      const price = isArmor ? ECONOMY.armor : def.price;
      const owned = (s.id !== 'grenade' && s.id !== 'armor' && p.weapon.defId === s.id)
        || (s.id === 'armor' && p.armor >= 100)
        || (s.id === 'grenade' && p.weapon.grenades >= 2);
      const div = document.createElement('div');
      div.className = 'item' + (owned ? ' owned' : '');
      div.innerHTML = `<div class="nm">${def.name}</div><div class="ds">${s.ds}</div><div class="pr">${owned ? 'OWNED' : '$' + price}</div>`;
      div.onclick = () => { if (callbacks.buy(s.id)) buildShop(); render(); };
      els.shop.appendChild(div);
    }
    els.buyBal.textContent = 'Credits: $' + state.money;
  }

  function fmtTime(sec) {
    const s = Math.max(0, Math.ceil(sec));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  function render() {
    const p = state.actors[state.playerId];
    const w = p.weapon;
    const def = WEAPONS[w.defId];
    els.health.textContent = Math.max(0, Math.ceil(p.hp));
    els.armor.textContent = p.armor > 0 ? 'ARMOR ' + Math.ceil(p.armor) : '';
    els.ammo.textContent = w.mag;
    els.reserve.textContent = '/ ' + w.reserve;
    els.wname.textContent = def.name + (w.grenades > 0 ? '  ·  G×' + w.grenades : '');
    els.money.textContent = '$' + state.money;
    els.timer.textContent = state.phase === 'planted' ? '💥 ' + fmtTime(state.plantTime) : fmtTime(state.roundTime);
    els.score.innerHTML = `<span class="v">${state.score.vanguard}</span> — <span class="e">${state.score.ember}</span>`;
    const vAlive = state.actors.filter((a) => a.team === 'vanguard' && a.alive).length;
    const eAlive = state.actors.filter((a) => a.team === 'ember' && a.alive).length;
    els.alive.textContent = `VANGUARD ${vAlive} · EMBER ${eAlive}`;
    els.objective.style.display = (state.phase === PHASE.ROUND_END || state.phase === PHASE.MATCH_END) ? 'none' : 'block';
    els.objective.textContent = state.spike.state === 'planted'
      ? 'SPIKE PLANTED — defend Site R until detonation'
      : state.spike.carrier === p ? 'You carry the SPIKE — plant it at Site R (hold E)' : 'Plant the SPIKE at Site R — or eliminate the Ember team';
    if (state.feed.length !== lastFeedLen) {
      lastFeedLen = state.feed.length;
      els.killfeed.innerHTML = state.feed.slice(0, 5).map((f) => `<div class="${f.cls === 'vanguard' ? 'v' : 'e'}">${f.text}</div>`).join('');
    }
    // Crosshair gap follows spread: bloom + movement.
    const gap = 6 + w.bloom * 14 + (p.speed > 0.6 ? 7 : 0);
    const arms = [['ch-t', 0, -gap - 8, 2, 8], ['ch-b', 0, gap, 2, 8], ['ch-l', -gap - 8, 0, 8, 2], ['ch-r', gap, 0, 8, 2]];
    for (const [id, x, y, ww, hh] of arms) {
      const el = document.getElementById(id);
      el.style.left = x + 'px'; el.style.top = y + 'px';
      el.style.width = ww + 'px'; el.style.height = hh + 'px';
    }
    // Banner.
    if (state.banner.until > state.time && state.banner.text) {
      els.banner.style.display = 'block';
      els.banner.innerHTML = state.banner.text + (state.banner.sub ? `<small>${state.banner.sub}</small>` : '');
    } else els.banner.style.display = 'none';
    // Plant / defuse progress.
    const s = state.spike;
    if (s.state === 'carried' && s.progress > 0 && s.carrier === p) {
      els.progress.style.display = 'block';
      els.progressBar.style.width = (s.progress / 3 * 100) + '%';
      els.prompt.style.display = 'block';
      els.prompt.textContent = 'PLANTING SPIKE…';
    } else if (s.state === 'planted' && s.progress > 0) {
      els.progress.style.display = 'block';
      els.progressBar.style.width = (s.progress / 5 * 100) + '%';
      els.prompt.style.display = 'block';
      els.prompt.textContent = 'SPIKE BEING DEFUSED!';
    } else {
      els.progress.style.display = 'none';
      const nearSite = Math.hypot(p.pos.x - state.site.x, p.pos.z - state.site.z) < state.site.r;
      if (state.phase === 'live' && s.state === 'carried' && s.carrier === p && nearSite) {
        els.prompt.style.display = 'block';
        els.prompt.textContent = 'Hold E to plant the SPIKE';
      } else els.prompt.style.display = 'none';
    }
    // Damage vignette fades with health.
    const hurt = p.hp < 100 ? (100 - p.hp) / 100 : 0;
    els.vignette.style.boxShadow = `inset 0 0 120px 40px rgba(255,30,10,${(hurt * 0.55).toFixed(2)})`;
  }

  return {
    render,
    showHit(head) {
      els.hitmarker.style.opacity = '1';
      els.hitmarker.classList.toggle('headshot', !!head);
      hitT = 0.12;
    },
    tick(dt) {
      if (hitT > 0) { hitT -= dt; if (hitT <= 0) els.hitmarker.style.opacity = '0'; }
    },
    showMenu() { els.menu.style.display = 'flex'; els.hud.style.display = 'none'; },
    hideMenu() { els.menu.style.display = 'none'; els.hud.style.display = 'block'; },
    showBuy() { buildShop(); els.buy.style.display = 'block'; render(); },
    hideBuy() { els.buy.style.display = 'none'; },
    showEnd(won) {
      els.end.style.display = 'flex';
      els.endTitle.textContent = won ? 'SECTOR SECURED' : 'SECTOR LOST';
      els.endSub.textContent = `Final score — Vanguard ${state.score.vanguard} · Ember ${state.score.ember}`;
      els.endStats.textContent = `Your line: ${state.kills} eliminations · ${state.deaths} deaths · ${state.plants} spike plants`;
    },
    hideEnd() { els.end.style.display = 'none'; },
    setPhase(phase) {
      if (phase === PHASE.BUY) this.showBuy();
      else this.hideBuy();
    },
  };
}
