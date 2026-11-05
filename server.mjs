import http from 'node:http';
import { readFile } from 'node:fs/promises';
const port = Number(process.env.PORT || 4173);
const pageURL = new URL('./汴水虹市.html', import.meta.url);
const server = http.createServer(async (req, res) => {
  if (req.url === '/favicon.ico') { res.writeHead(204); res.end(); return; }
  try {
    const page = await readFile(pageURL);
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(page);
  } catch (error) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(`暂时无法读取交付 HTML：${error.message}`);
  }
});
server.on('error', error => {
  console.error(error.code === 'EADDRINUSE' ? `端口 ${port} 已被占用，可设置 PORT 环境变量后重试。` : error);
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => console.log(`汴水虹市：http://127.0.0.1:${port}（每次请求读取最新 HTML，也可直接双击作品）`));
