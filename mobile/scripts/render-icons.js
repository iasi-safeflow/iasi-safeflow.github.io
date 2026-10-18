// Renders every icon the app, the Android launcher and the PWA need from the logo (assets/logo.webp, 800×800:
// a purple rounded square with white artwork on a white margin). Uses headless Chrome's canvas; all temp files
// and the Chrome profile live on D: (the C: drive is nearly full).
//   node scripts/render-icons.js            -> writes assets/*.png and public/icons/*.png
//   node scripts/render-icons.js --preview  -> writes only a preview sheet to D:\safeflow-build\tmp\icons
//
// From the one image it derives:
// - "rounded": the logo with its white margin made transparent (web/PWA icons, favicon, splash);
// - "mark": the white artwork alone on transparency (Android adaptive foreground and themed monochrome icon);
// - "background": the logo's purple gradient without the artwork (Android adaptive background, full-bleed icons).
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const WORK = 'D:\\safeflow-build\\tmp\\icons';
const PROFILE = 'D:\\safeflow-build\\chrome-tmp\\icons';
const ROOT = path.join(__dirname, '..');
const SOURCE = path.join(ROOT, 'assets', 'logo.webp');
const PORT = 9381;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// name -> [output path, size, recipe]. Recipes (drawn in the page below):
//   rounded(pad)       the logo with transparent corners, `pad` = empty border as a fraction of the size
//   fullBleed(scale)   purple background edge to edge, artwork scaled from its size in the logo
//   mark(fit)          white artwork only, its bounding box fitted into `fit` of the size, centred
//   background()       purple background only
const VARIANTS = {
  icon: ['assets/icon.png', 1024, { kind: 'fullBleed', scale: 1 }],
  adaptiveFg: ['assets/android-icon-foreground.png', 512, { kind: 'mark', fit: 0.6 }],
  adaptiveBg: ['assets/android-icon-background.png', 512, { kind: 'background' }],
  monochrome: ['assets/android-icon-monochrome.png', 432, { kind: 'mark', fit: 0.6 }],
  splash: ['assets/splash-icon.png', 1024, { kind: 'rounded', pad: 0.12 }],
  favicon: ['assets/favicon.png', 48, { kind: 'rounded', pad: 0 }],
  pwa192: ['public/icons/icon-192.png', 192, { kind: 'rounded', pad: 0 }],
  pwa512: ['public/icons/icon-512.png', 512, { kind: 'rounded', pad: 0 }],
  maskable: ['public/icons/maskable-512.png', 512, { kind: 'fullBleed', scale: 0.82 }],
};

// Runs in the page: builds the three layers from the logo, then renders each variant to a PNG data URL.
const PAGE_SCRIPT = (logoUrl, variants) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onerror = () => reject(new Error('logo did not load'));
  img.onload = () => {
    const W = img.width, H = img.height;
    const src = document.createElement('canvas');
    src.width = W; src.height = H;
    const sctx = src.getContext('2d');
    sctx.drawImage(img, 0, 0);
    const px = sctx.getImageData(0, 0, W, H).data;
    const at = (x, y) => (y * W + x) * 4;
    const nearWhite = (i) => Math.min(px[i], px[i + 1], px[i + 2]) > 200;

    // 1. The white margin: everything near-white connected to the image corners.
    const outside = new Uint8Array(W * H);
    const stack = [[0, 0], [W - 1, 0], [0, H - 1], [W - 1, H - 1]];
    while (stack.length) {
      const [x, y] = stack.pop();
      if (x < 0 || y < 0 || x >= W || y >= H || outside[y * W + x] || !nearWhite(at(x, y))) continue;
      outside[y * W + x] = 1;
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
    let x0 = W, y0 = H, x1 = 0, y1 = 0;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!outside[y * W + x]) {
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    const side = Math.max(x1 - x0, y1 - y0) + 1;

    // 2. The purple gradient: average colour near each corner of the square (clear of the artwork), then a
    //    bilinear blend between the four.
    const sample = (cx, cy) => {
      let r = 0, g = 0, b = 0, n = 0;
      for (let y = cy - 12; y <= cy + 12; y++) for (let x = cx - 12; x <= cx + 12; x++) {
        const i = at(x, y);
        if (outside[y * W + x] || px[i + 1] > 120) continue; // skip margin and white artwork
        r += px[i]; g += px[i + 1]; b += px[i + 2]; n++;
      }
      return n ? [r / n, g / n, b / n] : [100, 50, 200];
    };
    const inset = Math.round(side * 0.16);
    const tl = sample(x0 + inset, y0 + inset), tr = sample(x1 - inset, y0 + inset);
    const bl = sample(x0 + inset, y1 - inset), br = sample(x1 - inset, y1 - inset);
    const purpleAt = (u, v) => [0, 1, 2].map((k) => (tl[k] * (1 - u) + tr[k] * u) * (1 - v) + (bl[k] * (1 - u) + br[k] * u) * v);

    const layer = () => { const c = document.createElement('canvas'); c.width = side; c.height = side; return c; };
    const rounded = layer(), mark = layer(), background = layer();
    const rd = rounded.getContext('2d').createImageData(side, side);
    const md = mark.getContext('2d').createImageData(side, side);
    const bd = background.getContext('2d').createImageData(side, side);
    let mx0 = side, my0 = side, mx1 = 0, my1 = 0;
    for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) {
      const sx = x0 + x, sy = y0 + y, o = (y * side + x) * 4;
      const bgc = purpleAt(x / (side - 1), y / (side - 1));
      bd.data.set([bgc[0], bgc[1], bgc[2], 255], o);
      if (sx >= W || sy >= H) continue;
      const i = at(sx, sy);
      const [r, g, b] = [px[i], px[i + 1], px[i + 2]];
      // Whiteness from the green channel: the purple has little green, the artwork and the margin are white. The
      // dead zone keeps the logo's soft purple highlight (top right) out of the artwork layer.
      const floor = bgc[1] + 45;
      const white = Math.max(0, Math.min(1, (g - floor) / (255 - floor)));
      const isOutside = outside[sy * W + sx];
      const touchesOutside = !isOutside && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => outside[(sy + dy) * W + (sx + dx)]);
      if (isOutside) continue; // transparent corners
      if (touchesOutside) {
        // Anti-aliased rim against the white margin: keep the purple, fade by how white the pixel is.
        rd.data.set([bgc[0], bgc[1], bgc[2], Math.round(255 * (1 - white))], o);
        continue;
      }
      rd.data.set([r, g, b, 255], o);
      const a = Math.round(255 * white);
      md.data.set([255, 255, 255, a], o);
      if (a > 128) { if (x < mx0) mx0 = x; if (x > mx1) mx1 = x; if (y < my0) my0 = y; if (y > my1) my1 = y; }
    }
    rounded.getContext('2d').putImageData(rd, 0, 0);
    mark.getContext('2d').putImageData(md, 0, 0);
    background.getContext('2d').putImageData(bd, 0, 0);
    const markBox = { x: mx0, y: my0, w: mx1 - mx0 + 1, h: my1 - my0 + 1 };

    const out = {};
    for (const [name, [, size, recipe]] of Object.entries(variants)) {
      const c = document.createElement('canvas');
      c.width = size; c.height = size;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      if (recipe.kind === 'rounded') {
        const inner = size * (1 - 2 * recipe.pad), off = size * recipe.pad;
        ctx.drawImage(rounded, off, off, inner, inner);
      } else if (recipe.kind === 'background') {
        ctx.drawImage(background, 0, 0, size, size);
      } else if (recipe.kind === 'fullBleed') {
        ctx.drawImage(background, 0, 0, size, size);
        const s = size * recipe.scale, off = (size - s) / 2;
        ctx.drawImage(mark, off, off, s, s);
      } else if (recipe.kind === 'mark') {
        const k = (size * recipe.fit) / Math.max(markBox.w, markBox.h);
        const dw = side * k, cx = (markBox.x + markBox.w / 2) * k, cy = (markBox.y + markBox.h / 2) * k;
        ctx.drawImage(mark, size / 2 - cx, size / 2 - cy, dw, dw);
      }
      out[name] = c.toDataURL('image/png');
    }
    resolve({ out, square: { x0, y0, side }, colors: { tl, tr, bl, br }, markBox });
  };
  img.src = logoUrl;
});

(async () => {
  fs.mkdirSync(WORK, { recursive: true });
  fs.mkdirSync(PROFILE, { recursive: true });
  const chrome = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, '--no-first-run', 'about:blank'], {
    env: { ...process.env, TEMP: WORK, TMP: WORK },
  });
  try {
    let up = false;
    for (let i = 0; i < 50 && !up; i++) {
      try { await fetch(`http://127.0.0.1:${PORT}/json/version`); up = true; } catch { await sleep(200); }
    }
    if (!up) throw new Error(`Chrome did not open port ${PORT}.`);
    const tab = await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
    const ws = new WebSocket(tab.webSocketDebuggerUrl);
    await new Promise((r) => (ws.onopen = r));
    let id = 0;
    const pending = new Map();
    ws.onmessage = (e) => { const m = JSON.parse(e.data); if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
    const send = (method, params = {}) => new Promise((r) => { pending.set(++id, r); ws.send(JSON.stringify({ id, method, params })); });
    const logoUrl = 'data:image/webp;base64,' + fs.readFileSync(SOURCE).toString('base64');
    const res = await send('Runtime.evaluate', {
      expression: `(${PAGE_SCRIPT.toString()})(${JSON.stringify(logoUrl)}, ${JSON.stringify(VARIANTS)})`,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.result.exceptionDetails) throw new Error(JSON.stringify(res.result.exceptionDetails));
    const { out, square, colors, markBox } = res.result.result.value;
    console.log('logo square:', square, 'mark box:', markBox);
    console.log('purple corners:', Object.fromEntries(Object.entries(colors).map(([k, c]) => [k, '#' + c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')])));
    const write = (file, dataUrl) => {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));
    };
    if (process.argv.includes('--preview')) {
      for (const [name, dataUrl] of Object.entries(out)) write(path.join(WORK, `preview-${name}.png`), dataUrl);
      console.log('Preview files in', WORK);
    } else {
      for (const [name, [rel, size]] of Object.entries(VARIANTS)) {
        write(path.join(ROOT, rel), out[name]);
        console.log(`${name}: ${rel} (${size}px)`);
      }
    }
    ws.close();
  } finally {
    chrome.kill();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
