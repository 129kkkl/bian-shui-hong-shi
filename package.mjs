import assert from 'node:assert/strict';
import { readFile, readdir, writeFile, rename, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { deflateRawSync, inflateRawSync } from 'node:zlib';
import { resolve } from 'node:path';

const rootName = '汴水虹市';
const output = resolve('汴水虹市-完整项目.zip'), temporary = resolve('汴水虹市-完整项目.zip.tmp');
const files = [
  '汴水虹市.html', 'README.md', 'THIRD_PARTY_NOTICES.txt', 'package.json', 'package-lock.json',
  'build.mjs', 'package.mjs', 'server.mjs', '.gitignore',
  ...['architecture.js', 'boats.js', 'citizens.js', 'environment.js', 'geometry.js', 'index.html', 'main.js', 'style.css'].map(name => `src/${name}`),
  ...['browser.mjs', 'preview.mjs', 'server.mjs'].map(name => `tests/${name}`),
  ...['browser-report.json', 'preview-report.json', 'server-report.json', '验收说明.md'].map(name => `artifacts/${name}`)
];
const images = (await readdir('artifacts')).filter(name => name.endsWith('.png') && name !== '检查失败.png').sort((a, b) => a.localeCompare(b, 'zh-CN'));
files.push(...images.map(name => `artifacts/${name}`));
const sources = new Map(await Promise.all(files.map(async file => [file, await readFile(resolve(file))])));
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let value = n;
  for (let k = 0; k < 8; k++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  crcTable[n] = value >>> 0;
}
function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function makeZip() {
  const localParts = [], centralParts = [];
  let offset = 0;
  for (const [file, data] of sources) {
    const name = Buffer.from(`${rootName}/${file}`, 'utf8'), compressed = deflateRawSync(data, { level: 9 });
    const method = compressed.length < data.length ? 8 : 0, payload = method === 8 ? compressed : data, crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(method, 8);
    local.writeUInt16LE(0, 10); local.writeUInt16LE(33, 12); local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(payload.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(method, 10); central.writeUInt16LE(0, 12); central.writeUInt16LE(33, 14); central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(payload.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(name.length, 28); central.writeUInt32LE(offset, 42);
    localParts.push(local, name, payload); centralParts.push(central, name); offset += local.length + name.length + payload.length;
  }
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(sources.size, 8); end.writeUInt16LE(sources.size, 10);
  end.writeUInt32LE(centralSize, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...localParts, ...centralParts, end]);
}
function readZip(archive) {
  let end = -1;
  for (let i = archive.length - 22; i >= Math.max(0, archive.length - 65557); i--) {
    if (archive.readUInt32LE(i) === 0x06054b50) { end = i; break; }
  }
  assert.ok(end >= 0, 'ZIP 缺少结束目录');
  const count = archive.readUInt16LE(end + 10), entries = new Map();
  let offset = archive.readUInt32LE(end + 16);
  for (let i = 0; i < count; i++) {
    assert.equal(archive.readUInt32LE(offset), 0x02014b50, `目录 ${i} 损坏`);
    const flags = archive.readUInt16LE(offset + 8), method = archive.readUInt16LE(offset + 10), crc = archive.readUInt32LE(offset + 16);
    const compressedSize = archive.readUInt32LE(offset + 20), size = archive.readUInt32LE(offset + 24);
    const nameLength = archive.readUInt16LE(offset + 28), extraLength = archive.readUInt16LE(offset + 30), commentLength = archive.readUInt16LE(offset + 32);
    const localOffset = archive.readUInt32LE(offset + 42), nameBytes = archive.subarray(offset + 46, offset + 46 + nameLength);
    const name = nameBytes.toString('utf8');
    assert.equal(flags & 0x0800, 0x0800, `${name} 未使用 UTF-8 标志`); assert.deepEqual(Buffer.from(name, 'utf8'), nameBytes, `${name} 不是有效 UTF-8`);
    assert.equal(archive.readUInt32LE(localOffset), 0x04034b50, `${name} 的本地头损坏`);
    const start = localOffset + 30 + archive.readUInt16LE(localOffset + 26) + archive.readUInt16LE(localOffset + 28);
    const payload = archive.subarray(start, start + compressedSize), data = method === 8 ? inflateRawSync(payload) : payload;
    assert.ok(method === 0 || method === 8, `${name} 使用未知压缩方式`); assert.equal(data.length, size, `${name} 长度不符`);
    assert.equal(crc32(data), crc, `${name} CRC 不符`); entries.set(name, data);
    offset += 46 + nameLength + extraLength + commentLength;
  }
  assert.equal(entries.size, count, 'ZIP 存在重复条目'); return entries;
}
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
try {
  await writeFile(temporary, makeZip());
  const archive = await readFile(temporary), entries = readZip(archive);
  assert.equal(entries.size, files.length, 'ZIP 条目数量不符');
  for (const [file, data] of sources) assert.deepEqual(entries.get(`${rootName}/${file}`), data, `${file} 解压内容不一致`);
  assert.ok(entries.has('汴水虹市/README.md') && entries.has('汴水虹市/src/environment.js') && entries.has('汴水虹市/artifacts/验收说明.md'));
  await rename(temporary, output);
  const html = sources.get('汴水虹市.html');
  const report = {
    pass: true, version: '2.0.0', archiveEntries: entries.size, zipCrcPass: true, utf8NamesPass: true, contentPass: true,
    archiveBytes: archive.length, htmlBytes: html.length, htmlSha256: hash(html), zipSha256: hash(archive)
  };
  await writeFile('artifacts/delivery-check.json', JSON.stringify(report, null, 2));
  console.log(`已生成 汴水虹市-完整项目.zip · ${entries.size} 个条目 · 中文 UTF-8、CRC 与逐文件内容校验通过`);
  console.log(`ZIP ${(archive.length / 1024 / 1024).toFixed(2)} MiB · SHA-256 ${report.zipSha256}`);
} finally { await rm(temporary, { force: true }); }
