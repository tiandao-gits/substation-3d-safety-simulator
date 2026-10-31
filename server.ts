import { stat } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { extname, resolve, sep } from 'node:path';

const DIST_DIR = resolve(import.meta.dir, 'dist');
const INDEX_FILE = resolve(DIST_DIR, 'index.html');
const DEFAULT_PORT = 3000;

const MIME_TYPES: Record<string, string> = {
  '.css': 'text/css; charset=utf-8',
  '.fbx': 'application/octet-stream',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.wasm': 'application/wasm',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const port = Number(Bun.env.PORT ?? DEFAULT_PORT);
if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  console.error(`[server] Invalid PORT: ${Bun.env.PORT}`);
  process.exit(1);
}

const hostname = Bun.env.HOST ?? '0.0.0.0';

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

/** Resolve a URL pathname inside dist/, or null when it escapes the directory. */
function resolveRequestPath(pathname: string): string | null {
  let decoded: string;

  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  const target = resolve(DIST_DIR, `.${decoded}`);
  const rootPrefix = DIST_DIR.endsWith(sep) ? DIST_DIR : `${DIST_DIR}${sep}`;

  if (target !== DIST_DIR && !target.startsWith(rootPrefix)) {
    return null;
  }

  return target;
}

function cacheControlFor(pathname: string): string {
  if (
    pathname.startsWith('/assets/') ||
    pathname.startsWith('/fonts/') ||
    pathname.startsWith('/draco/')
  ) {
    return 'public, max-age=31536000, immutable';
  }
  if (pathname === '/' || pathname.endsWith('.html')) return 'no-cache';
  if (/\.(?:glb|gltf|fbx|webp|png|jpe?g|gif|mp3|ogg|woff2?)$/i.test(pathname)) {
    return 'public, max-age=300, stale-while-revalidate=86400';
  }
  return 'no-cache';
}

const COMPRESSIBLE = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.map',
  '.svg',
  '.txt',
]);

const gzipCache = new Map<
  string,
  { mtimeMs: number; body: ArrayBuffer }
>();

function makeEtag(size: number, mtimeMs: number): string {
  return `W/"${size.toString(16)}-${Math.floor(mtimeMs).toString(16)}"`;
}

function isNotModified(
  request: Request,
  etag: string,
  mtimeMs: number
): boolean {
  const ifNoneMatch = request.headers.get('if-none-match');
  if (ifNoneMatch) {
    return ifNoneMatch
      .split(',')
      .map((value) => value.trim())
      .includes(etag);
  }
  const ifModifiedSince = request.headers.get('if-modified-since');
  if (ifModifiedSince) {
    const since = Date.parse(ifModifiedSince);
    return Number.isFinite(since) && since >= Math.floor(mtimeMs / 1000) * 1000;
  }
  return false;
}

async function serveFile(
  path: string,
  request: Request,
  cacheControl: string
): Promise<Response> {
  const info = await stat(path);
  const contentType =
    MIME_TYPES[extname(path).toLowerCase()] ||
    Bun.file(path).type ||
    'application/octet-stream';
  const etag = makeEtag(info.size, info.mtimeMs);
  const headers: Record<string, string> = {
    'Cache-Control': cacheControl,
    'Content-Type': contentType,
    ETag: etag,
    'Last-Modified': new Date(info.mtimeMs).toUTCString(),
    'X-Content-Type-Options': 'nosniff',
  };

  if (isNotModified(request, etag, info.mtimeMs)) {
    return new Response(null, { status: 304, headers });
  }

  const extension = extname(path).toLowerCase();
  const acceptEncoding = request.headers.get('accept-encoding') ?? '';
  if (
    request.method !== 'HEAD' &&
    COMPRESSIBLE.has(extension) &&
    /\bgzip\b/.test(acceptEncoding)
  ) {
    let cached = gzipCache.get(path);
    if (!cached || cached.mtimeMs !== info.mtimeMs) {
      const raw = new Uint8Array(await Bun.file(path).arrayBuffer());
      const compressed = new Uint8Array(gzipSync(raw, { level: 9 }));
      cached = { mtimeMs: info.mtimeMs, body: compressed.buffer };
      gzipCache.set(path, cached);
    }
    headers['Content-Encoding'] = 'gzip';
    headers['Content-Length'] = String(cached.body.byteLength);
    headers.Vary = 'Accept-Encoding';
    return new Response(cached.body, { headers });
  }

  return new Response(request.method === 'HEAD' ? null : Bun.file(path), {
    headers,
  });
}

async function handleRequest(request: Request): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: { Allow: 'GET, HEAD' },
    });
  }

  const url = new URL(request.url);
  const filePath = resolveRequestPath(url.pathname);

  if (!filePath) {
    return new Response('Bad Request', { status: 400 });
  }

  if (await isFile(filePath)) {
    return serveFile(filePath, request, cacheControlFor(url.pathname));
  }

  // SPA fallback: extension-less paths are handled by the client-side app.
  if (extname(url.pathname) === '' && !url.pathname.startsWith('/assets/')) {
    return serveFile(INDEX_FILE, request, 'no-cache');
  }

  return new Response('Not Found', { status: 404 });
}

if (!(await isFile(INDEX_FILE))) {
  console.error('[server] dist/index.html not found. Run `bun run build` first.');
  process.exit(1);
}

const server = Bun.serve({
  port,
  hostname,
  async fetch(request) {
    try {
      return await handleRequest(request);
    } catch (error) {
      console.error('[server] Request failed:', error);
      return new Response('Internal Server Error', { status: 500 });
    }
  },
});

console.log(`[server] Serving dist/ on http://localhost:${server.port}`);
