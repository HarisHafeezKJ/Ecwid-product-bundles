import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const source = path.join(root, 'app.manifest.json');
const target = path.join(root, 'server', 'src', 'app.manifest.json');

fs.copyFileSync(source, target);
console.log('Synced app.manifest.json -> server/src/app.manifest.json');
