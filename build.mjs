import { build } from 'esbuild';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

const result = await build({
  entryPoints: ['src/main.js'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2020'],
  write: false,
  legalComments: 'inline'
});
const [template, css,license] = await Promise.all([
  readFile('src/index.html', 'utf8'),
  readFile('src/style.css', 'utf8'),
  readFile('node_modules/three/LICENSE','utf8')
]);
const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const output = template.replace('/* INLINE_CSS */', () => css).replace('/* INLINE_JS */', () => js).replace('</head>', () => `<!-- Three.js license\n${license}\n-->\n</head>`);
await writeFile('汴水虹市.html', output);
await mkdir('artifacts', { recursive: true });
console.log(`已构建 汴水虹市.html · ${(Buffer.byteLength(output) / 1024 / 1024).toFixed(2)} MiB · 所有资源已内嵌`);
