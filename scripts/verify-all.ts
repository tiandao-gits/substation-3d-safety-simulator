import { writeFileSync } from 'node:fs';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const profile = `.tmp/chrome-verify-${Date.now()}`;
  const chrome = Bun.spawn({
    cmd: [
      CHROME,
      '--headless=new',
      '--remote-debugging-port=0',
      `--user-data-dir=${process.cwd()}/${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--hide-scrollbars',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      'about:blank',
    ],
    stderr: 'pipe',
    stdout: 'ignore',
  });

  const reader = (chrome.stderr as ReadableStream<Uint8Array>).getReader();
  const dec = new TextDecoder();
  let wsUrl = '';
  let buf = '';
  const t0 = Date.now();
  while (Date.now() - t0 < 30000) {
    const { value } = await Promise.race([reader.read(), sleep(400).then(() => ({ value: undefined }))]);
    if (value) buf += dec.decode(value, { stream: true });
    const m = buf.match(/DevTools listening on (ws:\/\/\S+)/);
    if (m) {
      wsUrl = m[1];
      break;
    }
  }
  if (!wsUrl) throw new Error('No devtools URL');

  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', rej, { once: true });
  });

  let nextId = 1;
  const pending = new Map<number, (v: any) => void>();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(String(ev.data));
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id)!(msg);
      pending.delete(msg.id);
    }
  };

  const send = (method: string, params: Record<string, unknown> = {}, sid?: string) => {
    const id = nextId++;
    return new Promise<any>((resolve, reject) => {
      pending.set(id, (msg: any) => {
        if (msg.error) reject(new Error(`${method}: ${JSON.stringify(msg.error)}`));
        else resolve(msg.result);
      });
      ws.send(JSON.stringify({ id, method, params, ...(sid ? { sessionId: sid } : {}) }));
    });
  };

  try {
    const target = await send('Target.createTarget', { url: 'about:blank' });
    const sid = (await send('Target.attachToTarget', { targetId: target.targetId, flatten: true })).sessionId;

    await send('Page.enable', {}, sid);
    await send('Runtime.enable', {}, sid);
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false }, sid);

    // -------------------------------------------------------------
    // Part 1: Prologue flow (Line 1 Chen, Desk zoom, Line 2 Lu Chuan)
    // -------------------------------------------------------------
    console.log('Navigating to http://localhost:3000/?qa=prologue');
    await send('Page.navigate', { url: 'http://localhost:3000/?qa=prologue' }, sid);

    // Wait until all images are fully loaded
    const start = Date.now();
    while (Date.now() - start < 30000) {
      await sleep(1000);
      const evalRes = await send('Runtime.evaluate', {
        expression: `(() => {
          const imgs = Array.from(document.querySelectorAll('img'));
          return {
            total: imgs.length,
            loaded: imgs.filter(i => i.complete && i.naturalWidth > 0).length,
            hasDesk: document.body.innerText.includes('办公室视角')
          };
        })()`,
        returnByValue: true,
      }, sid);
      const state = evalRes.result?.value;
      if (state?.hasDesk && state?.total >= 5 && state?.loaded === state?.total) {
        console.log(`Images loaded: ${state.loaded}/${state.total}`);
        break;
      }
    }
    await sleep(1000);

    // 1. Line 1: Chen speaking
    let shot = await send('Page.captureScreenshot', { format: 'png' }, sid);
    writeFileSync('C:/Users/Administrator/.gemini/antigravity/brain/bcdd6d5e-7fd0-48ab-b854-cd0218745fbd/story-fixes-line1-chen.png', Buffer.from(shot.data, 'base64'));
    console.log('Saved story-fixes-line1-chen.png');

    // 2. Click desk view thumbnail to open large modal
    await send('Runtime.evaluate', {
      expression: `(() => {
        const thumb = document.querySelector('[title="点击查看大图"]');
        if (thumb) thumb.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      })()`,
      returnByValue: true,
    }, sid);
    await sleep(1000);

    shot = await send('Page.captureScreenshot', { format: 'png' }, sid);
    writeFileSync('C:/Users/Administrator/.gemini/antigravity/brain/bcdd6d5e-7fd0-48ab-b854-cd0218745fbd/story-fixes-desk-zoomed.png', Buffer.from(shot.data, 'base64'));
    console.log('Saved story-fixes-desk-zoomed.png');

    // 3. Press Escape to close modal
    await send('Runtime.evaluate', {
      expression: `window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`,
      returnByValue: true,
    }, sid);
    await sleep(600);

    // 4. Advance to Line 2: Lu Chuan speaking ("收到。")
    // Advance by clicking dialogue box with MouseEvent
    await send('Runtime.evaluate', {
      expression: `(() => {
        const dlg = document.querySelector('[aria-label="对话"]');
        if (dlg) dlg.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      })()`,
      returnByValue: true,
    }, sid);
    await sleep(1500);

    shot = await send('Page.captureScreenshot', { format: 'png' }, sid);
    writeFileSync('C:/Users/Administrator/.gemini/antigravity/brain/bcdd6d5e-7fd0-48ab-b854-cd0218745fbd/story-fixes-line2-luchuan.png', Buffer.from(shot.data, 'base64'));
    console.log('Saved story-fixes-line2-luchuan.png');

    // -------------------------------------------------------------
    // Part 2: Choice Dialog (Mock mode) to verify option wrapping fix
    // -------------------------------------------------------------
    console.log('Navigating to http://localhost:3000/?qa=mock');
    await send('Page.navigate', { url: 'http://localhost:3000/?qa=mock' }, sid);
    await sleep(2500);

    shot = await send('Page.captureScreenshot', { format: 'png' }, sid);
    writeFileSync('C:/Users/Administrator/.gemini/antigravity/brain/bcdd6d5e-7fd0-48ab-b854-cd0218745fbd/story-fixes-choice-dialog.png', Buffer.from(shot.data, 'base64'));
    console.log('Saved story-fixes-choice-dialog.png');

    console.log('All 4 verification screenshots saved!');
  } finally {
    chrome.kill();
  }
}

await main();
