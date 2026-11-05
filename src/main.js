import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { world, fixtures, audit, finishSigns } from './geometry.js';
import { terrain, bridge, town, docks } from './architecture.js';
import { populate, finishPeople, updatePeople, peopleDiagnostics, actors } from './citizens.js';
import { setupRiver, updateRiver, boatDiagnostics, auditNavigation, fleet } from './boats.js';
import { createEnvironment, ATMOSPHERES } from './environment.js';

const $ = id => document.getElementById(id);
const views = {
  overview: { position: [56, 48, 64], target: [0, 1.5, 0], zoom: 1, title: '虹桥春渡', copy: '木拱凌波，市声连岸。', index: '壹' },
  bridge: { position: [26, 22, 34], target: [0, 4.4, 0], zoom: 2.05, title: '桥上小集', copy: '一担春蔬，一尺新布，一声招呼。', index: '贰' },
  market: { position: [42, 28, 30], target: [20, 3.3, 0], zoom: 2.5, title: '街巷人家', copy: '茶烟出檐，布幌迎风，店门向河开。', index: '叁' },
  river: { position: [25, 19, 39], target: [0, 2.4, 11], zoom: 2.25, title: '舟来舟往', copy: '降桅过桥，靠岸卸货，春水不歇。', index: '肆' },
  under: { position: [3.8, 6.8, 32], target: [0, 3.9, 0], zoom: 2.15, title: '木拱凌波', copy: '层层木骨相承，留一河清波往来。', index: '伍' }
};
const chapters = [
  { view: 'under', title: '虹桥营造', position: [17, 12, 32], target: [0, 4.1, 0], zoom: 2.15, copy: '五道木拱沿河而起，横梁与斜撑把桥身连成一体。层层铺板随拱势抬升，栏杆护住往来行人，也为桥下留出一泓清波。这里的木构取画作之意，而非工程复原。' },
  { view: 'bridge', title: '桥上百业', position: [22, 20, 29], target: [0, 4.8, 0], zoom: 2.5, copy: '果物、鲜鱼、茶食与布匹分列桥面两侧，中间留给人潮。挑夫拾级而过，摊主俯身招呼；一担一筐之间，是桥头最寻常也最鲜活的日常。' },
  { view: 'market', title: '茶烟巷口', position: [35, 19, 22], target: [19.5, 4.1, -5.5], zoom: 3.05, copy: '临河茶坊推开铺面，格窗、露台与招牌各自成景。檐下茶烟缓缓升起，杯盏已经摆上桌。走近些，能看见布卷、陶罐和等候开张的货物。' },
  { view: 'river', title: '一船春水', follow: true, zoom: 2.35, copy: '货船沿河缓缓往来，接近虹桥便降下桅杆，驶离后再重新升起。船工撑篙，水痕随船尾展开。开启随船镜头，让两岸屋檐与桥上人潮从眼前慢慢流过。' },
  { view: 'market', title: '河岸日常', position: [27, 16, 31], target: [9, 2.4, 11.5], zoom: 3, copy: '石阶连接街市与码头，缆绳、搭板和箩筐各有归处。有人卸货，有人闲谈，也有小舟静静靠岸。虹桥之外，河岸本身就是一座不停运转的市井。' }
];
const numerals = ['壹', '贰', '叁', '肆', '伍'];
const qualityPresets = { high: { dpr: 1.7, shadow: 4096, label: '精致' }, balanced: { dpr: 1.25, shadow: 2048, label: '均衡' }, low: { dpr: 1, shadow: 1024, label: '流畅' } };
const followOffset = new THREE.Vector3(17, 13, 23), followFocus = new THREE.Vector3(), followGoal = new THREE.Vector3(), followDelta = new THREE.Vector3();
let renderer, scene, camera, controls, sun, environment;
let simulationTime = 0, playing = true, speed = 1, atmosphere = 'day';
let qualityMode = 'auto', quality = 'high', currentView = 'overview', following = false, guideIndex = -1;
let frameHandle = 0, viewTween = null, toastTimer = 0, initialized = false, hiddenPause = false, reducedMotion = false;
let lastFrame = performance.now(), lastSimulationTime = null, renderRequested = true, renderedFrames = 0, idleFrames = 0;
let lastQualityReview = performance.now();
const timings = [], frameIntervals = [];

function requestRender() { renderRequested = true; }
function showError(error) {
  console.error(error); cancelAnimationFrame(frameHandle);
  $('loading').classList.add('hidden'); $('error').classList.remove('hidden');
  $('error-copy').textContent = '请使用支持 WebGL 2 的现代浏览器，并开启浏览器硬件加速。' + (error?.message ? '（' + error.message + '）' : '');
}
function toast(message) {
  $('toast').textContent = message; $('toast').classList.add('show'); clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('show'), 1800);
}
function viewPose(view, name = currentView) {
  let zoom = view.zoom;
  if (innerWidth <= 600) zoom *= name === 'bridge' ? 1.08 : name === 'market' || name === 'river' ? 1.04 : 1;
  return { position: new THREE.Vector3(...view.position), target: new THREE.Vector3(...view.target), zoom };
}
function moveCamera(pose, animate = true) {
  if (animate && !reducedMotion) {
    viewTween = { start: performance.now(), fromPosition: camera.position.clone(), fromTarget: controls.target.clone(), fromZoom: camera.zoom, toPosition: pose.position.clone(), toTarget: pose.target.clone(), toZoom: pose.zoom };
  } else {
    viewTween = null; camera.position.copy(pose.position); controls.target.copy(pose.target);
    camera.zoom = pose.zoom; camera.updateProjectionMatrix(); controls.update();
  }
  requestRender();
}
function setViewState(name) {
  currentView = name;
  document.querySelectorAll('.view-button').forEach(button => {
    const active = button.dataset.view === name; button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'true'); else button.removeAttribute('aria-current');
  });
  document.body.classList.toggle('detail-view', name !== 'overview');
  const view = views[name];
  $('caption-title').textContent = view.title; $('caption-copy').textContent = view.copy;
  document.querySelector('.caption-index').textContent = view.index; $('follow').hidden = name !== 'river'; resize();
}
function closeGuide(restoreFocus = false) {
  guideIndex = -1; $('guide-panel').classList.add('hidden'); $('guide-toggle').setAttribute('aria-pressed', 'false');
  document.body.classList.remove('guide-open'); if (restoreFocus) $('guide-toggle').focus({ preventScroll: true });
}
function setFollowing(value) {
  following = value; $('follow').setAttribute('aria-pressed', String(value));
  $('follow').innerHTML = value ? '退出随船 <span aria-hidden="true">×</span>' : '随船漫游 <span aria-hidden="true">→</span>';
  if (value) {
    setViewState('river'); followFocus.copy(fleet[0].position); followFocus.y += 1.05;
    followGoal.copy(followFocus).add(followOffset);
    moveCamera({ position: followGoal, target: followFocus, zoom: viewPose({ position: [0, 0, 0], target: [0, 0, 0], zoom: 2.35 }, 'river').zoom });
  }
  requestRender();
}
function applyView(name, animate = true) {
  if (!views[name]) throw new Error(`未知视角：${name}`);
  closeGuide(); setFollowing(false); setViewState(name); moveCamera(viewPose(views[name], name), animate);
}
function showGuide(index = 0) {
  guideIndex = THREE.MathUtils.clamp(index, 0, chapters.length - 1);
  const chapter = chapters[guideIndex];
  $('guide-panel').classList.remove('hidden'); $('guide-toggle').setAttribute('aria-pressed', 'true'); document.body.classList.add('guide-open');
  $('guide-step').textContent = `风物志 · ${numerals[guideIndex]} / 伍`;
  $('guide-progress').textContent = `${numerals[guideIndex]} / 伍`;
  $('guide-title').textContent = chapter.title; $('guide-copy').textContent = chapter.copy;
  $('guide-prev').disabled = guideIndex === 0; $('guide-next').disabled = guideIndex === chapters.length - 1;
  setViewState(chapter.view);
  if (chapter.follow) setFollowing(true);
  else { setFollowing(false); moveCamera(viewPose(chapter, chapter.view)); }
}
function syncFollow(delta, instant = false) {
  if (!following) return;
  followFocus.copy(fleet[0].position); followFocus.y += 1.05;
  if (viewTween) {
    viewTween.toTarget.copy(followFocus); viewTween.toPosition.copy(followFocus).add(followOffset);
  } else {
    followDelta.copy(followFocus).sub(controls.target);
    if (!instant && !reducedMotion) followDelta.multiplyScalar(1 - Math.exp(-delta * 4));
    if (followDelta.lengthSq() > 1e-10) { controls.target.add(followDelta); camera.position.add(followDelta); requestRender(); }
  }
}
function setPlaying(value) {
  playing = value; $('pause-icon').classList.toggle('hidden', !playing); $('play-icon').classList.toggle('hidden', playing);
  $('play-label').textContent = playing ? '暂停' : '播放'; $('play').setAttribute('aria-label', playing ? '暂停动态' : '播放动态');
  $('world-state').textContent = playing ? ATMOSPHERES[atmosphere].state : '此刻 · 时光停驻';
  document.querySelector('.live-dot').classList.toggle('paused', !playing);
}
function cycleSpeed() {
  speed = speed === 1 ? 2 : speed === 2 ? 4 : 1;
  $('speed').innerHTML = `${speed}× <span class="speed-label">流速</span>`;
  $('speed').setAttribute('aria-label', `快进，当前${speed}倍速度`);
  toast(speed === 1 ? '回到寻常步调' : `${speed} 倍时光 · 舟行人往`);
}
function setAtmosphere(name, animate = true, notify = true) {
  if (!ATMOSPHERES[name]) throw new Error(`未知环境：${name}`);
  atmosphere = name; environment.setAtmosphere(name, !animate || reducedMotion);
  $('atmosphere-label').textContent = ATMOSPHERES[name].label;
  $('atmosphere').setAttribute('aria-label', `切换环境，当前${ATMOSPHERES[name].label}，按 T 切换`);
  setPlaying(playing); requestRender(); if (notify) toast(`${ATMOSPHERES[name].label} · ${name === 'dusk' ? '一河暖意，檐下初灯' : name === 'morning' ? '薄晨光里，河市初醒' : '春水晴光，市井正忙'}`);
}
function cycleAtmosphere() {
  const names = Object.keys(ATMOSPHERES);
  setAtmosphere(names[(names.indexOf(atmosphere) + 1) % names.length]);
}
function about(open) {
  if (open && !$('about').open) {
    $('about').showModal(); document.body.classList.add('panel-open'); $('about-close').focus({ preventScroll: true });
  } else if (!open && $('about').open) $('about').close();
}
function autoQuality() { return innerWidth <= 700 || matchMedia('(pointer: coarse)').matches ? 'balanced' : 'high'; }
function updateQualityLabel() {
  const modeLabel = qualityMode === 'auto' ? '自动' : qualityPresets[quality].label;
  $('quality').textContent = `画质 · ${modeLabel}`;
  $('quality').setAttribute('aria-label', `画质，${modeLabel}模式，当前${qualityPresets[quality].label}`);
  $('quality').title = qualityMode === 'auto' ? `自动画质 · 当前${qualityPresets[quality].label}；点击切换精致` : `当前${qualityPresets[quality].label}；点击切换${quality === 'high' ? '流畅' : '自动'}`;
}
function resize() {
  if (initialized && qualityMode === 'auto' && autoQuality() !== quality) { applyQuality(autoQuality()); return; }
  const w = innerWidth, h = innerHeight, aspect = w / h;
  const height = aspect < 1.1 ? (currentView === 'overview' ? 100 : 86) / aspect : 65 * (h < 600 ? 1.12 : 1);
  camera.left = -height * aspect / 2; camera.right = height * aspect / 2; camera.top = height / 2; camera.bottom = -height / 2;
  camera.updateProjectionMatrix(); renderer.setPixelRatio(Math.min(devicePixelRatio || 1, qualityPresets[quality].dpr)); renderer.setSize(w, h); requestRender();
}
function applyQuality(value) {
  quality = value; const preset = qualityPresets[value];
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = value === 'low' ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap;
  sun.shadow.mapSize.set(preset.shadow, preset.shadow);
  if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
  sun.shadow.needsUpdate = true; renderer.shadowMap.needsUpdate = true;
  environment.setQuality(value); frameIntervals.length = 0; updateQualityLabel(); resize(); requestRender();
}
function setQualityMode(mode) { qualityMode = mode; applyQuality(mode === 'auto' ? autoQuality() : mode); }
function cycleQuality() {
  const next = { auto: 'high', high: 'low', low: 'auto' }[qualityMode];
  setQualityMode(next); toast(next === 'auto' ? `自动画质 · 当前${qualityPresets[quality].label}` : next === 'high' ? '精致画质 · 细腻阴影与高像素密度' : '流畅画质 · 低成本阴影与精简细节');
}
function reviewQuality(now) {
  if (qualityMode !== 'auto' || frameIntervals.length < 150 || now - lastQualityReview < 5000) return;
  lastQualityReview = now;
  const mean = frameIntervals.reduce((a, b) => a + b, 0) / frameIntervals.length;
  if ((quality === 'high' && mean > 34) || (quality === 'balanced' && mean > 46)) {
    applyQuality(quality === 'high' ? 'balanced' : 'low'); toast(`已自动调整为${qualityPresets[quality].label}画质`);
  }
}
async function capturePhoto() {
  const button = $('capture-photo'); button.disabled = true;
  try {
    environment.update(simulationTime, 0, camera, reducedMotion); renderer.render(scene, camera);
    const blob = await new Promise((resolve, reject) => renderer.domElement.toBlob(result => result ? resolve(result) : reject(new Error('浏览器未能生成 PNG')), 'image/png'));
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = `汴水虹市-${ATMOSPHERES[atmosphere].label}-${currentView}.png`;
    document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
    toast('已生成 PNG 留影 · 不含界面控件');
  } catch (error) { console.error(error); toast('留影未能生成，请重试'); }
  finally { button.disabled = false; }
}
function bindUI() {
  $('play').addEventListener('click', () => setPlaying(!playing)); $('speed').addEventListener('click', cycleSpeed);
  $('reset').addEventListener('click', () => { applyView('overview'); toast('回到虹桥全景'); });
  $('quality').addEventListener('click', cycleQuality); $('atmosphere').addEventListener('click', cycleAtmosphere);
  $('capture-photo').addEventListener('click', capturePhoto);
  document.querySelectorAll('.view-button').forEach(button => button.addEventListener('click', () => applyView(button.dataset.view)));
  $('guide-toggle').addEventListener('click', () => guideIndex >= 0 ? closeGuide(true) : showGuide(0));
  $('guide-close').addEventListener('click', () => closeGuide(true));
  $('guide-prev').addEventListener('click', () => showGuide(guideIndex - 1)); $('guide-next').addEventListener('click', () => showGuide(guideIndex + 1));
  $('follow').addEventListener('click', () => { closeGuide(); setFollowing(!following); });
  $('about-toggle').addEventListener('click', () => about(true)); $('about-close').addEventListener('click', () => about(false));
  $('help').addEventListener('click', () => about(true));
  $('about').addEventListener('close', () => { document.body.classList.remove('panel-open'); $('about-toggle').focus({ preventScroll: true }); });
  window.addEventListener('resize', resize);
  window.addEventListener('keydown', event => {
    if ($('about').open) {
      if (event.key === 'Escape') { event.preventDefault(); about(false); }
      if (event.key === 'Tab') {
        const focusable = [...$('about').querySelectorAll('button:not(:disabled),[href],[tabindex]:not([tabindex="-1"])')].filter(element => element.getClientRects().length);
        const first = focusable[0], last = focusable[focusable.length - 1], active = document.activeElement;
        if (first && ((!event.shiftKey && active === last) || (event.shiftKey && active === first) || !$('about').contains(active))) {
          event.preventDefault(); (event.shiftKey ? last : first).focus({ preventScroll: true });
        }
      }
      return;
    }
    if (event.target instanceof HTMLElement && (event.target.isContentEditable || event.target.matches('input,textarea,select'))) return;
    if (event.code === 'Space' && event.target instanceof HTMLButtonElement) return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.code === 'Space') { event.preventDefault(); setPlaying(!playing); return; }
    if (event.code === 'KeyF') cycleSpeed();
    else if (event.code === 'KeyR') applyView('overview');
    else if (event.code === 'KeyT') cycleAtmosphere();
    else if (event.code === 'KeyG') guideIndex >= 0 ? closeGuide(true) : showGuide(0);
    else if (event.key === '?' || event.key === 'F1') { event.preventDefault(); about(true); }
    else if (event.key === 'Escape') { if (guideIndex >= 0) closeGuide(true); else if (following) setFollowing(false); }
    else if (event.key === 'ArrowLeft' && guideIndex > 0) { event.preventDefault(); showGuide(guideIndex - 1); }
    else if (event.key === 'ArrowRight' && guideIndex >= 0 && guideIndex < chapters.length - 1) { event.preventDefault(); showGuide(guideIndex + 1); }
    else { const number = Number(event.key); if (number >= 1 && number <= 5) applyView(Object.keys(views)[number - 1]); }
  });
  document.addEventListener('visibilitychange', () => {
    hiddenPause = document.hidden; lastFrame = performance.now();
    if (hiddenPause) { cancelAnimationFrame(frameHandle); frameHandle = 0; }
    else if (!frameHandle) { requestRender(); frameHandle = requestAnimationFrame(animate); }
  });
  const motionQuery = matchMedia('(prefers-reduced-motion: reduce)'); reducedMotion = motionQuery.matches;
  motionQuery.addEventListener('change', event => {
    reducedMotion = event.matches; if (reducedMotion) { setPlaying(false); viewTween = null; } requestRender();
  });
  renderer.domElement.addEventListener('webglcontextlost', event => { event.preventDefault(); showError(new Error('图形上下文已丢失，请重新打开作品。')); });
  controls.addEventListener('start', () => { viewTween = null; setFollowing(false); });
  controls.addEventListener('change', requestRender);
}
function updateCamera(now, delta) {
  syncFollow(delta);
  if (viewTween) {
    const t = THREE.MathUtils.clamp((now - viewTween.start) / 1200, 0, 1), eased = t * t * (3 - 2 * t);
    camera.position.lerpVectors(viewTween.fromPosition, viewTween.toPosition, eased);
    controls.target.lerpVectors(viewTween.fromTarget, viewTween.toTarget, eased);
    camera.zoom = THREE.MathUtils.lerp(viewTween.fromZoom, viewTween.toZoom, eased); camera.updateProjectionMatrix();
    if (t >= 1) viewTween = null; requestRender();
  }
  controls.update();
  const x = THREE.MathUtils.clamp(controls.target.x, -37, 37), y = THREE.MathUtils.clamp(controls.target.y, -.5, 13), z = THREE.MathUtils.clamp(controls.target.z, -33, 33);
  followDelta.set(x - controls.target.x, y - controls.target.y, z - controls.target.z);
  if (followDelta.lengthSq() > .000001) { camera.position.add(followDelta); controls.target.add(followDelta); requestRender(); }
}
function animate(now) {
  frameHandle = 0;
  if (hiddenPause) return;
  try {
    const interval = Math.max(0, now - lastFrame), delta = Math.min(.25, interval / 1000); lastFrame = now;
    if (playing) simulationTime += delta * speed;
    if (simulationTime !== lastSimulationTime) {
      updateRiver(simulationTime); updatePeople(simulationTime); lastSimulationTime = simulationTime; requestRender();
    }
    updateCamera(now, delta);
    if (environment.update(simulationTime, delta, camera, reducedMotion)) requestRender();
    if (renderRequested) {
      const start = performance.now(); renderer.render(scene, camera); renderRequested = false; renderedFrames++;
      timings.push(performance.now() - start); if (timings.length > 180) timings.shift();
      if (interval > 0 && interval < 250) { frameIntervals.push(interval); if (frameIntervals.length > 180) frameIntervals.shift(); }
      reviewQuality(now);
      if (!initialized) {
        initialized = true; window.__HONGSHI__.ready = true; $('loading').classList.add('done');
        setTimeout(() => $('loading')?.remove(), 900);
      }
    } else idleFrames++;
    frameHandle = requestAnimationFrame(animate);
  } catch (error) { showError(error); }
}
function init() {
  scene = new THREE.Scene(); scene.background = new THREE.Color('#e7e4d6'); scene.fog = new THREE.Fog('#e7e4d6', 120, 220);
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.13;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.setAttribute('aria-label', '汴水虹市三维场景。拖拽旋转，滚轮缩放，方向与数字快捷键详见操作说明。'); renderer.domElement.setAttribute('tabindex', '0');
  $('world').appendChild(renderer.domElement);
  camera = new THREE.OrthographicCamera(-50, 50, 32.5, -32.5, .1, 300);
  controls = new OrbitControls(camera, renderer.domElement); controls.enableDamping = true; controls.dampingFactor = .065; controls.rotateSpeed = .65; controls.panSpeed = .8;
  controls.minZoom = .65; controls.maxZoom = 6; controls.minPolarAngle = .16; controls.maxPolarAngle = Math.PI / 2 - .025; controls.screenSpacePanning = true;
  controls.target.set(0, 1.5, 0); controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
  controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };
  const hemisphere = new THREE.HemisphereLight('#fbf5e2', '#8c977e', 2.05); scene.add(hemisphere);
  sun = new THREE.DirectionalLight('#fff1cc', 3.15); sun.position.set(-26, 54, 35); sun.target.position.set(0, 0, 0); sun.castShadow = true;
  sun.shadow.mapSize.set(4096, 4096); sun.shadow.camera.left = -49; sun.shadow.camera.right = 49; sun.shadow.camera.top = 49; sun.shadow.camera.bottom = -49; sun.shadow.camera.near = 1; sun.shadow.camera.far = 130;
  sun.shadow.normalBias = .055; sun.shadow.bias = -.00015; sun.shadow.radius = 2.3; scene.add(sun, sun.target);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.MeshStandardMaterial({ color: '#e7e4d6', roughness: 1 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -2.08; floor.receiveShadow = true; scene.add(floor);
  terrain(); bridge(); town(); docks(); world.finish(scene, '市井 · 静态合批'); finishSigns(); scene.add(fixtures);
  environment = createEnvironment({ scene, renderer, hemisphere, sun, floor });
  populate(); setupRiver(scene, environment.waterMaterial); finishPeople(scene);
  bindUI(); setQualityMode('auto'); applyView('overview', false); setAtmosphere('day', false, false);
  if (reducedMotion) setPlaying(false);
  window.__HONGSHI__ = {
    ready: false,
    getDiagnostics: () => ({
      title: '汴水虹市', version: '2.0.0', time: simulationTime, playing, speed, qualityMode, quality, view: currentView, atmosphere, following,
      guide: { active: guideIndex >= 0, index: guideIndex, title: chapters[guideIndex]?.title || null },
      geometry: { staticVoxels: world.items.length, drawCalls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, pixelRatio: renderer.getPixelRatio(), shadowMapSize: sun.shadow.mapSize.x, signs: audit.signs },
      environment: environment.getDiagnostics(), people: peopleDiagnostics(), boats: boatDiagnostics(simulationTime), bridge: audit.bridge,
      marketKinds: Object.keys(audit.markets), buildings: audit.buildings.length, docks: audit.docks,
      camera: { position: camera.position.toArray(), target: controls.target.toArray(), zoom: camera.zoom },
      performance: { frames: timings.length, renderedFrames, idleFrames, meanCpuMs: timings.reduce((a, b) => a + b, 0) / Math.max(1, timings.length), meanFrameMs: frameIntervals.reduce((a, b) => a + b, 0) / Math.max(1, frameIntervals.length) },
      actors: actors.filter(actor => actor.route).slice(0, 6).map(actor => actor.current)
    }),
    setTime: time => {
      const value = Number(time); if (!Number.isFinite(value) || value < 0) throw new Error('模拟时间必须是非负有限数值');
      simulationTime = value; updateRiver(value); updatePeople(value); lastSimulationTime = value; syncFollow(0, true);
      environment.update(value, 0, camera, reducedMotion); renderer.render(scene, camera); renderRequested = false;
    },
    pause: () => setPlaying(false), play: () => setPlaying(true), view: name => applyView(name, false),
    atmosphere: name => setAtmosphere(name, false, false),
    auditNavigation: () => { const result = auditNavigation(); updateRiver(simulationTime); updatePeople(simulationTime); requestRender(); return result; },
    capture: () => { environment.update(simulationTime, 0, camera, reducedMotion); renderer.render(scene, camera); return renderer.domElement.toDataURL('image/png'); }
  };
  lastFrame = performance.now(); frameHandle = requestAnimationFrame(animate);
}
try { init(); } catch (error) { showError(error); }
