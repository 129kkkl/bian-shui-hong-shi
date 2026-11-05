import * as THREE from 'three';
import { cubeGeometry } from './geometry.js';
import { foliage, lanterns, smokeSources } from './architecture.js';

export const ATMOSPHERES = {
  morning: { label: '晨曦', state: '晨曦 · 河市初醒' },
  day: { label: '晴昼', state: '晴昼 · 市井正忙' },
  dusk: { label: '灯夕', state: '灯夕 · 檐下初灯' }
};
const palettes = {
  morning: { sky: '#e8e2d2', paper: '#f2eddf', ink: '#354944', soft: '#707b6e', hemiSky: '#e4edf0', hemiGround: '#8f9987', hemi: 1.95, sun: '#ffdba6', power: 2.85, position: [-40, 30, 24], exposure: 1.11, water: '#83aaa2', smoke: '#d8d1c1', smokeOpacity: .18, glow: .1 },
  day: { sky: '#e7e4d6', paper: '#f0eee3', ink: '#334641', soft: '#6c7a6d', hemiSky: '#fbf5e2', hemiGround: '#8c977e', hemi: 2.05, sun: '#fff1cc', power: 3.15, position: [-26, 54, 35], exposure: 1.13, water: '#81aea4', smoke: '#d4cbb8', smokeOpacity: .17, glow: 0 },
  dusk: { sky: '#d5c5b7', paper: '#e8dccb', ink: '#3c4640', soft: '#746f65', hemiSky: '#c3ced2', hemiGround: '#7f817b', hemi: 1.85, sun: '#ffc08b', power: 2.2, position: [-38, 23, -18], exposure: 1.06, water: '#789b99', smoke: '#c7bdaf', smokeOpacity: .13, glow: 1 }
};
const colorKeys = ['sky', 'paper', 'ink', 'soft', 'hemiSky', 'hemiGround', 'sun', 'water', 'smoke'];
const numberKeys = ['hemi', 'power', 'exposure', 'smokeOpacity', 'glow'];
for (const palette of Object.values(palettes)) {
  for (const key of colorKeys) palette[key] = new THREE.Color(palette[key]);
  palette.position = new THREE.Vector3(...palette.position);
}
function snapshot(palette) {
  const result = { position: palette.position.clone() };
  for (const key of colorKeys) result[key] = palette[key].clone();
  for (const key of numberKeys) result[key] = palette[key];
  return result;
}
function mixPalette(a, b, t, target) {
  for (const key of colorKeys) target[key].lerpColors(a[key], b[key], t);
  for (const key of numberKeys) target[key] = THREE.MathUtils.lerp(a[key], b[key], t);
  target.position.lerpVectors(a.position, b.position, t);
  return target;
}

export function createEnvironment({ scene, renderer, hemisphere, sun, floor }) {
  const waterUniforms = { uRiverTime: { value: 0 }, uRiverDetail: { value: 1 } };
  const windUniforms = { uWindTime: { value: 0 }, uWindStrength: { value: 1 } };
  let waterShaderReady = false, windShaderReady = false;
  const waterMaterial = new THREE.MeshStandardMaterial({ color: palettes.day.water, roughness: .46, metalness: .06 });
  waterMaterial.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, waterUniforms);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vRiverPosition;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRiverPosition = (modelMatrix * vec4(position, 1.0)).xz;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vRiverPosition;\nuniform float uRiverTime;\nuniform float uRiverDetail;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        float riverA = sin(vRiverPosition.x * 1.7 + vRiverPosition.y * .65 + uRiverTime * .42);
        float riverB = sin(vRiverPosition.y * 3.1 - vRiverPosition.x * .28 - uRiverTime * .6);
        float riverLine = smoothstep(.92, 1.0, sin(vRiverPosition.y * 4.5 + riverA * .55 - uRiverTime * .3));
        diffuseColor.rgb *= 1.0 + (riverA * riverB * .026 + riverLine * .035) * uRiverDetail;
      `);
    waterShaderReady = true;
  };
  waterMaterial.customProgramCacheKey = () => 'hongshi-river-v1';

  function windShader(shader) {
    Object.assign(shader.uniforms, windUniforms);
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform float uWindTime;\nuniform float uWindStrength;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          float windPhase = instanceMatrix[3][0] * .37 + instanceMatrix[3][2] * .29;
          float windTip = clamp(position.y + .5, 0.0, 1.0);
          transformed.x += sin(uWindTime * .75 + windPhase) * .075 * uWindStrength * windTip;
          transformed.z += cos(uWindTime * .58 + windPhase) * .038 * uWindStrength * windTip;
        #endif
      `);
    windShaderReady = true;
  }
  const leafMaterial = new THREE.MeshStandardMaterial({ roughness: .96, flatShading: true });
  leafMaterial.onBeforeCompile = windShader;
  leafMaterial.customProgramCacheKey = () => 'hongshi-leaves-v1';
  const leafMesh = foliage.finish(scene, '柳枝与树冠 · 风动合批', { material: leafMaterial });
  const leafDepth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  leafDepth.onBeforeCompile = windShader;
  leafDepth.customProgramCacheKey = () => 'hongshi-leaf-depth-v1';
  leafMesh.customDepthMaterial = leafDepth;

  const glowGeometry = new THREE.BufferGeometry();
  glowGeometry.setAttribute('position', new THREE.Float32BufferAttribute(lanterns.flatMap(p => [p.x, p.y, p.z]), 3));
  glowGeometry.setAttribute('aSize', new THREE.Float32BufferAttribute(lanterns.map(p => p.size || 1), 1));
  const glowMaterial = new THREE.ShaderMaterial({
    uniforms: { uZoom: { value: 1 }, uPixelRatio: { value: 1 }, uOpacity: { value: 0 }, uTint: { value: new THREE.Color('#ffd58b') } },
    vertexShader: `attribute float aSize;
      uniform float uZoom;
      uniform float uPixelRatio;
      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        gl_PointSize = clamp(aSize * 14.0 * uZoom * uPixelRatio, 4.0, 56.0 * uPixelRatio);
      }`,
    fragmentShader: `uniform vec3 uTint;
      uniform float uOpacity;
      void main() {
        float radius = length(gl_PointCoord - vec2(.5)) * 2.0;
        if (radius > 1.0) discard;
        float halo = pow(max(0.0, 1.0 - radius), 2.4);
        float core = smoothstep(.24, 0.0, radius);
        gl_FragColor = vec4(uTint, (halo * .45 + core * .4) * uOpacity);
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false
  });
  const glowPoints = new THREE.Points(glowGeometry, glowMaterial);
  glowPoints.name = '檐下灯晕'; glowPoints.renderOrder = 2; scene.add(glowPoints);

  const smokeCount = smokeSources.length * 8;
  const smokeMaterial = new THREE.MeshBasicMaterial({ color: palettes.day.smoke, transparent: true, opacity: .17, depthWrite: false });
  const smoke = new THREE.InstancedMesh(cubeGeometry, smokeMaterial, smokeCount);
  smoke.name = '茶坊炊烟'; smoke.instanceMatrix.setUsage(THREE.DynamicDrawUsage); smoke.frustumCulled = false;
  scene.add(smoke);
  const dummy = new THREE.Object3D();
  let lastSmokeTime = null;
  function updateSmoke(time) {
    if (time === lastSmokeTime) return;
    lastSmokeTime = time;
    smokeSources.forEach((source, column) => {
      for (let i = 0; i < 8; i++) {
        const age = ((time * .15 + i / 8 + column * .21) % 1 + 1) % 1;
        const size = (.13 + age * .3) * (1 - age * .55);
        dummy.position.set(source.x + age * .65 + Math.sin(age * 4 + i) * .08, source.y + .1 + age * 2.9, source.z + Math.cos(age * 3 + i) * age * .16);
        dummy.rotation.set(age * .3, time * .1 + i, age * .15);
        dummy.scale.set(size, size * .8, size); dummy.updateMatrix(); smoke.setMatrixAt(column * 8 + i, dummy.matrix);
      }
    });
    smoke.instanceMatrix.needsUpdate = true;
  }

  const current = snapshot(palettes.day), mixed = snapshot(palettes.day);
  let from = snapshot(palettes.day), to = palettes.day, blend = 1, mode = 'day', quality = 'high';
  function applyPalette(palette) {
    scene.background.copy(palette.sky); scene.fog.color.copy(palette.sky); floor.material.color.copy(palette.sky);
    hemisphere.color.copy(palette.hemiSky); hemisphere.groundColor.copy(palette.hemiGround); hemisphere.intensity = palette.hemi;
    sun.color.copy(palette.sun); sun.intensity = palette.power; sun.position.copy(palette.position);
    renderer.toneMappingExposure = palette.exposure; waterMaterial.color.copy(palette.water);
    smokeMaterial.color.copy(palette.smoke); smokeMaterial.opacity = palette.smokeOpacity;
    glowMaterial.uniforms.uOpacity.value = palette.glow; glowPoints.visible = palette.glow > .005;
    const root = document.documentElement.style;
    root.setProperty('--paper', palette.paper.getStyle()); root.setProperty('--ink', palette.ink.getStyle());
    root.setProperty('--soft', palette.soft.getStyle()); root.setProperty('--sky', palette.sky.getStyle());
  }
  applyPalette(current);
  updateSmoke(0);
  return {
    waterMaterial,
    setAtmosphere(name, instant = false) {
      if (!ATMOSPHERES[name]) throw new Error(`未知环境：${name}`);
      from = snapshot(current); to = palettes[name]; blend = instant ? 1 : 0; mode = name;
      if (instant) { mixPalette(from, to, 1, current); applyPalette(current); }
      document.body.dataset.atmosphere = mode;
    },
    setQuality(value) { quality = value; waterUniforms.uRiverDetail.value = value === 'high' ? 1 : value === 'balanced' ? .72 : .38; },
    update(time, delta, camera, reducedMotion = false) {
      const transitioning = blend < 1;
      if (transitioning) {
        blend = reducedMotion ? 1 : Math.min(1, blend + delta / 1.15);
        mixPalette(from, to, blend, current); applyPalette(current);
      }
      waterUniforms.uRiverTime.value = time; windUniforms.uWindTime.value = time;
      windUniforms.uWindStrength.value = reducedMotion ? 0 : quality === 'low' ? .35 : 1;
      smoke.visible = quality !== 'low'; if (smoke.visible) updateSmoke(time);
      glowMaterial.uniforms.uZoom.value = camera.zoom; glowMaterial.uniforms.uPixelRatio.value = renderer.getPixelRatio();
      return transitioning;
    },
    getDiagnostics() {
      return { mode, transitioning: blend < 1, quality, lanterns: lanterns.length, smokeSources: smokeSources.length, smokeVisible: smoke.visible, smokeTime: lastSmokeTime, foliageVoxels: foliage.items.length, waterShaderReady, windShaderReady, waterTime: waterUniforms.uRiverTime.value, windTime: windUniforms.uWindTime.value, glowStrength: glowMaterial.uniforms.uOpacity.value, sunPosition: sun.position.toArray(), sunColor: `#${sun.color.getHexString()}`, exposure: renderer.toneMappingExposure };
    }
  };
}
