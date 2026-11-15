// Tiny static server for local play-testing: serves game/ at :8080.
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), 'game');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg' };

createServer((req, res) => {
  const url = decodeURIComponent((req.url || '/').split('?')[0]);
  const path = join(root, url === '/' ? 'index.html' : url);
  if (!path.startsWith(root) || !existsSync(path)) {
    res.writeHead(404);
    res.end('not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': types[extname(path)] || 'application/octet-stream' });
  res.end(readFileSync(path));
}).listen(8080, () => console.log('DUSTLINE at http://localhost:8080'));
