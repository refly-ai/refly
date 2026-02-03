const fs = require('node:fs');
const path = require('node:path');

// Read API dependencies
const apiPkg = JSON.parse(fs.readFileSync('apps/api/package.json', 'utf8'));
const deps = Object.keys(apiPkg.dependencies || {}).filter((d) => d.startsWith('@refly/'));

// Update each workspace package to point to dist/ for pnpm deploy
for (const dep of deps) {
  const short = dep.replace('@refly/', '');
  const pkgPath = path.join('packages', short, 'package.json');

  if (!fs.existsSync(pkgPath)) {
    console.warn(`Warning: ${pkgPath} not found, skipping`);
    continue;
  }

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  pkg.main = 'dist/index.js';
  pkg.types = 'dist/index.d.ts';
  pkg.exports = { '.': './dist/index.js', './*': './dist/*.js' };

  fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);
}

console.log('Updated', deps.length, 'workspace packages for deploy');
