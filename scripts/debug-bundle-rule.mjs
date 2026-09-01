function decode(raw) {
  let cur = raw;
  for (let i = 0; i < 6; i++) {
    if (typeof cur === 'string') {
      try {
        cur = JSON.parse(cur);
        continue;
      } catch {
        break;
      }
    }
    if (cur && typeof cur === 'object' && cur.value != null) {
      cur = cur.value;
      continue;
    }
    break;
  }
  return cur;
}

const res = await fetch(
  'https://store137010504.company.site/products/sample-red-and-white-horizontal-striped-t-shirt',
);
const html = await res.text();
const match = html.match(/window\.initialState\s*=\s*"((?:\\.|[^"\\])*)"/);
if (!match) {
  console.error('no initialState');
  process.exit(1);
}
const state = JSON.parse(`"${match[1]}"`);
const cfg = decode(state.context?.appsPublicConfigs?.['custom-app-137010504-4']);
console.log('rules count:', cfg?.rules?.length);
for (const r of cfg?.rules ?? []) {
  console.log('rule', r.id, r.ruleType, r.status, 'items keys:', r.items ? Object.keys(r.items) : null);
  if (r.ruleType === 'FIXED_BUNDLE') {
    console.log('  items:', JSON.stringify(r.items, null, 2));
  }
}
