// Renders the SafeFlow icon (one SVG design) to every PNG the app, Android launcher and PWA need.
// Uses headless Chrome; all temp files and the Chrome profile live on D: (the C: drive is nearly full).
//   node scripts/render-icons.js            -> writes assets/*.png and public/icons/*.png
//   node scripts/render-icons.js --preview  -> writes only a preview sheet to D:\safeflow-build\tmp
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const WORK = 'D:\\safeflow-build\\tmp\\icons';
const PROFILE = 'D:\\safeflow-build\\chrome-tmp';
const ROOT = path.join(__dirname, '..');
const BLUE = '#0b5cad';

// Shield with a road leading into it, drawn on a 1024 grid centred at (512, 512).
const SHIELD = 'M512 182 L792 276 V512 C792 688 672 804 512 858 C352 804 232 688 232 512 V276 Z';
const ROAD = 'M424 760 L600 760 L546 352 L478 352 Z';
const DASHES = [
  [504, 650, 16, 70],
  [506, 530, 12, 56],
  [508, 428, 8, 40],
];

function mark({ shield = '#fff', road = BLUE, dash = '#fff', cutout = false }) {
  if (cutout) {
    // Monochrome: one solid shape with the road cut out (Android themed icons only use alpha).
    return `<path fill="${shield}" fill-rule="evenodd" d="${SHIELD} ${ROAD}"/>`;
  }
  const dashes = DASHES.map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${w / 2}" fill="${dash}"/>`).join('');
  return `<path fill="${shield}" d="${SHIELD}"/><path fill="${road}" d="${ROAD}"/>${dashes}`;
}

function svg({ bg = null, radius = 0, scale = 1, ...markOpts }) {
  const t = `translate(512 512) scale(${scale}) translate(-512 -512)`;
  const back = bg ? `<rect width="1024" height="1024" rx="${radius}" fill="${bg}"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${back}<g transform="${t}">${mark(markOpts)}</g></svg>`;
}

// name -> [output path, size, svg]
const VARIANTS = {
  icon: ['assets/icon.png', 1024, svg({ bg: BLUE })],
  adaptiveFg: ['assets/android-icon-foreground.png', 512, svg({ scale: 0.6 })],
  adaptiveBg: ['assets/android-icon-background.png', 512, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><rect width="1024" height="1024" fill="${BLUE}"/></svg>`],
  monochrome: ['assets/android-icon-monochrome.png', 432, svg({ scale: 0.6, cutout: true })],
  splash: ['assets/splash-icon.png', 1024, svg({ shield: BLUE, road: '#fff', dash: BLUE, scale: 0.9 })],
  favicon: ['assets/favicon.png', 48, svg({ bg: BLUE, radius: 220, scale: 1.05 })],
  pwa192: ['public/icons/icon-192.png', 192, svg({ bg: BLUE, radius: 220 })],
  pwa512: ['public/icons/icon-512.png', 512, svg({ bg: BLUE, radius: 220 })],
  maskable: ['public/icons/maskable-512.png', 512, svg({ bg: BLUE, scale: 0.78 })],
};

function render(svgText, size, outFile) {
  fs.mkdirSync(WORK, { recursive: true });
  const html = path.join(WORK, `render-${size}-${path.basename(outFile)}.html`);
  fs.writeFileSync(html, `<!doctype html><html><body style="margin:0;background:transparent">${svgText.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  execFileSync(CHROME, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
    `--user-data-dir=${PROFILE}`, '--default-background-color=00000000', '--force-device-scale-factor=1',
    `--window-size=${size},${size}`, `--screenshot=${outFile}`, 'file:///' + html.replace(/\\/g, '/'),
  ], { stdio: 'ignore', env: { ...process.env, TEMP: WORK, TMP: WORK } });
}

if (process.argv.includes('--preview')) {
  // One sheet showing each variant on a light and a dark tile, for review before anything is replaced.
  const tiles = Object.entries(VARIANTS).map(([name, [, , s]]) =>
    `<figure><div class="l">${s}</div><div class="d">${s}</div><figcaption>${name}</figcaption></figure>`).join('');
  const sheet = `<div style="display:flex;flex-wrap:wrap;gap:16px;padding:16px;font:14px sans-serif;background:#fff">
    <style>figure{margin:0;text-align:center} .l,.d{width:120px;height:120px;display:inline-block;margin:2px;border-radius:12px;overflow:hidden}
    .l{background:#eee} .d{background:#222} svg{width:100%;height:100%}</style>${tiles}</div>`;
  const out = path.join(WORK, 'preview.png');
  render(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><foreignObject width="1024" height="1024"><div xmlns="http://www.w3.org/1999/xhtml">${sheet}</div></foreignObject></svg>`, 1024, out);
  console.log('Preview:', out);
} else {
  fs.writeFileSync(path.join(ROOT, 'assets', 'icon.svg'), VARIANTS.icon[2] + '\n');
  for (const [name, [rel, size, s]] of Object.entries(VARIANTS)) {
    render(s, size, path.join(ROOT, rel));
    console.log(`${name}: ${rel} (${size}px)`);
  }
}
