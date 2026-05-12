import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';

const root = resolve('.');
const port = Number(process.env.PORT) || 3000;

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function contentType(filePath) {
  return mimeTypes[extname(filePath).toLowerCase()] || 'application/octet-stream';
}

async function serveFile(pathname, res) {
  const filePath = join(root, pathname === '/' ? 'index.html' : pathname.slice(1));
  try {
    const body = await readFile(filePath);
    res.writeHead(200, { 'content-type': contentType(filePath) });
    res.end(body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  if (url.pathname === '/health') {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  void serveFile(url.pathname, res);
});

server.listen(port, () => {
  console.log(`Open http://localhost:${port}`);
});
