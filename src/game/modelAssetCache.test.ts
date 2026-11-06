import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearMemoryModelCacheForTest,
  computeAssetHeaderFingerprint,
  computeGlbManifestFingerprint,
  fetchBinaryWithRetry,
  fetchModelAssetWithCache,
  getCachedModelBuffer,
  setCachedModelBuffer,
  type FetchLike,
} from './modelAssetCache';

test('computeGlbManifestFingerprint produces stable fingerprint and changes when manifest changes', () => {
  const m1 = {
    source: 'substation_blockout.glb',
    totalBytes: 24866968,
    partBytes: 12433484,
    partCount: 2,
    parts: ['substation_blockout.glb.part0', 'substation_blockout.glb.part1'],
  };
  const m2 = { ...m1 };
  const mChanged = { ...m1, totalBytes: 24866999 };

  assert.equal(
    computeGlbManifestFingerprint(m1),
    computeGlbManifestFingerprint(m2)
  );
  assert.notEqual(
    computeGlbManifestFingerprint(m1),
    computeGlbManifestFingerprint(mChanged)
  );
});

test('getCachedModelBuffer hits when fingerprint and byteLength match and misses when file changes', async () => {
  clearMemoryModelCacheForTest();
  const payload = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).buffer;
  await setCachedModelBuffer('glb:test', 'fp-v1', payload);

  const hit = await getCachedModelBuffer('glb:test', 'fp-v1', 8);
  assert.ok(hit);
  assert.equal(hit.byteLength, 8);

  const missWrongFp = await getCachedModelBuffer('glb:test', 'fp-v2', 8);
  assert.equal(missWrongFp, null);

  const missWrongSize = await getCachedModelBuffer('glb:test', 'fp-v1', 16);
  assert.equal(missWrongSize, null);
});

test('fetchBinaryWithRetry recovers from transient TypeError: network error', async () => {
  let calls = 0;
  const expected = new Uint8Array([10, 20, 30, 40]);

  const fakeFetch: FetchLike = async () => {
    calls++;
    if (calls < 3) {
      throw new TypeError('network error');
    }
    return new Response(expected.buffer.slice(0), {
      status: 200,
      headers: {
        etag: '"v1"',
        'content-length': '4',
      },
    });
  };

  const { buffer, fingerprint } = await fetchBinaryWithRetry(
    'https://example.local/substation.part0',
    {
      retries: 3,
      baseDelayMs: 5,
      expectedBytes: 4,
      fetchImpl: fakeFetch,
    }
  );

  assert.equal(calls, 3);
  assert.equal(buffer.byteLength, 4);
  assert.equal(
    fingerprint,
    computeAssetHeaderFingerprint(
      new Headers({ etag: '"v1"', 'content-length': '4' }),
      4
    )
  );
});

test('fetchModelAssetWithCache downloads once and reuses cache on subsequent loads', async () => {
  clearMemoryModelCacheForTest();
  let networkDownloads = 0;
  const raw = new Uint8Array([9, 8, 7, 6, 5, 4]);

  const fakeFetch: FetchLike = async (_input, init) => {
    if (init?.method === 'HEAD') {
      return new Response(null, {
        status: 200,
        headers: { etag: '"role-v1"', 'content-length': '6' },
      });
    }
    networkDownloads++;
    return new Response(raw.buffer.slice(0), {
      status: 200,
      headers: { etag: '"role-v1"', 'content-length': '6' },
    });
  };

  const first = await fetchModelAssetWithCache('/assets/roles/Ch17_nonPBR.fbx', {
    expectedBytes: 6,
    fetchImpl: fakeFetch,
  });
  const second = await fetchModelAssetWithCache('/assets/roles/Ch17_nonPBR.fbx', {
    expectedBytes: 6,
    fetchImpl: fakeFetch,
  });

  assert.equal(networkDownloads, 1);
  assert.equal(first.byteLength, 6);
  assert.equal(second.byteLength, 6);
});
