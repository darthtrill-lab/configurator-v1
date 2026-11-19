// Local test server: serves public/ and swaps the CDN URLs for local node_modules copies.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve('public'), NM = path.resolve('node_modules');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.svg': 'image/svg+xml' };
http.createServer((req, res) => {
  let url = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
  if (url === '/') url = '/index.html';
  const file = url.startsWith('/node_modules/') ? path.join(NM, url.slice(14)) : path.join(ROOT, url);
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    let body = buf;
    if (url === '/index.html') {
      body = buf.toString()
        .replaceAll('https://cdn.jsdelivr.net/npm/three@0.170.0/', '/node_modules/three/')
        .replaceAll('https://cdn.jsdelivr.net/npm/@pmndrs/assets@1.7.0/', '/node_modules/@pmndrs/assets/')
        .replaceAll('https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/', '/node_modules/qrcode-generator/')
        .replaceAll('https://cdn.jsdelivr.net/npm/@google/model-viewer@3.5.0/', '/node_modules/@google/model-viewer/')
        .replace(/<link rel="stylesheet" href="https:\/\/fonts[^>]*>/, '');
    }
    res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
    res.end(body);
  });
}).listen(5173, () => console.log('http://localhost:5173'));
