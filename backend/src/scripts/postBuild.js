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
const MEDUSA_CLIENT_PATH = path.join(process.cwd(), '.medusa', 'client');
const FAVICON_SRC = path.join(process.cwd(), 'public', 'faviconnnnn.jpg');
const FAVICON_DEST = path.join(MEDUSA_CLIENT_PATH, 'faviconnnnn.jpg');
const INDEX_HTML = path.join(MEDUSA_CLIENT_PATH, 'index.html');

try {
  if (fs.existsSync(FAVICON_SRC) && fs.existsSync(MEDUSA_CLIENT_PATH)) {
    fs.copyFileSync(FAVICON_SRC, FAVICON_DEST);
    if (fs.existsSync(INDEX_HTML)) {
      const html = fs.readFileSync(INDEX_HTML, 'utf8');
      const replaced = html.replace(
        /<link\s+rel="icon"[^>]*data-placeholder-favicon[^>]*\/?>/i,
        '<link rel="icon" type="image/jpeg" href="./faviconnnnn.jpg" />'
      );
      fs.writeFileSync(INDEX_HTML, replaced, 'utf8');
      console.log('✓ Admin favicon injected (faviconnnnn.jpg)');
    }
  } else {
    console.warn('⚠ Admin favicon skipped — source or client dir missing');
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
