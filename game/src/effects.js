// Effects: pooled tracers, muzzle flash, impact sparks, explosions and
// ambient dust. Pools are fixed at build time — the hot loop allocates nothing.
import * as THREE from 'three';

const TRACER_N = 24;
const SPARK_N = 120;

export function createEffects(scene) {
  const tracers = [];
  for (let i = 0; i < TRACER_N; i++) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0 }));
    line.frustumCulled = false;
    scene.add(line);
    tracers.push({ line, life: 0 });
  }
  let tracerIdx = 0;

  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SPARK_N * 3), 3));
  const sparkMat = new THREE.PointsMaterial({ color: 0xffd76a, size: 0.09, transparent: true, opacity: 0 });
  const sparks = new THREE.Points(sparkGeo, sparkMat);
  sparks.frustumCulled = false;
  scene.add(sparks);
  const sparkVel = new Float32Array(SPARK_N * 3);
  const sparkLife = new Float32Array(SPARK_N);
  let sparkIdx = 0;

  const flash = new THREE.PointLight(0xffc46a, 0, 9, 1.8);
  scene.add(flash);
  let flashLife = 0;

  const boomLight = new THREE.PointLight(0xff7a3c, 0, 26, 1.5);
  scene.add(boomLight);
  let boomLife = 0;

  const boomMesh = new THREE.Mesh(
    new THREE.SphereGeometry(1, 14, 10),
    new THREE.MeshBasicMaterial({ color: 0xff8a3c, transparent: true, opacity: 0 })
  );
  scene.add(boomMesh);

  // Ambient dust motes drifting over the yard.
  const dustGeo = new THREE.BufferGeometry();
  const dustN = 160;
  const dustPos = new Float32Array(dustN * 3);
  for (let i = 0; i < dustN; i++) {
    dustPos[i * 3] = (Math.random() * 2 - 1) * 30;
    dustPos[i * 3 + 1] = Math.random() * 6 + 0.3;
    dustPos[i * 3 + 2] = (Math.random() * 2 - 1) * 20;
  }
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xe8d9b0, size: 0.07, transparent: true, opacity: 0.5 }));
  dust.frustumCulled = false;
  scene.add(dust);

  return {
    tracer(from, to, color) {
      const t = tracers[tracerIdx];
      tracerIdx = (tracerIdx + 1) % TRACER_N;
      const p = t.line.geometry.attributes.position.array;
      p[0] = from.x; p[1] = from.y; p[2] = from.z;
      p[3] = to.x; p[4] = to.y; p[5] = to.z;
      t.line.geometry.attributes.position.needsUpdate = true;
      t.line.material.color.setHex(color);
      t.line.material.opacity = 0.9;
      t.life = 0.07;
    },
    muzzle(origin, dir) {
      flash.position.copy(origin).addScaledVector(dir, 0.6);
      flash.intensity = 14;
      flashLife = 0.05;
    },
    impact(point, head) {
      for (let n = 0; n < 8; n++) {
        const i = sparkIdx;
        sparkIdx = (sparkIdx + 1) % SPARK_N;
        const p = sparkGeo.attributes.position.array;
        p[i * 3] = point.x; p[i * 3 + 1] = point.y; p[i * 3 + 2] = point.z;
        sparkVel[i * 3] = (Math.random() - 0.5) * 4;
        sparkVel[i * 3 + 1] = Math.random() * 3;
        sparkVel[i * 3 + 2] = (Math.random() - 0.5) * 4;
        sparkLife[i] = 0.35;
      }
      sparkMat.color.setHex(head ? 0xff5a3c : 0xffd76a);
      sparkMat.opacity = 1;
      sparkGeo.attributes.position.needsUpdate = true;
    },
    explosion(pos) {
      boomLight.position.copy(pos).add(new THREE.Vector3(0, 1, 0));
      boomLight.intensity = 40;
      boomLife = 0.5;
      boomMesh.position.copy(pos);
      boomMesh.scale.setScalar(0.5);
      boomMesh.material.opacity = 0.75;
      for (let n = 0; n < 40; n++) {
        const i = sparkIdx;
        sparkIdx = (sparkIdx + 1) % SPARK_N;
        const p = sparkGeo.attributes.position.array;
        p[i * 3] = pos.x; p[i * 3 + 1] = pos.y + 0.4; p[i * 3 + 2] = pos.z;
        const a = Math.random() * Math.PI * 2, s = 3 + Math.random() * 6;
        sparkVel[i * 3] = Math.cos(a) * s;
        sparkVel[i * 3 + 1] = Math.random() * 6;
        sparkVel[i * 3 + 2] = Math.sin(a) * s;
        sparkLife[i] = 0.8;
      }
      sparkMat.color.setHex(0xff8a3c);
      sparkMat.opacity = 1;
    },
    update(dt, time) {
      for (const t of tracers) {
        if (t.life > 0) {
          t.life -= dt;
          t.line.material.opacity = Math.max(0, t.life / 0.07) * 0.9;
        }
      }
      let anySpark = false;
      const p = sparkGeo.attributes.position.array;
      for (let i = 0; i < SPARK_N; i++) {
        if (sparkLife[i] > 0) {
          sparkLife[i] -= dt;
          p[i * 3] += sparkVel[i * 3] * dt;
          p[i * 3 + 1] += sparkVel[i * 3 + 1] * dt;
          p[i * 3 + 2] += sparkVel[i * 3 + 2] * dt;
          sparkVel[i * 3 + 1] -= 9 * dt;
          anySpark = true;
        }
      }
      sparkGeo.attributes.position.needsUpdate = true;
      sparkMat.opacity = anySpark ? 1 : 0;
      if (flashLife > 0) { flashLife -= dt; if (flashLife <= 0) flash.intensity = 0; }
      if (boomLife > 0) {
        boomLife -= dt;
        boomLight.intensity = Math.max(0, boomLife * 80);
        boomMesh.scale.addScalar(dt * 22);
        boomMesh.material.opacity = Math.max(0, boomLife * 1.5);
      }
      dust.position.y = Math.sin(time * 0.12) * 0.4;
    },
  };
}
