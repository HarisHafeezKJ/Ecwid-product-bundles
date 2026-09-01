/**
 * Generates Ecwid Instant Site entry script (/storefront.js).
 * Instant Site injects only URLs ending in /storefront.js (same as phone-checkout).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readClientId() {
  const envPath = path.join(root, '.env');
  if (!fs.existsSync(envPath)) return 'custom-app-137010504-4';
  const match = fs.readFileSync(envPath, 'utf8').match(/^ECWID_CLIENT_ID=(.+)$/m);
  return (match?.[1] ?? 'custom-app-137010504-4').trim();
}

const clientId = readClientId();

const content = `/**
 * Ecwid Native apps inject /storefront.js automatically.
 */
(function () {
  "use strict";
  if (window.__PB_BOOTSTRAP__) return;
  window.__PB_BOOTSTRAP__ = true;
  window.__pbAppId = "${clientId}";

  var self = document.currentScript;
  var src = (self && self.src) || "";
  var base = src.replace(/\\/storefront\\.js(?:\\?.*)?$/i, "").replace(/\\/$/, "");
  if (!base) {
    console.error("[pb-bundles] Unable to resolve app origin from storefront.js");
    return;
  }

  var el = document.createElement("script");
  el.src = base + "/storefront/pb-bundles.js?v=" + Date.now();
  el.async = true;
  el.setAttribute("data-api-base", (self && self.getAttribute("data-api-base")) || base);
  el.setAttribute("data-app-id", "${clientId}");
  var storeId = self && self.getAttribute("data-store-id");
  if (storeId) el.setAttribute("data-store-id", storeId);
  (document.head || document.documentElement).appendChild(el);
})();
`;

const targets = [
  path.join(root, 'storefront', 'storefront.js'),
  path.join(root, 'storefront', 'dist', 'storefront.js'),
];

for (const target of targets) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
  console.log(`Generated ${target}`);
}
