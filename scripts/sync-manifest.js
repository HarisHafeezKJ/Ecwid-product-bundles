import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn(`Warning: ${src} not found; skipping copy to ${dest}`);
    return;
  }
  fs.rmSync(dest, { recursive: true, force: true });
  fs.cpSync(src, dest, { recursive: true });
  console.log(`Synced ${src} -> ${dest}`);
}

const manifestSource = path.join(root, 'app.manifest.json');
const manifestTarget = path.join(root, 'server', 'src', 'app.manifest.json');
fs.copyFileSync(manifestSource, manifestTarget);
console.log('Synced app.manifest.json -> server/src/app.manifest.json');

const envSource = path.join(root, '.env');
const envTarget = path.join(root, 'server', '.env');
if (fs.existsSync(envSource)) {
  fs.copyFileSync(envSource, envTarget);
  console.log('Synced .env -> server/.env');
} else {
  console.warn('Warning: root .env not found; deployment will need server/.env or repo root .env');
}

// Bundle admin + storefront into server/static for Vercel serverless (Root Directory = server)
copyDirRecursive(path.join(root, 'admin', 'dist'), path.join(root, 'server', 'static', 'admin'));
copyDirRecursive(path.join(root, 'storefront', 'dist'), path.join(root, 'server', 'static', 'storefront'));
