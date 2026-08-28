import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

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
