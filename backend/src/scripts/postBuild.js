const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

const MEDUSA_SERVER_PATH = path.join(process.cwd(), '.medusa', 'server');

// Check if .medusa/server exists - if not, build process failed
if (!fs.existsSync(MEDUSA_SERVER_PATH)) {
  throw new Error('.medusa/server directory not found. This indicates the Medusa build process failed. Please check for build errors.');
}

// Copy pnpm-lock.yaml
fs.copyFileSync(
  path.join(process.cwd(), 'pnpm-lock.yaml'),
  path.join(MEDUSA_SERVER_PATH, 'pnpm-lock.yaml')
);

// Copy .env if it exists
const envPath = path.join(process.cwd(), '.env');
if (fs.existsSync(envPath)) {
  fs.copyFileSync(
    envPath,
    path.join(MEDUSA_SERVER_PATH, '.env')
  );
}

// ── Admin favicon injection ─────────────────────────────────────────
// Medusa ships admin HTML with `<link rel="icon" href="data:," data-placeholder-favicon />`.
// Copy our favicon into .medusa/client and rewrite the placeholder so the
// browser tab shows our icon when using the admin.
const FAVICON_SRC = path.join(process.cwd(), 'public', 'faviconnnnn.jpg');
// Admin build lives in two places:
//  - .medusa/client           (source template, used in dev)
//  - .medusa/server/public/admin  (bundled build served in production)
// Patch both so either path works.
const ADMIN_DIRS = [
  path.join(process.cwd(), '.medusa', 'client'),
  path.join(process.cwd(), '.medusa', 'server', 'public', 'admin'),
];

try {
  if (!fs.existsSync(FAVICON_SRC)) {
    console.warn('⚠ Admin favicon source not found:', FAVICON_SRC);
  } else {
    for (const dir of ADMIN_DIRS) {
      if (!fs.existsSync(dir)) continue;
      fs.copyFileSync(FAVICON_SRC, path.join(dir, 'faviconnnnn.jpg'));
      const idx = path.join(dir, 'index.html');
      if (fs.existsSync(idx)) {
        const html = fs.readFileSync(idx, 'utf8');
        const replaced = html.replace(
          /<link\s+rel="icon"[^>]*data-placeholder-favicon[^>]*\/?>/i,
          '<link rel="icon" type="image/jpeg" href="/app/faviconnnnn.jpg" />'
        );
        fs.writeFileSync(idx, replaced, 'utf8');
        console.log(`✓ Admin favicon injected into ${dir}`);
      }
    }
  }
} catch (e) {
  console.warn('⚠ Admin favicon injection failed:', e.message);
}

// Install dependencies
console.log('Installing dependencies in .medusa/server...');
execSync('pnpm i --prod --frozen-lockfile', { 
  cwd: MEDUSA_SERVER_PATH,
  stdio: 'inherit'
});
