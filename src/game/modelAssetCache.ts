/**
 * 3D 模型资产持久化缓存与断点重试加载器（支持 GLB 分片模型与 FBX 角色/动画模型）。
 *
 * 设计目标：
 * 1. 双层缓存（内存 Map + 浏览器 Cache Storage API / IndexedDB 持久化）：
 *    只要服务端模型文件指纹（Manifest 声明、ETag、Last-Modified 或字节长度）未发生变化，
 *    刷新页面或重新进入场景时直接从本地缓存读取 ArrayBuffer，无需重复下载数十 MB 的模型文件。
 * 2. 网络容错与自动重试：
 *    针对大体积二进制分片在代理/弱网下偶发的 `TypeError: network error`，内置指数退避重试与分片级独立缓存。
 */

export interface GlbPartsManifest {
  source: string;
  totalBytes: number;
  partBytes: number;
  partCount: number;
  parts: string[];
}

export interface CachedAssetRecord {
  fingerprint: string;
  byteLength: number;
  buffer: ArrayBuffer;
}

export type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit
) => Promise<Response>;

const CACHE_STORAGE_NAME = 'substation-3d-model-cache-v1';
const IDB_DB_NAME = 'substation-3d-model-idb-v1';
const IDB_STORE_NAME = 'assets';

/** 进程内一级内存缓存，保证同会话零延迟命中。 */
const memoryCache = new Map<string, CachedAssetRecord>();

/**
 * 为 GLB 分片清单生成确定性指纹。只要分片名、总字节数或分片大小任一变化，指纹即自动更新。
 */
export function computeGlbManifestFingerprint(manifest: GlbPartsManifest): string {
  return `${manifest.source}|total:${manifest.totalBytes}|part:${manifest.partBytes}|count:${manifest.partCount}|parts:${manifest.parts.join(',')}`;
}

/**
 * 根据 HTTP 响应头（ETag / Last-Modified / Content-Length）与预期大小生成单文件版本指纹。
 */
export function computeAssetHeaderFingerprint(
  headers: { get(name: string): string | null } | null | undefined,
  fallbackBytes = 0
): string {
  if (!headers) {
    return `bytes:${fallbackBytes}`;
  }
  const etag = headers.get('etag')?.trim() || '';
  const lastModified = headers.get('last-modified')?.trim() || '';
  const contentLength = headers.get('content-length')?.trim() || '';
  if (etag || lastModified || contentLength) {
    return `etag:${etag}|lm:${lastModified}|len:${contentLength || fallbackBytes}`;
  }
  return `bytes:${fallbackBytes}`;
}

/**
 * 判断缓存记录是否与当前文件指纹及预期字节数匹配。
 */
export function isCachedAssetValid(
  record: CachedAssetRecord | null | undefined,
  expectedFingerprint: string,
  expectedBytes?: number
): boolean {
  if (!record || !record.buffer || record.buffer.byteLength === 0) {
    return false;
  }
  if (
    typeof expectedBytes === 'number' &&
    expectedBytes > 0 &&
    record.buffer.byteLength !== expectedBytes
  ) {
    return false;
  }
  if (!expectedFingerprint) {
    return true;
  }
  return record.fingerprint === expectedFingerprint;
}

function toCacheUrl(cacheKey: string): string {
  const encoded = encodeURIComponent(cacheKey);
  const origin =
    typeof window !== 'undefined' &&
    window.location?.origin &&
    window.location.origin !== 'null'
      ? window.location.origin
      : 'https://substation-cache.local';
  return `${origin}/__model_asset_cache__/${encoded}`;
}

async function readFromCacheStorage(
  cacheKey: string
): Promise<CachedAssetRecord | null> {
  if (typeof window === 'undefined' || !('caches' in window)) {
    return null;
  }
  try {
    const cache = await window.caches.open(CACHE_STORAGE_NAME);
    const response = await cache.match(toCacheUrl(cacheKey));
    if (!response) return null;
    const fingerprint = response.headers.get('x-asset-fingerprint') || '';
    const buffer = await response.arrayBuffer();
    if (!buffer || buffer.byteLength === 0) return null;
    return {
      fingerprint,
      byteLength: buffer.byteLength,
      buffer,
    };
  } catch {
    return null;
  }
}

async function writeToCacheStorage(
  cacheKey: string,
  record: CachedAssetRecord
): Promise<boolean> {
  if (typeof window === 'undefined' || !('caches' in window)) {
    return false;
  }
  try {
    const cache = await window.caches.open(CACHE_STORAGE_NAME);
    const headers = new Headers({
      'Content-Type': 'application/octet-stream',
      'Content-Length': String(record.buffer.byteLength),
      'x-asset-fingerprint': record.fingerprint,
    });
    await cache.put(
      toCacheUrl(cacheKey),
      new Response(record.buffer.slice(0), { headers })
    );
    return true;
  } catch {
    return false;
  }
}

function openIndexedDb(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !('indexedDB' in window)) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const req = window.indexedDB.open(IDB_DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
          db.createObjectStore(IDB_STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

async function readFromIndexedDb(
  cacheKey: string
): Promise<CachedAssetRecord | null> {
  const db = await openIndexedDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE_NAME, 'readonly');
      const store = tx.objectStore(IDB_STORE_NAME);
      const getReq = store.get(cacheKey);
      getReq.onsuccess = () => {
        const val = getReq.result as CachedAssetRecord | undefined;
        db.close();
        if (val && val.buffer instanceof ArrayBuffer && val.buffer.byteLength > 0) {
          resolve(val);
        } else {
          resolve(null);
        }
      };
      getReq.onerror = () => {
        db.close();
        resolve(null);
      };
    } catch {
      db.close();
      resolve(null);
    }
  });
}

async function writeToIndexedDb(
  cacheKey: string,
  record: CachedAssetRecord
): Promise<void> {
  const db = await openIndexedDb();
  if (!db) return;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE_NAME, 'readwrite');
      const store = tx.objectStore(IDB_STORE_NAME);
      store.put(record, cacheKey);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    } catch {
      db.close();
      resolve();
    }
  });
}

/**
 * 从内存或持久化存储读取模型缓存。
 */
export async function getCachedModelBuffer(
  cacheKey: string,
  expectedFingerprint: string,
  expectedBytes?: number
): Promise<ArrayBuffer | null> {
  const mem = memoryCache.get(cacheKey);
  if (isCachedAssetValid(mem, expectedFingerprint, expectedBytes)) {
    return mem!.buffer;
  }

  const disk =
    (await readFromCacheStorage(cacheKey)) ??
    (await readFromIndexedDb(cacheKey));
  if (isCachedAssetValid(disk, expectedFingerprint, expectedBytes)) {
    memoryCache.set(cacheKey, disk!);
    return disk!.buffer;
  }
  return null;
}

/**
 * 将模型二进制数据写入内存与持久化缓存（Cache Storage + IndexedDB 兜底）。
 */
export async function setCachedModelBuffer(
  cacheKey: string,
  fingerprint: string,
  buffer: ArrayBuffer
): Promise<void> {
  if (!buffer || buffer.byteLength === 0) return;
  const record: CachedAssetRecord = {
    fingerprint,
    byteLength: buffer.byteLength,
    buffer,
  };
  memoryCache.set(cacheKey, record);
  const storedInCacheApi = await writeToCacheStorage(cacheKey, record);
  if (!storedInCacheApi) {
    await writeToIndexedDb(cacheKey, record);
  }
}

export function clearMemoryModelCacheForTest(): void {
  memoryCache.clear();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 带指数退避重试的二进制流下载函数，解决偶发 `TypeError: network error` 导致场景加载失败的问题。
 */
export async function fetchBinaryWithRetry(
  url: string,
  options: {
    retries?: number;
    baseDelayMs?: number;
    expectedBytes?: number;
    onChunkBytes?: (deltaBytes: number) => void;
    fetchImpl?: FetchLike;
  } = {}
): Promise<{ buffer: ArrayBuffer; fingerprint: string }> {
  const retries = options.retries ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 280;
  const fetchFn: FetchLike = options.fetchImpl ?? fetch;
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    let attemptBytesReported = 0;
    try {
      const response = await fetchFn(url, {
        cache: 'default',
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} (${url})`);
      }
      const fingerprint = computeAssetHeaderFingerprint(
        response.headers,
        options.expectedBytes ?? 0
      );

      if (!response.body || attempt > 0) {
        // 若流式读取在上一轮中断过，重试时直接走整块 arrayBuffer() 提升稳定性
        const whole = await response.arrayBuffer();
        if (
          options.expectedBytes &&
          options.expectedBytes > 0 &&
          whole.byteLength !== options.expectedBytes
        ) {
          throw new Error(
            `文件字节长度不完整（收到 ${whole.byteLength}，预期 ${options.expectedBytes}）：${url}`
          );
        }
        const delta = whole.byteLength - attemptBytesReported;
        if (delta > 0) {
          attemptBytesReported += delta;
          options.onChunkBytes?.(delta);
        }
        return { buffer: whole, fingerprint };
      }

      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let totalSize = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value || value.byteLength === 0) continue;
        chunks.push(value);
        totalSize += value.byteLength;
        attemptBytesReported += value.byteLength;
        options.onChunkBytes?.(value.byteLength);
      }

      if (
        options.expectedBytes &&
        options.expectedBytes > 0 &&
        totalSize !== options.expectedBytes
      ) {
        throw new Error(
          `分片流读取长度不完整（收到 ${totalSize}，预期 ${options.expectedBytes}）：${url}`
        );
      }

      const merged = new Uint8Array(totalSize);
      let offset = 0;
      for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.byteLength;
      }
      return { buffer: merged.buffer, fingerprint };
    } catch (err) {
      lastError = err;
      // 回滚本轮失败尝试已累加的字节进度，防止进度条虚高
      if (attemptBytesReported > 0) {
        options.onChunkBytes?.(-attemptBytesReported);
      }
      if (attempt < retries) {
        await sleep(baseDelayMs * Math.pow(2, attempt));
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`网络请求失败：${url}`);
}

/**
 * 获取带版本指纹校验与持久化缓存的单文件二进制模型（如 FBX 角色与动作文件）。
 * - 先检查本地缓存是否存在；
 * - 若存在，通过轻量级 HEAD 请求比对服务端 ETag/Last-Modified/Content-Length 指纹；
 * - 若文件未变化，直接返回本地缓存 ArrayBuffer，不重下模型主体；
 * - 若文件已更新或首次加载，带重试下载并更新缓存。
 */
export async function fetchModelAssetWithCache(
  url: string,
  options: {
    expectedBytes?: number;
    onProgress?: (loadedBytes: number, totalBytes: number) => void;
    fetchImpl?: FetchLike;
  } = {}
): Promise<ArrayBuffer> {
  const encodedUrl = encodeURI(url);
  const cacheKey = `model:${encodedUrl}`;
  const fetchFn: FetchLike = options.fetchImpl ?? fetch;
  const fallbackTotal = options.expectedBytes ?? 0;

  // 1. 同一会话内如果已经有内存缓存，直接命中，连 HEAD 都不需要再发
  const memRecord = memoryCache.get(cacheKey);
  if (memRecord && memRecord.buffer.byteLength > 0) {
    options.onProgress?.(memRecord.buffer.byteLength, memRecord.buffer.byteLength);
    return memRecord.buffer;
  }

  // 2. 检查持久化缓存中是否有之前存下的记录
  const diskRecord =
    (await readFromCacheStorage(cacheKey)) ??
    (await readFromIndexedDb(cacheKey));

  if (diskRecord && diskRecord.buffer.byteLength > 0) {
    try {
      const headRes = await fetchFn(encodedUrl, {
        method: 'HEAD',
        cache: 'no-cache',
      });
      if (headRes.ok) {
        const remoteFingerprint = computeAssetHeaderFingerprint(
          headRes.headers,
          fallbackTotal
        );
        const contentLenHeader = Number(headRes.headers.get('content-length') || 0);
        const expectedLen = contentLenHeader > 0 ? contentLenHeader : undefined;
        if (isCachedAssetValid(diskRecord, remoteFingerprint, expectedLen)) {
          memoryCache.set(cacheKey, diskRecord);
          options.onProgress?.(
            diskRecord.buffer.byteLength,
            diskRecord.buffer.byteLength
          );
          return diskRecord.buffer;
        }
      } else {
        if (
          fallbackTotal > 0 &&
          diskRecord.buffer.byteLength === fallbackTotal
        ) {
          memoryCache.set(cacheKey, diskRecord);
          options.onProgress?.(
            diskRecord.buffer.byteLength,
            diskRecord.buffer.byteLength
          );
          return diskRecord.buffer;
        }
      }
    } catch {
      // 网络波动时若本地已有完整缓存，直接回退使用本地缓存，避免报错中断
      memoryCache.set(cacheKey, diskRecord);
      options.onProgress?.(
        diskRecord.buffer.byteLength,
        diskRecord.buffer.byteLength
      );
      return diskRecord.buffer;
    }
  }

  // 3. 本地无缓存或服务端文件已更新：执行带重试的流式下载并写入缓存
  let loaded = 0;
  const { buffer, fingerprint } = await fetchBinaryWithRetry(encodedUrl, {
    retries: 3,
    expectedBytes: undefined,
    fetchImpl: fetchFn,
    onChunkBytes: (delta) => {
      loaded = Math.max(0, loaded + delta);
      const total = Math.max(fallbackTotal, loaded);
      options.onProgress?.(loaded, total);
    },
  });

  await setCachedModelBuffer(cacheKey, fingerprint, buffer);
  options.onProgress?.(buffer.byteLength, buffer.byteLength);
  return buffer;
}

/**
 * 供角色/动画 FBX 加载器调用的缓存获取入口。
 */
export async function fetchCachedBinaryAsset(
  url: string,
  expectedBytes = 0,
  onProgress?: (loadedBytes: number, totalBytes: number) => void
): Promise<ArrayBuffer> {
  return fetchModelAssetWithCache(url, {
    expectedBytes,
    onProgress,
  });
}

/**
 * 供变电站 GLB 分片加载器调用的持久化缓存 + 断点重试获取入口。
 * - 只要 `.parts.json` 清单指纹与总字节数未变，直接命中本地缓存（Cache Storage / IndexedDB / 内存）返回完整 ArrayBuffer，0 网络流量；
 * - 若未命中或模型已更新，按分片独立缓存 + 指数退避重试下载，解决偶发 `TypeError: network error`。
 */
export async function fetchCachedGlbParts(
  assetBaseUrl: string,
  fileName: string,
  manifestSuffix: string,
  onProgress?: (loadedBytes: number, totalBytes: number) => void
): Promise<ArrayBuffer> {
  const manifestUrl = `${assetBaseUrl}${fileName}${manifestSuffix}`;
  let manifestResponse: Response | null = null;
  let lastManifestErr: unknown = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      manifestResponse = await fetch(manifestUrl, { cache: 'no-cache' });
      if (manifestResponse.ok) break;
      lastManifestErr = new Error(
        `GLB 分片清单读不到（HTTP ${manifestResponse.status}）：${manifestUrl}`
      );
    } catch (err) {
      lastManifestErr = err;
      if (attempt < 2) {
        await sleep(250 * Math.pow(2, attempt));
      }
    }
  }

  if (!manifestResponse || !manifestResponse.ok) {
    throw lastManifestErr instanceof Error
      ? lastManifestErr
      : new Error(`GLB 分片清单读不到：${manifestUrl}`);
  }

  const manifest = (await manifestResponse.json()) as GlbPartsManifest;
  if (!manifest || !Array.isArray(manifest.parts) || manifest.parts.length === 0) {
    throw new Error(`GLB 分片清单格式不对：${manifestUrl}`);
  }

  const totalBytes = manifest.totalBytes;
  const fingerprint = computeGlbManifestFingerprint(manifest);
  const fullGlbCacheKey = `glb:${assetBaseUrl}${fileName}`;

  // 1. 优先检查整包 GLB 缓存：只要清单指纹与总字节数未变，直接命中缓存跳过下载
  const cachedFullBuffer = await getCachedModelBuffer(
    fullGlbCacheKey,
    fingerprint,
    totalBytes
  );
  if (cachedFullBuffer) {
    onProgress?.(totalBytes, totalBytes);
    return cachedFullBuffer;
  }

  let loadedBytes = 0;
  const progressStep = Math.max(1, Math.floor(totalBytes / 100));
  let nextReport = progressStep;

  const reportChunkDelta = (delta: number) => {
    loadedBytes = Math.max(0, Math.min(totalBytes, loadedBytes + delta));
    if (loadedBytes >= nextReport || loadedBytes === totalBytes) {
      nextReport = loadedBytes + progressStep;
      onProgress?.(loadedBytes, totalBytes);
    }
  };

  // 2. 分片级独立缓存 + 指数退避重试下载
  const partBuffers = await Promise.all(
    manifest.parts.map(async (partName, index) => {
      const partUrl = `${assetBaseUrl}${partName}`;
      const isLastPart = index === manifest.parts.length - 1;
      const expectedPartBytes = isLastPart
        ? totalBytes - manifest.partBytes * (manifest.parts.length - 1)
        : manifest.partBytes;
      const partCacheKey = `glb-part:${partUrl}`;
      const partFingerprint = `${fingerprint}|part:${partName}:${expectedPartBytes}`;

      const cachedPart = await getCachedModelBuffer(
        partCacheKey,
        partFingerprint,
        expectedPartBytes > 0 ? expectedPartBytes : undefined
      );
      if (cachedPart) {
        reportChunkDelta(cachedPart.byteLength);
        return cachedPart;
      }

      const { buffer } = await fetchBinaryWithRetry(partUrl, {
        retries: 3,
        baseDelayMs: 300,
        expectedBytes: expectedPartBytes > 0 ? expectedPartBytes : undefined,
        onChunkBytes: reportChunkDelta,
      });

      await setCachedModelBuffer(partCacheKey, partFingerprint, buffer);
      return buffer;
    })
  );

  const assembled = new Uint8Array(totalBytes);
  let cursor = 0;
  for (const buffer of partBuffers) {
    if (cursor + buffer.byteLength > totalBytes) {
      throw new Error(
        `GLB 分片总长度超出清单声明（${cursor + buffer.byteLength} > ${totalBytes}）`
      );
    }
    assembled.set(new Uint8Array(buffer), cursor);
    cursor += buffer.byteLength;
  }
  if (cursor !== totalBytes) {
    throw new Error(`GLB 分片总长度与清单不符（${cursor} != ${totalBytes}）`);
  }

  const finalBuffer = assembled.buffer;
  await setCachedModelBuffer(fullGlbCacheKey, fingerprint, finalBuffer);
  onProgress?.(totalBytes, totalBytes);
  return finalBuffer;
}

