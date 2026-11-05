import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile, copyFile, mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';

const report = { startedAt: new Date().toISOString(), browser: 'Microsoft Edge / headless', checks: [], errors: [], networkRequests: [], screenshots: [], responsive: [], atmospheres: [] };
const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', args: ['--enable-unsafe-swiftshader'] });
report.browserVersion = browser.version();
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
const guard = async ctx => ctx.route(/^https?:/, route => { report.networkRequests.push(route.request().url()); route.abort(); });
const watch = p => {
  p.on('pageerror', error => report.errors.push(String(error)));
  p.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()); });
};
await guard(context);
const page = await context.newPage(); watch(page);
const check = async (name, fn) => { await fn(); report.checks.push({ name, pass: true }); console.log(`PASS ${name}`); };
const diag = () => page.evaluate(() => window.__HONGSHI__.getDiagnostics());
const near = (a, b, tol = .08) => Math.abs(a - b) < tol;
const imageHash = async () => createHash('sha256').update(await page.evaluate(() => window.__HONGSHI__.capture())).digest('hex');
const shot = async (file, target = page, options = {}) => {
  await target.screenshot({ path: `artifacts/${file}.png`, ...options }); report.screenshots.push(`${file}.png`);
};
const layout = target => target.evaluate(() => ({
  width: innerWidth, height: innerHeight, overflow: document.documentElement.scrollWidth > innerWidth,
  buttons: [...document.querySelectorAll('.bottom-bar button,.view-button,.discovery-tools button,#about-toggle')].filter(e => e.getClientRects().length).map(e => {
    const r = e.getBoundingClientRect(); return { id: e.id || e.dataset.view, x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
  })
}));
await mkdir('artifacts', { recursive: true });
try {
  const isolated = await mkdtemp(join(tmpdir(), 'hongshi-offline-'));
  const isolatedURL = pathToFileURL(join(isolated, '汴水虹市.html')).href;
  await copyFile(resolve('汴水虹市.html'), join(isolated, '汴水虹市.html'));
  await page.goto(isolatedURL);
  await page.waitForFunction(() => window.__HONGSHI__?.ready, null, { timeout: 60000 });
  await page.waitForTimeout(1300);
  await check('单文件离线加载与 2.0 版本', async () => {
    assert.equal(await page.title(), '汴水虹市 · 春日汴河上的一刻'); assert.equal((await diag()).version, '2.0.0');
    assert.equal(report.networkRequests.length, 0); assert.equal(await page.locator('#error').isVisible(), false);
  });
  report.initial = await diag();
  await check('人物、建筑、经营内容与舟船数量', async () => {
    const d = await diag(); assert.equal(d.people.total, 101); assert.equal(d.people.walking, 46); assert.equal(d.boats.count, 4);
    assert.ok(d.marketKinds.length >= 7); assert.equal(d.buildings, 18); assert.equal(d.bridge.marketCount, 8);
    assert.equal(d.environment.lanterns, 22); assert.equal(d.environment.smokeSources, 3); assert.ok(d.environment.foliageVoxels > 600);
  });
  await check('招牌图集合批与着色器实际生效', async () => {
    const d = await diag(); assert.equal(d.geometry.signs.instances, 36); assert.equal(d.geometry.signs.tiles, 29); assert.equal(d.geometry.signs.drawCalls, 1);
    assert.ok(d.geometry.drawCalls < 60); assert.ok(d.geometry.textures < 12); assert.ok(d.environment.waterShaderReady); assert.ok(d.environment.windShaderReady);
  });
  await check('全部步行路线避开建筑与地面摊位', async () => assert.equal((await diag()).people.routeCollisionCount, 0));
  await check('完整航线、转弯与穿桥净空', async () => {
    report.navigation = await page.evaluate(() => window.__HONGSHI__.auditNavigation());
    assert.deepEqual(report.navigation.issues, []); assert.ok(report.navigation.minimumBridgeClearance > .8); assert.ok(report.navigation.minimumBankMargin > 1);
  });
  await check('暂停时画面、环境时钟与渲染帧保持不变', async () => {
    await page.locator('#play').click(); await page.waitForTimeout(120); const a = await diag(); assert.equal(a.playing, false);
    const hashA = await imageHash(); await page.waitForTimeout(550); const b = await diag(), hashB = await imageHash();
    assert.equal(a.time, b.time); assert.deepEqual(a.actors, b.actors); assert.equal(a.environment.waterTime, b.environment.waterTime);
    assert.equal(a.environment.windTime, b.environment.windTime); assert.equal(a.environment.smokeTime, b.environment.smokeTime);
    assert.equal(a.performance.renderedFrames, b.performance.renderedFrames); assert.ok(b.performance.idleFrames > a.performance.idleFrames); assert.equal(hashA, hashB);
  });
  await check('恢复播放后行人与船只持续运动', async () => {
    const a = await diag(); await page.locator('#play').click(); await page.waitForTimeout(550); const b = await diag();
    assert.equal(b.playing, true); assert.ok(b.time > a.time + .3); assert.notEqual(b.actors[0].x, a.actors[0].x); assert.notEqual(b.boats.main.z, a.boats.main.z);
  });
  await check('一、二、四倍快进及实际时间推进', async () => {
    await page.locator('#speed').click(); assert.equal((await diag()).speed, 2);
    await page.locator('#speed').click(); const a = await diag(); assert.equal(a.speed, 4); await page.waitForTimeout(400); const b = await diag();
    assert.ok(b.time - a.time > 1); await page.locator('#speed').click(); assert.equal((await diag()).speed, 1);
  });
  await check('晨曦、晴昼、灯夕与平滑环境切换', async () => {
    await page.evaluate(() => window.__HONGSHI__.pause());
    for (const name of ['morning', 'dusk', 'day']) {
      await page.evaluate(value => window.__HONGSHI__.atmosphere(value), name); await page.waitForTimeout(100);
      const d = await diag(); assert.equal(d.atmosphere, name); assert.equal(d.environment.transitioning, false);
      if (name === 'dusk') assert.ok(d.environment.glowStrength > .99); else if (name === 'day') assert.equal(d.environment.glowStrength, 0);
      report.atmospheres.push({ name, sunColor: d.environment.sunColor, sunPosition: d.environment.sunPosition, exposure: d.environment.exposure, hash: await imageHash() });
    }
    assert.equal(new Set(report.atmospheres.map(item => item.hash)).size, 3);
    const before = await imageHash(); await page.locator('#atmosphere').click(); assert.equal((await diag()).atmosphere, 'dusk');
    await page.waitForFunction(() => !window.__HONGSHI__.getDiagnostics().environment.transitioning, null, { timeout: 5000 });
    assert.ok((await diag()).environment.glowStrength > .99); assert.notEqual(await imageHash(), before);
    await page.evaluate(() => { window.__HONGSHI__.atmosphere('day'); window.__HONGSHI__.setTime(0); });
  });
  await check('过桥降桅及方向正确的随船尾迹', async () => {
    report.boatPoses = [];
    for (const t of [0, 15.384615, 39.8, 53, 75, 104, 125]) {
      await page.evaluate(time => window.__HONGSHI__.setTime(time), t); const d = await diag(), boat = d.boats;
      if (Math.abs(boat.main.z) < 10) assert.ok(boat.main.mastFold > .98);
      const dot = (boat.wakeOrigin.x - boat.main.x) * boat.direction.x + (boat.wakeOrigin.z - boat.main.z) * boat.direction.z;
      assert.ok(dot < -.5); assert.equal(d.environment.waterTime, t); assert.equal(d.environment.windTime, t);
      report.boatPoses.push({ time: t, boat: boat.main, wakeBehindDot: dot });
    }
    await page.evaluate(() => { window.__HONGSHI__.setTime(15.384615); window.__HONGSHI__.view('under'); }); await shot('穿桥净空');
  });
  await check('鼠标旋转、滚轮缩放、右键与 Shift 平移', async () => {
    await page.evaluate(() => window.__HONGSHI__.view('overview')); const a = await diag();
    await page.mouse.move(800, 510); await page.mouse.down(); await page.mouse.move(980, 580, { steps: 14 }); await page.mouse.up(); await page.waitForTimeout(350);
    const b = await diag(); assert.ok(Math.hypot(...b.camera.position.map((v, i) => v - a.camera.position[i])) > 3);
    await page.mouse.wheel(0, -400); await page.waitForTimeout(350); const c = await diag(); assert.ok(c.camera.zoom > b.camera.zoom);
    await page.mouse.down({ button: 'right' }); await page.mouse.move(900, 530, { steps: 9 }); await page.mouse.up({ button: 'right' }); await page.waitForTimeout(300);
    const d = await diag(); assert.ok(Math.hypot(...d.camera.target.map((v, i) => v - c.camera.target[i])) > .2);
    await page.keyboard.down('Shift'); await page.mouse.down(); await page.mouse.move(850, 550, { steps: 7 }); await page.mouse.up(); await page.keyboard.up('Shift'); await page.waitForTimeout(300);
    const e = await diag(); assert.ok(Math.hypot(...e.camera.target.map((v, i) => v - d.camera.target[i])) > .2);
  });
  await check('五个预设视角与归位按钮', async () => {
    for (const [name, zoom] of [['bridge', 2.05], ['market', 2.5], ['river', 2.25], ['under', 2.15]]) {
      await page.locator(`[data-view="${name}"]`).click(); await page.waitForTimeout(1400); assert.ok(near((await diag()).camera.zoom, zoom, .01));
    }
    await page.locator('#reset').click(); await page.waitForTimeout(1400); const d = await diag();
    assert.ok(near(d.camera.zoom, 1, .01)); assert.ok(d.camera.position.every((v, i) => near(v, [56, 48, 64][i], .05)));
  });
  await check('键盘快捷键与预设视角', async () => {
    await page.locator('canvas').focus(); await page.keyboard.press('Space'); assert.equal((await diag()).playing, true);
    await page.keyboard.press('Space'); assert.equal((await diag()).playing, false);
    await page.keyboard.press('f'); assert.equal((await diag()).speed, 2); await page.keyboard.press('f'); await page.keyboard.press('f'); assert.equal((await diag()).speed, 1);
    await page.keyboard.press('2'); await page.waitForTimeout(1400); assert.ok(near((await diag()).camera.zoom, 2.05, .01));
    await page.keyboard.press('t'); assert.equal((await diag()).atmosphere, 'dusk'); await page.keyboard.press('t'); assert.equal((await diag()).atmosphere, 'morning');
    await page.keyboard.press('t'); await page.waitForTimeout(1300); assert.equal((await diag()).atmosphere, 'day');
    await page.keyboard.press('r'); await page.waitForTimeout(1400); assert.ok(near((await diag()).camera.zoom, 1, .01));
  });
  await check('原生对话框焦点约束、快捷键隔离与恢复', async () => {
    const before = await diag(); await page.locator('#about-toggle').click(); assert.equal(await page.locator('#about').isVisible(), true);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'about-close');
    await page.keyboard.press('t'); await page.keyboard.press('f'); const during = await diag();
    assert.equal(during.atmosphere, before.atmosphere); assert.equal(during.speed, before.speed); assert.equal(during.playing, before.playing);
    await page.keyboard.press('Tab'); assert.equal(await page.evaluate(() => document.getElementById('about').contains(document.activeElement)), true);
    await page.keyboard.press('Escape'); assert.equal(await page.locator('#about').isVisible(), false);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'about-toggle');
  });
  await check('五则风物导览、前后导航与随船跟踪', async () => {
    await page.evaluate(() => { window.__HONGSHI__.setTime(0); window.__HONGSHI__.play(); });
    await page.locator('#guide-toggle').click(); assert.equal((await diag()).guide.index, 0); assert.equal(await page.locator('#guide-prev').isDisabled(), true);
    const titles = ['桥上百业', '茶烟巷口', '一船春水', '河岸日常'];
    for (let i = 0; i < titles.length; i++) {
      await page.locator('#guide-next').click(); const d = await diag(); assert.equal(d.guide.index, i + 1); assert.equal(d.guide.title, titles[i]);
      if (i === 2) assert.equal(d.following, true);
    }
    assert.equal(await page.locator('#guide-next').isDisabled(), true);
    await page.locator('#guide-prev').click(); await page.waitForTimeout(1900); const a = await diag(); assert.equal(a.following, true);
    const lag = Math.hypot(a.camera.target[0] - a.boats.main.x, a.camera.target[2] - a.boats.main.z); assert.ok(lag < .45, JSON.stringify({ lag, target: a.camera.target, boat: a.boats.main, time: a.time }));
    await page.waitForTimeout(500); const b = await diag(); assert.ok(Math.hypot(...b.camera.target.map((v, i) => v - a.camera.target[i])) > .15);
    await page.keyboard.press('ArrowLeft'); assert.equal((await diag()).guide.index, 2); assert.equal((await diag()).following, false);
    await page.keyboard.press('Escape'); assert.equal((await diag()).guide.active, false); assert.equal(await page.evaluate(() => document.activeElement.id), 'guide-toggle');
    await page.evaluate(() => window.__HONGSHI__.view('river')); await page.locator('#follow').click(); assert.equal((await diag()).following, true);
    await page.mouse.move(760, 440); await page.mouse.down(); await page.mouse.move(810, 460, { steps: 5 }); await page.mouse.up(); assert.equal((await diag()).following, false);
  });
  await check('留影按钮真实下载 PNG', async () => {
    await page.evaluate(() => { window.__HONGSHI__.pause(); window.__HONGSHI__.atmosphere('dusk'); window.__HONGSHI__.view('market'); });
    const pending = page.waitForEvent('download'); await page.locator('#capture-photo').click(); const download = await pending;
    assert.equal(download.suggestedFilename(), '汴水虹市-灯夕-market.png'); assert.equal(await download.failure(), null);
    const bytes = await readFile(await download.path()); assert.equal(bytes.subarray(1, 4).toString(), 'PNG'); assert.ok(bytes.length > 10000);
    assert.equal(bytes.readUInt32BE(16), 1600); assert.equal(bytes.readUInt32BE(20), 1000);
    report.photo = { filename: download.suggestedFilename(), bytes: bytes.length, width: 1600, height: 1000 }; await download.delete();
  });
  await check('自动、精致、流畅画质与低成本阴影', async () => {
    assert.equal((await diag()).qualityMode, 'auto'); await page.locator('#quality').click(); assert.equal((await diag()).qualityMode, 'high');
    const high = await diag(); assert.equal(high.geometry.shadowMapSize, 4096);
    await page.locator('#quality').click(); await page.waitForTimeout(100); const low = await diag();
    assert.equal(low.qualityMode, 'low'); assert.equal(low.quality, 'low'); assert.equal(low.geometry.shadowMapSize, 1024); assert.equal(low.environment.smokeVisible, false);
    assert.ok(low.geometry.drawCalls <= high.geometry.drawCalls); assert.ok(low.geometry.pixelRatio <= 1);
    await page.locator('#quality').click(); await page.waitForTimeout(100); const automatic = await diag(); assert.equal(automatic.qualityMode, 'auto'); assert.equal(automatic.quality, 'high');
  });
  await check('固定时刻桌面视觉记录', async () => {
    await page.waitForFunction(() => !document.getElementById('toast').classList.contains('show'));
    await page.evaluate(() => { window.__HONGSHI__.atmosphere('day'); window.__HONGSHI__.setTime(0); });
    for (const [name, file] of [['overview', '全景'], ['bridge', '桥上市集'], ['market', '两岸街市'], ['river', '河上舟运'], ['under', '木拱结构']]) {
      await page.evaluate(value => window.__HONGSHI__.view(value), name); await page.waitForTimeout(250); await shot(file);
    }
    await page.evaluate(() => { window.__HONGSHI__.atmosphere('dusk'); window.__HONGSHI__.setTime(8); window.__HONGSHI__.view('market'); }); await page.waitForTimeout(250); await shot('灯夕茶坊');
    await page.evaluate(() => window.__HONGSHI__.atmosphere('day')); await page.locator('#guide-toggle').click();
    await page.locator('#guide-next').click(); await page.locator('#guide-next').click(); await page.waitForTimeout(1400); await shot('风物导览');
    await page.locator('#guide-close').click();
  });
  await check('窄屏、手机与横屏布局和导览可操作性', async () => {
    for (const [width, height] of [[390, 844], [320, 568]]) {
      await page.setViewportSize({ width, height }); await page.evaluate(() => window.__HONGSHI__.view('overview')); await page.waitForTimeout(350);
      const state = await layout(page); assert.equal(state.overflow, false);
      assert.ok(state.buttons.every(r => r.x >= 0 && r.right <= width && r.y >= 0 && r.bottom <= height));
      assert.ok(state.buttons.every(r => r.height >= 43.5)); assert.equal((await diag()).quality, 'balanced'); report.responsive.push(state);
      if (width === 390) {
        await shot('手机全景'); await page.locator('[data-view="bridge"]').click(); await page.waitForTimeout(1400); await shot('手机视图');
        await page.locator('#play').click(); assert.equal((await diag()).playing, true); await page.locator('#play').click(); assert.equal((await diag()).playing, false);
      } else await shot('窄屏全景');
    }
    await page.locator('#guide-toggle').click(); let bounds = await page.locator('#guide-panel').boundingBox();
    assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 320 && bounds.y >= 0 && bounds.y + bounds.height <= 568);
    await page.locator('#guide-next').click(); assert.equal((await diag()).guide.index, 1); await page.locator('#guide-close').click();
    for (const [width, height] of [[844, 390], [1024, 768]]) {
      await page.setViewportSize({ width, height }); await page.evaluate(() => window.__HONGSHI__.view('overview')); await page.waitForTimeout(350);
      const state = await layout(page); assert.equal(state.overflow, false);
      assert.ok(state.buttons.every(r => r.x >= 0 && r.right <= width && r.y >= 0 && r.bottom <= height)); report.responsive.push(state);
      if (width === 844) {
        await page.locator('#guide-toggle').click(); bounds = await page.locator('#guide-panel').boundingBox();
        assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= width && bounds.y + bounds.height <= height); await shot('横屏游历'); await page.locator('#guide-close').click();
      }
    }
  });
  await check('真实移动触控、设备像素比与自动画质', async () => {
    const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    await guard(mobile); const p = await mobile.newPage(); watch(p); await p.goto(isolatedURL); await p.waitForFunction(() => window.__HONGSHI__?.ready, null, { timeout: 60000 });
    const get = () => p.evaluate(() => window.__HONGSHI__.getDiagnostics()); const initial = await get();
    assert.equal(initial.quality, 'balanced'); assert.equal(initial.qualityMode, 'auto'); assert.equal(initial.geometry.pixelRatio, 1.25); assert.equal(initial.geometry.shadowMapSize, 2048);
    await p.locator('[data-view="bridge"]').tap(); assert.ok(near((await get()).camera.zoom, 2.05 * 1.08, .01));
    await p.locator('#atmosphere').tap(); assert.equal((await get()).atmosphere, 'dusk'); assert.equal((await get()).environment.transitioning, false);
    const state = await layout(p); assert.ok(state.buttons.every(r => r.height >= 43.5)); await shot('触控手机', p, { scale: 'css' });
    await p.locator('#guide-toggle').tap(); await p.locator('#guide-next').tap(); assert.equal((await get()).guide.index, 1); await p.locator('#guide-close').tap(); await mobile.close();
  });
  await check('减少动态偏好与即时无转场操作', async () => {
    const reduce = await browser.newContext({ reducedMotion: 'reduce', viewport: { width: 1000, height: 700 } });
    await guard(reduce); const p = await reduce.newPage(); watch(p); await p.goto(isolatedURL); await p.waitForFunction(() => window.__HONGSHI__?.ready, null, { timeout: 60000 });
    assert.equal(await p.evaluate(() => window.__HONGSHI__.getDiagnostics().playing), false);
    await p.locator('#atmosphere').click(); assert.equal(await p.evaluate(() => window.__HONGSHI__.getDiagnostics().environment.transitioning), false);
    await p.locator('#guide-toggle').click(); assert.ok(near(await p.evaluate(() => window.__HONGSHI__.getDiagnostics().camera.zoom), 2.15, .001)); await reduce.close();
  });
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.evaluate(() => { window.__HONGSHI__.atmosphere('day'); window.__HONGSHI__.view('overview'); window.__HONGSHI__.play(); }); await page.waitForTimeout(1200);
  report.final = await diag();
  await check('控制台与外部资源请求', async () => { assert.deepEqual(report.errors, []); assert.deepEqual(report.networkRequests, []); });
  report.pass = true;
} catch (error) {
  report.pass = false; report.failure = String(error.stack || error); console.error(error); await page.screenshot({ path: 'artifacts/检查失败.png' }).catch(() => {}); process.exitCode = 1;
} finally {
  report.completedAt = new Date().toISOString(); await writeFile('artifacts/browser-report.json', JSON.stringify(report, null, 2));
  await browser.close(); console.log(`浏览器验收 ${report.pass ? '通过' : '失败'} · ${report.checks.length} 组检查`);
}
