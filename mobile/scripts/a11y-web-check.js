// Automated accessibility check of the web build with axe-core, in headless Chrome (no extra test framework).
//
//   npm run build:web            (with EXPO_PUBLIC_API_URL pointing at a running API, e.g. http://127.0.0.1:8000)
//   node scripts/a11y-web-check.js [--dist dist] [--port 8790]
//
// Env: CHROME_PATH (default: the usual Windows install path), SF_REPORTER_TOKEN / SF_REVIEWER_TOKEN (optional:
// session tokens for the signed-in screens). The API must allow the origin http://127.0.0.1:<port> (CORS).
// Exits with 1 when any screen has a "serious" or "critical" violation, in light or dark mode.
const { spawn } = require('child_process');
const fs = require('fs');
const http = require('http');
const path = require('path');

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};
const DIST = path.resolve(opt('dist', path.join(__dirname, '..', 'dist')));
const PORT = Number(opt('port', '8790'));
const CDP_PORT = PORT + 1;
const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// [name, path, token env, step]. A step clicks the element whose accessible text ends with the given label.
const SCREENS = [
  ['home-map', '/', null],
  ['home-list', '/', null, 'Vezi lista'],
  ['report-start', '/report', null],
  ['report-112-stop', '/report', null, 'Da'],
  ['login', '/login', null],
  ['register', '/register', null],
  ['account', '/account', null],
  ['mine', '/mine', 'SF_REPORTER_TOKEN'],
  ['report-form', '/report', 'SF_REPORTER_TOKEN', 'Nu'],
  ['review-queue', '/review', 'SF_REVIEWER_TOKEN'],
  ['review-detail', '/review/SF-TESTDEMA', 'SF_REVIEWER_TOKEN'],
  ['history', '/history', 'SF_REVIEWER_TOKEN'],
];

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ttf': 'font/ttf', '.ico': 'image/x-icon' };
function serve() {
  return http
    .createServer((req, res) => {
      const url = decodeURIComponent(req.url.split('?')[0]);
      let file = path.join(DIST, path.normalize(url).replace(/^([\\/])+/, ''));
      if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
      res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
      fs.createReadStream(file).pipe(res);
    })
    .listen(PORT, '127.0.0.1');
}

(async () => {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) throw new Error(`No web build in ${DIST}: run npm run build:web first.`);
  const server = serve();
  const profile = fs.mkdtempSync(path.join(process.env.TEMP || require('os').tmpdir(), 'sf-axe-'));
  const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profile}`, '--no-first-run', 'about:blank']);
  try {
    let up = false;
    for (let i = 0; i < 50 && !up; i++) {
      try {
        await fetch(`http://127.0.0.1:${CDP_PORT}/json/version`);
        up = true;
      } catch {
        await sleep(200);
      }
    }
    if (!up) throw new Error(`Chrome did not open port ${CDP_PORT} (in use? try --port <other>).`);
    const tab = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?about:blank`, { method: 'PUT' })).json();
    const ws = new WebSocket(tab.webSocketDebuggerUrl);
    await new Promise((r) => (ws.onopen = r));
    let id = 0;
    const pending = new Map();
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (pending.has(m.id)) {
        pending.get(m.id)(m.result);
        pending.delete(m.id);
      }
    };
    const send = (method, params = {}) => new Promise((r) => { pending.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
    const ev = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.value;
    const base = `http://127.0.0.1:${PORT}`;
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await send('Page.navigate', { url: base + '/account' });
    await sleep(1500);

    let failures = 0;
    for (const theme of ['light', 'dark']) {
      for (const [name, route, tokenEnv, step] of SCREENS) {
        const token = tokenEnv ? process.env[tokenEnv] : '';
        if (tokenEnv && !token) {
          console.log(`skip  ${theme}/${name} (${tokenEnv} not set)`);
          continue;
        }
        await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme }] });
        await ev(`localStorage.clear(); localStorage.setItem('safeflow.theme', '${theme}');` +
          (token ? `localStorage.setItem('safeflow.session', ${JSON.stringify(token)});` : '') + 'true');
        await send('Page.navigate', { url: base + route });
        await sleep(2500);
        if (step) {
          const clicked = await ev(`(() => {
            const el = [...document.querySelectorAll('[role=button],[role=radio]')]
              .find((e) => (e.getAttribute('aria-label') || e.innerText || '').trim().split('\\n').pop().trim() === ${JSON.stringify(step)});
            if (!el) return false; el.click(); return true; })()`);
          if (!clicked) console.log(`warn  ${theme}/${name}: "${step}" not found`);
          await sleep(1500);
        }
        await ev(AXE + ';true');
        const result = await ev(`axe.run(document, { resultTypes: ['violations'] }).then((r) => r.violations.map((v) => ({
          id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 3).map((n) => n.target.join(' ')) })))`);
        const serious = (result || []).filter((v) => v.impact === 'serious' || v.impact === 'critical');
        const minor = (result || []).length - serious.length;
        console.log(`${serious.length ? 'FAIL' : 'ok  '}  ${theme}/${name}: ${serious.length} serious/critical, ${minor} minor/moderate`);
        for (const v of result || []) console.log(`        [${v.impact}] ${v.id}: ${v.help} -> ${v.nodes.join(' | ')}`);
        failures += serious.length;
      }
    }
    console.log(failures ? `\n${failures} serious/critical violation(s).` : '\nNo serious or critical violations.');
    process.exitCode = failures ? 1 : 0;
    ws.close();
  } finally {
    chrome.kill();
    server.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
