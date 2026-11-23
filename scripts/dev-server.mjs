// Zero-dependency static server for local development (ES modules need http://, not file://).
// Usage: npm start  → http://localhost:8080
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const PORT = Number(process.env.PORT) || 8080;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.json': 'application/json; charset=utf-8',
};

async function resolveFile(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const target = normalize(join(ROOT, decoded));
  if (target !== ROOT && !target.startsWith(ROOT + sep)) return null; // path traversal
  if (target.split(sep).some((part) => part.startsWith('.') && part.length > 1)) return null; // hidden files
  try {
    const info = await stat(target);
    return info.isDirectory() ? join(target, 'index.html') : target;
  } catch {
    return null;
  }
}

createServer(async (request, response) => {
  try {
    const file = (await resolveFile(request.url ?? '/')) ?? join(ROOT, '404.html');
    const body = await readFile(file);
    response.writeHead(file.endsWith('404.html') ? 404 : 200, {
      'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    response.end(body);
  } catch (error) {
    console.error(error);
    response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Error interno del servidor');
  }
}).listen(PORT, () => console.log(`VintoCentral: http://localhost:${PORT}`));
