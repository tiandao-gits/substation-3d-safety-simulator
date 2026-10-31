import { writeFileSync } from 'node:fs';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ARTIFACT_DIR = 'C:/Users/Administrator/.gemini/antigravity/brain/bcdd6d5e-7fd0-48ab-b854-cd0218745fbd';

async function main() {
  const port = 9500 + Math.floor(Math.random() * 300);
  const profile = `C:/Users/Administrator/.tmp-chrome-hud-${Date.now()}`;

  const chrome = Bun.spawn({
    cmd: [
      CHROME,
      '--headless=new',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${profile}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-extensions',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
      'about:blank',
    ],
    stderr: 'ignore',
    stdout: 'ignore',
  });

  let wsUrl = '';
  const t0 = Date.now();
  while (Date.now() - t0 < 20000) {
    await sleep(400);
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/version`);
      if (res.ok) {
        const data = (await res.json()) as { webSocketDebuggerUrl?: string };
        if (data.webSocketDebuggerUrl) {
          wsUrl = data.webSocketDebuggerUrl;
          break;
        }
      }
    } catch {}
  }

  if (!wsUrl) throw new Error('Chrome did not respond on debug port');
  console.log(`Connected to Chrome on port ${port}`);

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

    console.log('1. Loading roaming view with ds-contact...');
    await send('Page.navigate', { url: 'http://localhost:3000/?qa=act1&point=ds-contact' }, sid);

    // Wait until 3D scene finishes loading and dataset.state becomes playing
    const loadStart = Date.now();
    while (Date.now() - loadStart < 40000) {
      await sleep(1000);
      const check = await send('Runtime.evaluate', {
        expression: `(() => {
          return {
            playing: document.body.dataset.state === 'playing',
            hasStartBtn: Boolean(Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('开始巡检'))),
          };
        })()`,
        returnByValue: true,
      }, sid);
      const val = check.result?.value;
      if (val?.hasStartBtn) {
        console.log('Scene ready, TaskCard is open!');
        break;
      }
    }

    const snap = async (name: string) => {
      const shot = await send('Page.captureScreenshot', { format: 'png' }, sid);
      const buf = Buffer.from(shot.data, 'base64');
      writeFileSync(`${ARTIFACT_DIR}/${name}`, buf);
      console.log(`Saved ${name}`);
    };

    // Close TaskCard by clicking [开始巡检]
    await send('Runtime.evaluate', {
      expression: `(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('开始巡检'));
        if (btn) btn.click();
      })()`,
    }, sid);
    await sleep(600);

    // 1. Open ToolWorkbench with KeyF
    console.log('2. Opening ToolWorkbench via KeyF...');
    await send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'KeyF', key: 'f' }, sid);
    await send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'KeyF', key: 'f' }, sid);
    await sleep(800);
    await snap('inspection-modal-initial.png');

    // 2. Click [肉眼观察]
    console.log('3. Clicking [肉眼观察]...');
    await send('Runtime.evaluate', {
      expression: `(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('肉眼观察'));
        if (btn) btn.click();
      })()`,
    }, sid);
    await sleep(600);
    await snap('inspection-modal-visual.png');

    // 3. Click [检测] on the first hazard
    console.log('4. Clicking [检测] to open tool drawer overlay...');
    await send('Runtime.evaluate', {
      expression: `(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('检测'));
        if (btn) btn.click();
      })()`,
    }, sid);
    await sleep(600);
    await snap('inspection-modal-tool-overlay.png');

    // 4. Select thermometer tool in tool overlay
    console.log('5. Selecting thermometer tool in overlay...');
    await send('Runtime.evaluate', {
      expression: `(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('红外测温仪'));
        if (btn) btn.click();
      })()`,
    }, sid);
    await sleep(800);
    await snap('inspection-modal-reading-done.png');

    // 5. Switch to [取证处置]
    console.log('6. Switching to [取证处置]...');
    await send('Runtime.evaluate', {
      expression: `(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('取证处置'));
        if (btn) btn.click();
      })()`,
    }, sid);
    await sleep(600);
    await snap('inspection-modal-evidence.png');

    // Close workbench via X
    await send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'KeyX', key: 'x' }, sid);
    await send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'KeyX', key: 'x' }, sid);
    await sleep(500);

    // 6. Open Backpack [B]
    console.log('7. Opening Backpack [B]...');
    await send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'KeyB', key: 'b' }, sid);
    await send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'KeyB', key: 'b' }, sid);
    await sleep(600);
    await snap('modal-backpack-no-scrollbar.png');

    // Close backpack
    await send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'KeyX', key: 'x' }, sid);
    await send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'KeyX', key: 'x' }, sid);
    await sleep(500);

    // 7. Open Dossier [E]
    console.log('8. Opening Dossier [E]...');
    await send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'KeyE', key: 'e' }, sid);
    await send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'KeyE', key: 'e' }, sid);
    await sleep(600);
    await snap('modal-dossier-tabbed.png');

    // Close Dossier
    await send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'KeyX', key: 'x' }, sid);
    await send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'KeyX', key: 'x' }, sid);
    await sleep(500);

    // 8. Open Act Log [J]
    console.log('9. Opening Act Log [J]...');
    await send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'KeyJ', key: 'j' }, sid);
    await send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'KeyJ', key: 'j' }, sid);
    await sleep(600);
    await snap('modal-act-log-no-scrollbar.png');

    // Close Act Log
    await send('Input.dispatchKeyEvent', { type: 'keyDown', code: 'KeyX', key: 'x' }, sid);
    await send('Input.dispatchKeyEvent', { type: 'keyUp', code: 'KeyX', key: 'x' }, sid);
    await sleep(500);

    // 9. Navigate to QA Review mode to test ReviewPanel
    console.log('10. Navigating to QA Review mode...');
    await send('Page.navigate', { url: 'http://localhost:3000/?qa=review' }, sid);
    await sleep(2500);
    await snap('modal-review-master-detail.png');

    console.log('ALL VERIFICATION SCREENSHOTS CAPTURED SUCCESSFULLY!');
  } finally {
    ws.close();
    chrome.kill();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
