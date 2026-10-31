/**
 * Headless-Chrome screenshot harness for story QA.
 *
 * The in-app browser keeps its tab hidden, so requestAnimationFrame never fires
 * and the layout viewport is 0x0 — neither the moving markers nor the responsive
 * HUD can be checked there. This script drives a real Chrome over CDP instead.
 *
 *   bun run scripts/cdpShot.ts --url "http://localhost:3000/?qa=act1" \
 *     --size 1280x720 --out .tmp/act1-1280.png --click 开始巡检 --settle 3000
 *
 * Repeatable extras, applied in the order given after the page is ready:
 *   --click <button text>   --eval <js expression>   --hold KeyS:1500
 *
 * --grab <js expression> writes the returned data URL to --out instead of
 * screenshotting the page; that is how the evidence camera gets inspected,
 * since its render target never reaches the visible canvas.
 */

import { rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

interface Args {
  url: string;
  out: string;
  width: number;
  height: number;
  until: string;
  steps: string[];
  grab: string | null;
  log: string | null;
  settle: number;
  timeout: number;
}

function parseArgs(argv: string[]): Args {
  const get = (name: string, fallback?: string) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 ? argv[i + 1] : fallback;
  };
  const steps: string[] = [];
  for (let i = 0; i < argv.length - 1; i++) {
    if (argv[i] === '--click') steps.push(`click:${argv[i + 1]}`);
    if (argv[i] === '--eval') steps.push(`eval:${argv[i + 1]}`);
    if (argv[i] === '--hold') steps.push(`hold:${argv[i + 1]}`);
  }
  const size = (get('size', '1280x720') as string).split('x');
  return {
    url: get('url') as string,
    out: get('out', '.tmp/cdp-shot.png') as string,
    width: Number(size[0]),
    height: Number(size[1]),
    until: get('until', "document.body.dataset.state === 'playing'") as string,
    steps,
    grab: get('grab') ?? null,
    log: get('log') ?? null,
    settle: Number(get('settle', '2500')),
    timeout: Number(get('timeout', '180000')),
  };
}

const CHROME =
  'C:/Program Files/Google/Chrome/Application/chrome.exe';

const KEY_NAMES: Record<string, string> = {
  Space: ' ',
  ShiftLeft: 'Shift',
  ControlLeft: 'Control',
};

let nextId = 1;

class Session {
  private pending = new Map<number, (value: unknown) => void>();

  private constructor(
    private readonly ws: WebSocket,
    private readonly sessionId: string
  ) {
    this.ws.onmessage = (event) => {
      const msg = JSON.parse(String(event.data));
      if (msg.id && this.pending.has(msg.id)) {
        const resolve = this.pending.get(msg.id)!;
        this.pending.delete(msg.id);
        resolve(msg);
      }
    };
  }

  static async open(browserWs: WebSocket, targetId: string) {
    const attach = await browserWsSend(browserWs, 'Target.attachToTarget', {
      targetId,
      flatten: true,
    });
    const session = new Session(browserWs, attach.sessionId as string);
    await session.send('Page.enable', {});
    await session.send('Runtime.enable', {});
    return session;
  }

  send(method: string, params: Record<string, unknown>): Promise<any> {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, (message: any) => {
        if (message.error) reject(new Error(`${method}: ${JSON.stringify(message.error)}`));
        else resolve(message.result);
      });
      this.ws.send(JSON.stringify({ id, method, params, sessionId: this.sessionId }));
    });
  }
}

function browserWsSend(ws: WebSocket, method: string, params: Record<string, unknown>) {
  const id = nextId++;
  return new Promise<any>((resolve) => {
    const handler = (event: MessageEvent) => {
      const msg = JSON.parse(String(event.data));
      if (msg.id === id) {
        ws.removeEventListener('message', handler);
        resolve(msg.result);
      }
    };
    ws.addEventListener('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitForDebuggerUrl(stderr: ReadableStream<Uint8Array>, timeout: number) {
  const reader = stderr.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const { value, done } = await Promise.race([
      reader.read(),
      sleep(500).then(() => ({ value: undefined, done: false })),
    ]);
    if (done) break;
    if (value) buffer += decoder.decode(value, { stream: true });
    const match = buffer.match(/DevTools listening on (ws:\/\/\S+)/);
    if (match) return match[1];
  }
  throw new Error('chrome never reported a DevTools URL');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.url) throw new Error('--url is required');

  const chromeProfile = join(
    tmpdir(),
    `substation-cdp-${process.pid}-${Date.now()}`
  );
  const chrome = Bun.spawn({
    cmd: [
      CHROME,
      '--headless=new',
      '--remote-debugging-port=0',
      `--user-data-dir=${chromeProfile}`,
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

  try {
    const wsUrl = await waitForDebuggerUrl(chrome.stderr!, 30000);
    const browserWs = new WebSocket(wsUrl);
    await new Promise((resolve, reject) => {
      browserWs.addEventListener('open', resolve, { once: true });
      browserWs.addEventListener('error', reject, { once: true });
    });

    const target = await browserWsSend(browserWs, 'Target.createTarget', {
      url: 'about:blank',
    });
    const session = await Session.open(browserWs, target.targetId);

    await session.send('Emulation.setDeviceMetricsOverride', {
      width: args.width,
      height: args.height,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await session.send('Page.navigate', { url: args.url });

    const started = Date.now();
    let ready = false;
    while (Date.now() - started < args.timeout) {
      await sleep(1500);
      const result = await session.send('Runtime.evaluate', {
        expression: `!!(${args.until})`,
        returnByValue: true,
      });
      if (result?.result?.value === true) {
        ready = true;
        break;
      }
    }
    if (!ready) throw new Error(`page never satisfied: ${args.until}`);

    for (const step of args.steps) {
      const sep = step.indexOf(':');
      const kind = step.slice(0, sep);
      const value = step.slice(sep + 1);
      if (kind === 'click') {
        await session.send('Runtime.evaluate', {
          expression: `(() => {
            const wanted = ${JSON.stringify(value)};
            const b = Array.from(document.querySelectorAll('button')).find(
              (x) => (x.textContent || '').trim() === wanted
            );
            if (b) b.click();
            return !!b;
          })()`,
          returnByValue: true,
        });
      } else if (kind === 'eval') {
        await session.send('Runtime.evaluate', { expression: value, returnByValue: true });
      } else if (kind === 'hold') {
        const [code, ms] = value.split(':');
        const key = KEY_NAMES[code] ?? (code.startsWith('Key') ? code.slice(3).toLowerCase() : code);
        await session.send('Input.dispatchKeyEvent', { type: 'keyDown', code, key });
        await sleep(Number(ms) || 800);
        await session.send('Input.dispatchKeyEvent', { type: 'keyUp', code, key });
      }
      await sleep(400);
    }
    await sleep(args.settle);

    if (args.log) {
      const value = await session.send('Runtime.evaluate', {
        expression: args.log,
        returnByValue: true,
      });
      console.log('log:', JSON.stringify(value?.result?.value));
    }

    if (args.grab) {
      const value = await session.send('Runtime.evaluate', {
        expression: args.grab,
        returnByValue: true,
      });
      const dataUrl = String(value?.result?.value ?? '');
      const marker = 'base64,';
      const base64 = dataUrl.includes(marker) ? dataUrl.slice(dataUrl.indexOf(marker) + 7) : '';
      if (!base64) throw new Error('--grab returned no data URL');
      writeFileSync(args.out, Buffer.from(base64, 'base64'));
    } else {
      const shot = await session.send('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: false,
      });
      writeFileSync(args.out, Buffer.from(shot.data as string, 'base64'));
    }
    console.log(`${args.out} ${args.width}x${args.height}`);
    await browserWsSend(browserWs, 'Target.closeTarget', { targetId: target.targetId });
  } finally {
    chrome.kill();
    await sleep(500);
    // Chrome leaves a full profile (~75 MB) behind here; without this the
    // project's Temp grew to 11 GB over a single night of screenshot runs.
    try {
      rmSync(chromeProfile, { recursive: true, force: true });
    } catch (err) {
      console.warn(`could not remove ${chromeProfile}: ${(err as Error).message}`);
    }
  }
}

await main();
