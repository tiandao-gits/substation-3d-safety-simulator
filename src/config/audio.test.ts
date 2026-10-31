import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { BGM_CREDIT, BGM_TRACKS, resolveBgmKey } from './audio';

test('全场景只用 Hitman 一首 BGM', () => {
  const tracks = Object.values(BGM_TRACKS);
  assert.equal(tracks.length, 1);
  assert.equal(tracks[0].label, 'Hitman');
  assert.equal(new Set(tracks.map((t) => t.src)).size, 1);
});

test('BGM files exist in public assets', () => {
  for (const track of Object.values(BGM_TRACKS)) {
    const path = fileURLToPath(
      new URL(`../../public${track.src}`, import.meta.url)
    );
    assert.ok(existsSync(path), `${track.key} BGM missing: ${path}`);
  }
});

test('BGM volumes stay below foreground SFX', () => {
  for (const track of Object.values(BGM_TRACKS)) {
    assert.ok(track.volume > 0 && track.volume <= 0.3, track.key);
  }
  assert.match(BGM_CREDIT, /chosic\.com/);
});

test('剧情各阶段共用同一首，标题与结算页静音', () => {
  for (const phase of [
    'prologue',
    'section-card',
    'act1',
    'act-failed',
    'ending-vn',
  ] as const) {
    assert.equal(resolveBgmKey('playing', phase), 'hitman', phase);
  }
  assert.equal(resolveBgmKey('playing', 'ending-stub'), null);
  assert.equal(resolveBgmKey('playing', 'title'), null);
  assert.equal(resolveBgmKey('paused', 'act1'), 'hitman');
  assert.equal(resolveBgmKey('title', 'prologue'), null);
});
