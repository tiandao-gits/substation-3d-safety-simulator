import { spawn } from 'node:child_process';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('.', import.meta.url)));
const INDEX_FILE = resolve(ROOT, 'index.html');
const HOST = process.env.HOST || '0.0.0.0';
const AUTO_OPEN = !process.argv.includes('--no-open') && process.env.NO_OPEN !== '1';

const MIME_TYPES = {
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

let basePort = 3000;
const rawPort = process.env.PORT;
if (rawPort != null && rawPort !== '') {
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    console.error(`[server] PORT 无效: ${rawPort}`);
    process.exit(1);
  }
  basePort = port;
}
const fixedPort = rawPort != null && rawPort !== '';

function cacheControlFor(pathname) {
  if (
    pathname.startsWith('/assets/') ||
    pathname.startsWith('/fonts/') ||
    pathname.startsWith('/draco/')
  ) {
    return 'public, max-age=31536000, immutable';
  }
  if (pathname === '/' || pathname.endsWith('.html')) return 'no-cache';
  // 场景 GLB 的传输分片/清单没有内容哈希，不能 immutable，也不能 no-cache：
  // 用可重验证的短缓存，过期后浏览器只发条件请求，命中 304 就不会再传 12MB。
  if (
    /\.(?:glb|gltf|fbx|webp|png|jpe?g|gif|mp3|ogg|woff2?)$/i.test(pathname) ||
    /\.glb\.parts\.json$/i.test(pathname) ||
    /\.glb\.part\d+$/i.test(pathname)
  ) {
    return 'public, max-age=300, stale-while-revalidate=86400';
  }
  return 'no-cache';
}

function resolveRequestPath(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }

  const target = resolve(ROOT, `.${decoded}`);
  const rootPrefix = ROOT.endsWith(sep) ? ROOT : `${ROOT}${sep}`;
  if (target !== ROOT && !target.startsWith(rootPrefix)) return null;
  return target;
}

async function isFile(path) {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

function makeEtag(info) {
  return `W/"${info.size.toString(16)}-${Math.floor(info.mtimeMs).toString(16)}"`;
}

function isNotModified(req, etag, mtimeMs) {
  const ifNoneMatch = req.headers['if-none-match'];
  if (ifNoneMatch) {
    return ifNoneMatch
      .split(',')
      .some((value) => value.trim() === etag || value.trim() === '*');
  }
  const ifModifiedSince = req.headers['if-modified-since'];
  if (ifModifiedSince) {
    const since = Date.parse(ifModifiedSince);
    return Number.isFinite(since) && since >= Math.floor(mtimeMs / 1000) * 1000;
  }
  return false;
}

async function sendFile(filePath, req, res, pathname) {
  const info = await stat(filePath);
  const etag = makeEtag(info);
  const headers = {
    'Content-Type':
      MIME_TYPES[extname(filePath).toLowerCase()] || 'application/octet-stream',
    'Cache-Control': cacheControlFor(pathname),
    ETag: etag,
    'Last-Modified': info.mtime.toUTCString(),
    'X-Content-Type-Options': 'nosniff',
  };

  // 命中条件请求时返回 304，浏览器沿用本地副本，不再重传分片。
  if (isNotModified(req, etag, info.mtimeMs)) {
    res.writeHead(304, headers);
    res.end();
    return;
  }

  res.writeHead(200, { ...headers, 'Content-Length': String(info.size) });

  if (req.method === 'HEAD') {
    res.end();
    return;
  }

  const stream = createReadStream(filePath);
  stream.on('error', () => res.destroy());
  stream.pipe(res);
}

async function handleRequest(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { Allow: 'GET, HEAD', 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Method Not Allowed');
    return;
  }

  const url = new URL(req.url ?? '/', 'http://localhost');
  const filePath = resolveRequestPath(url.pathname);

  if (!filePath) {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bad Request');
    return;
  }

  if (await isFile(filePath)) {
    await sendFile(filePath, req, res, url.pathname);
    return;
  }

  if (extname(url.pathname) === '' && !url.pathname.startsWith('/assets/')) {
    await sendFile(INDEX_FILE, req, res, '/index.html');
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not Found');
}

function openBrowser(url) {
  const [command, args] =
    process.platform === 'win32'
      ? ['cmd', ['/c', 'start', '', url]]
      : process.platform === 'darwin'
        ? ['open', [url]]
        : ['xdg-open', [url]];
  try {
    spawn(command, args, { detached: true, stdio: 'ignore' }).unref();
  } catch {
    // 打开浏览器失败不影响服务本身
  }
}

function listen(port, attempts = 0) {
  const server = createServer((req, res) => {
    handleRequest(req, res).catch((error) => {
      console.error('[server] 请求处理失败:', error);
      if (!res.headersSent) res.writeHead(500);
      res.end('Internal Server Error');
    });
  });

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE' && !fixedPort && attempts < 10) {
      listen(port + 1, attempts + 1);
      return;
    }
    if (error.code === 'EADDRINUSE') {
      console.error(`[server] 端口 ${port} 已被占用，请关闭占用该端口的程序后重试。`);
    } else {
      console.error('[server] 启动失败:', error);
    }
    process.exit(1);
  });

  server.listen(port, HOST, () => {
    const url = `http://localhost:${port}/`;
    console.log('');
    console.log('  变电站安全操作 3D 虚拟培训系统');
    console.log(`  服务地址: ${url}`);
    console.log('  关闭本窗口即可停止服务。');
    console.log('');
    if (AUTO_OPEN) openBrowser(url);
  });
}

if (!(await isFile(INDEX_FILE))) {
  console.error('[server] 未找到 index.html，请确认 serve.mjs 与 index.html 位于同一目录。');
  process.exit(1);
}

listen(basePort);
