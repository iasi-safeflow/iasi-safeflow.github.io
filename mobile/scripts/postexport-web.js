// After `expo export -p web`: make the single-page app work on GitHub Pages.
// - 404.html = index.html, so deep links like /review/SF-123 load the app instead of a 404 page.
// - .nojekyll, so files/folders starting with "_" (Expo's _expo/) are served when deploying from a branch.
const fs = require('fs');
const path = require('path');

const dist = path.join(__dirname, '..', 'dist');
const index = path.join(dist, 'index.html');
if (!fs.existsSync(index)) {
  console.error('dist/index.html not found; run `expo export -p web` first.');
  process.exit(1);
}
fs.copyFileSync(index, path.join(dist, '404.html'));
fs.writeFileSync(path.join(dist, '.nojekyll'), '');
console.log('Wrote dist/404.html and dist/.nojekyll');
