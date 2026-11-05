import { chromium } from 'playwright';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { writeFile, mkdir } from 'node:fs/promises';

const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_PATH || 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', args: ['--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
const errors = [], networkRequests = [], screenshots = [];
page.on('pageerror', error => errors.push(String(error)));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
await page.route(/^https?:/, route => { networkRequests.push(route.request().url()); route.abort(); });
try {
  await mkdir('artifacts', { recursive: true });
  await page.goto(pathToFileURL(resolve('汴水虹市.html')).href);
  await page.waitForFunction(() => window.__HONGSHI__?.ready, null, { timeout: 60000 });
  await page.waitForTimeout(1300); await page.evaluate(() => { window.__HONGSHI__.pause(); window.__HONGSHI__.setTime(0); });
  const diagnostics = await page.evaluate(() => window.__HONGSHI__.getDiagnostics());
  const shot = async file => { await page.screenshot({ path: `artifacts/${file}.png` }); screenshots.push(`${file}.png`); };
  for (const [view, file] of [['overview', '全景'], ['bridge', '桥上市集'], ['market', '两岸街市'], ['river', '河上舟运'], ['under', '木拱结构']]) {
    await page.evaluate(name => window.__HONGSHI__.view(name), view); await page.waitForTimeout(250); await shot(file);
  }
  await page.evaluate(() => { window.__HONGSHI__.atmosphere('dusk'); window.__HONGSHI__.setTime(8); window.__HONGSHI__.view('market'); });
  await page.waitForTimeout(250); await shot('灯夕茶坊');
  await page.evaluate(() => window.__HONGSHI__.atmosphere('day')); await page.locator('#guide-toggle').click();
  await page.locator('#guide-next').click(); await page.locator('#guide-next').click(); await page.waitForTimeout(1400); await shot('风物导览');
  await page.locator('#guide-close').click();
  await page.evaluate(() => { window.__HONGSHI__.setTime(15.384615); window.__HONGSHI__.view('under'); }); await shot('穿桥净空');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { window.__HONGSHI__.setTime(0); window.__HONGSHI__.view('overview'); }); await page.waitForTimeout(250); await shot('手机全景');
  await page.evaluate(() => window.__HONGSHI__.view('bridge')); await page.waitForTimeout(250); await shot('手机视图');
  const pass = errors.length === 0 && networkRequests.length === 0;
  await writeFile('artifacts/preview-report.json', JSON.stringify({ generatedAt: new Date().toISOString(), pass, errors, networkRequests, screenshots, diagnostics }, null, 2));
  if (!pass) throw new Error('预览存在控制台错误或外部资源请求');
  console.log(JSON.stringify({ pass, errors, networkRequests, screenshots, drawCalls: diagnostics.geometry.drawCalls, meanCpuMs: diagnostics.performance.meanCpuMs }, null, 2));
} finally { await browser.close(); }
