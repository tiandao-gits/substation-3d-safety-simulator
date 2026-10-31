import { writeFileSync } from 'node:fs';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const ARTIFACT_DIR = 'C:/Users/Administrator/.gemini/antigravity/brain/bcdd6d5e-7fd0-48ab-b854-cd0218745fbd';

async function main() {
  const port = 9300 + Math.floor(Math.random() * 400);
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
      '--hide-scrollbars',
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

    // Dismiss the TaskCard to enter roaming
    await send('Runtime.evaluate', {
      expression: `(() => {
        const startBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('开始巡检'));
        if (startBtn) startBtn.click();
      })()`,
    }, sid);
    await sleep(2000);

    // Shot 1: Roaming HUD with Action Dock in bottom-right
    let shot = await send('Page.captureScreenshot', { format: 'png' }, sid);
    writeFileSync(`${ARTIFACT_DIR}/hud-roaming-action-dock.png`, Buffer.from(shot.data, 'base64'));
    console.log('Saved hud-roaming-action-dock.png');

    // Shot 2: Open ToolWorkbench for ds-contact via KeyF
    console.log('2. Opening ToolWorkbench via KeyF...');
    await send('Runtime.evaluate', {
      expression: `(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', code: 'KeyF', bubbles: true }));
      })()`,
    }, sid);
    await sleep(1500);

    shot = await send('Page.captureScreenshot', { format: 'png' }, sid);
    writeFileSync(`${ARTIFACT_DIR}/inspection-dialog-initial.png`, Buffer.from(shot.data, 'base64'));
    console.log('Saved inspection-dialog-initial.png');

    // Shot 3: Click [肉眼观察]
    console.log('3. Clicking [肉眼观察]...');
    await send('Runtime.evaluate', {
      expression: `(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const eyeBtn = btns.find(b => b.textContent && b.textContent.includes('肉眼观察'));
        if (eyeBtn) eyeBtn.click();
      })()`,
    }, sid);
    await sleep(1000);

    shot = await send('Page.captureScreenshot', { format: 'png' }, sid);
    writeFileSync(`${ARTIFACT_DIR}/inspection-visual-hazards.png`, Buffer.from(shot.data, 'base64'));
    console.log('Saved inspection-visual-hazards.png');

    // Shot 4: Click [检测] on the hazard item to open instrument drawer
    console.log('4. Clicking [检测]...');
    await send('Runtime.evaluate', {
      expression: `(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const inspectBtn = btns.find(b => b.textContent && b.textContent.includes('检测'));
        if (inspectBtn) inspectBtn.click();
      })()`,
    }, sid);
    await sleep(1000);

    shot = await send('Page.captureScreenshot', { format: 'png' }, sid);
    writeFileSync(`${ARTIFACT_DIR}/inspection-tool-drawer.png`, Buffer.from(shot.data, 'base64'));
    console.log('Saved inspection-tool-drawer.png');

    // Shot 5: Select thermometer tool (红外测温仪) to execute detection
    console.log('5. Selecting thermometer tool...');
    await send('Runtime.evaluate', {
      expression: `(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const toolBtn = btns.find(b => b.textContent && b.textContent.includes('红外测温仪'));
        if (toolBtn) toolBtn.click();
      })()`,
    }, sid);
    await sleep(1200);

    shot = await send('Page.captureScreenshot', { format: 'png' }, sid);
    writeFileSync(`${ARTIFACT_DIR}/inspection-reading-done.png`, Buffer.from(shot.data, 'base64'));
    console.log('Saved inspection-reading-done.png');

    // Shot 6: Switch to [取证处置]
    console.log('6. Switching to [取证处置]...');
    await send('Runtime.evaluate', {
      expression: `(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const evBtn = btns.find(b => b.textContent && b.textContent.includes('取证处置'));
        if (evBtn) evBtn.click();
      })()`,
    }, sid);
    await sleep(800);

    // Capture photo and select disposition P0
    await send('Runtime.evaluate', {
      expression: `(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const capBtn = btns.find(b => b.textContent && b.textContent.includes('现场拍照取证'));
        if (capBtn) capBtn.click();
        const p0Btn = btns.find(b => b.textContent && b.textContent.includes('[P0]'));
        if (p0Btn) p0Btn.click();
      })()`,
    }, sid);
    await sleep(1200);

    shot = await send('Page.captureScreenshot', { format: 'png' }, sid);
    writeFileSync(`${ARTIFACT_DIR}/inspection-evidence-disposition-ready.png`, Buffer.from(shot.data, 'base64'));
    console.log('Saved inspection-evidence-disposition-ready.png');

    // Shot 7: Click [完成此项 · 继续下个巡检点]
    console.log('7. Clicking [完成此项 · 继续下个巡检点]...');
    await send('Runtime.evaluate', {
      expression: `(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const nextBtn = btns.find(b => b.textContent && b.textContent.includes('继续下个巡检点'));
        if (nextBtn) nextBtn.click();
      })()`,
    }, sid);
    await sleep(1500);

    shot = await send('Page.captureScreenshot', { format: 'png' }, sid);
    writeFileSync(`${ARTIFACT_DIR}/inspection-next-checkpoint.png`, Buffer.from(shot.data, 'base64'));
    console.log('Saved inspection-next-checkpoint.png');

    // Shot 8: Close workbench and open backpack modal
    console.log('8. Opening backpack modal...');
    await send('Runtime.evaluate', {
      expression: `(() => {
        const escBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('关闭'));
        if (escBtn) escBtn.click();
      })()`,
    }, sid);
    await sleep(800);

    await send('Runtime.evaluate', {
      expression: `(() => {
        const bBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('现场背包'));
        if (bBtn) bBtn.click();
      })()`,
    }, sid);
    await sleep(1000);

    shot = await send('Page.captureScreenshot', { format: 'png' }, sid);
    writeFileSync(`${ARTIFACT_DIR}/modal-backpack-redesign.png`, Buffer.from(shot.data, 'base64'));
    console.log('Saved modal-backpack-redesign.png');

    console.log('ALL VERIFICATION SCREENSHOTS SAVED SUCCESSFULLY!');
  } finally {
    ws.close();
    chrome.kill();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
