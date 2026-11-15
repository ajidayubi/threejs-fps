// Palette and shared materials for DUSTLINE — a sun-baked desert-industrial yard.
// One palette, chosen once, used by every module so the map reads at a glance.
import * as THREE from 'three';

export const PALETTE = {
  sky: 0x9fc3e0,
  fog: 0xc9b48a,
  sun: 0xffe3b3,
  ground: 0xb59a68,
  groundDark: 0x8f774e,
  wall: 0x9c8a6d,
  wallTop: 0x7d6c52,
  metal: 0x5d6b76,
  metalDark: 0x3a444d,
  crate: 0x7a5c38,
  crateAlt: 0x6b4f2e,
  reactor: 0x2e4a5e,
  reactorGlow: 0x39d0c4,
  vanguard: 0x3fa9f5,
  ember: 0xff5a3c,
  accent: 0xffd76a,
};

const cache = new Map();
export function mat(color, rough = 0.92, metal = 0.0) {
  const key = color + '|' + rough + '|' + metal;
  let m = cache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });
    cache.set(key, m);
  }
  return m;
}

export function lambert(color) {
  const key = 'L' + color;
  let m = cache.get(key);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color });
    cache.set(key, m);
  }
  return m;
}

export function emissive(color, intensity = 1.2) {
  const key = 'E' + color + '|' + intensity;
  let m = cache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: color, emissiveIntensity: intensity });
    cache.set(key, m);
  }
  return m;
}

// Canvas-generated textures keep the game free of external assets.
export function stripeTexture(base, line, size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, size, size);
  g.fillStyle = line;
  for (let i = -size; i < size * 2; i += 32) {
    g.beginPath();
    g.moveTo(i, 0);
    g.lineTo(i + 16, 0);
    g.lineTo(i + 16 - size, size);
    g.lineTo(i - size, size);
    g.closePath();
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export function hazardTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#d8b93a';
  g.fillRect(0, 0, 256, 64);
  g.fillStyle = '#151312';
  for (let i = -64; i < 320; i += 64) {
    g.beginPath();
    g.moveTo(i, 64);
    g.lineTo(i + 32, 0);
    g.lineTo(i + 64, 0);
    g.lineTo(i + 32, 64);
    g.closePath();
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  return t;
}
