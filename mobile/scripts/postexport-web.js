// After `expo export -p web`: make the single-page app work on GitHub Pages and offline.
// - 404.html = index.html, so deep links like /review/SF-123 load the app instead of a 404 page.
// - .nojekyll, so files/folders starting with "_" (Expo's _expo/) are served when deploying from a branch.
// - sw.js gets this build's id and the full list of app files to precache (see public/sw.js); index.html gets the
//   same id, so an open page can tell that a newer build has taken over.
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const dist = path.join(__dirname, '..', 'dist');
const index = path.join(dist, 'index.html');
if (!fs.existsSync(index)) {
  console.error('dist/index.html not found; run `expo export -p web` first.');
  process.exit(1);
}
fs.writeFileSync(path.join(dist, '.nojekyll'), '');

function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? listFiles(p) : [p];
  });
}

const swPath = path.join(dist, 'sw.js');
if (fs.existsSync(swPath)) {
  const assets = [
    ...listFiles(path.join(dist, '_expo')),
    ...listFiles(path.join(dist, 'assets')),
    path.join(dist, 'manifest.json'),
    ...listFiles(path.join(dist, 'icons')),
  ]
    .filter((p) => fs.existsSync(p))
    .map((p) => '/' + path.relative(dist, p).split(path.sep).join('/'))
    .sort();
  // The build id changes whenever any file changes, so each deploy installs a fresh service worker.
  const hash = crypto.createHash('sha256');
  for (const url of assets) hash.update(url).update(fs.readFileSync(path.join(dist, url)));
  hash.update(fs.readFileSync(index));
  const buildId = hash.digest('hex').slice(0, 12);
  const sw = fs.readFileSync(swPath, 'utf8');
  if (!sw.includes('__PRECACHE__') || !sw.includes('__BUILD_ID__')) {
    console.error('dist/sw.js placeholders not found.');
    process.exit(1);
  }
  fs.writeFileSync(swPath, sw.replace('__BUILD_ID__', buildId).replace('__PRECACHE__', JSON.stringify(assets)));
  const html = fs.readFileSync(index, 'utf8');
  if (!html.includes('__BUILD_ID__')) {
    console.error('dist/index.html build id placeholder not found.');
    process.exit(1);
  }
  fs.writeFileSync(index, html.replace('__BUILD_ID__', buildId));
  console.log(`Wrote dist/sw.js (build ${buildId}, ${assets.length} files to precache)`);
}
// After index.html has its build id: deep links load the same page.
fs.copyFileSync(index, path.join(dist, '404.html'));
console.log('Wrote dist/404.html and dist/.nojekyll');
