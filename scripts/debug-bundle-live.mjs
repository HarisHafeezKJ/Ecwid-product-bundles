function parseInitialState(html) {
  const m = html.match(/initialState\s*=\s*("(?:\\.|[^"\\])*")/);
  if (!m) throw new Error('no initialState');
  const once = JSON.parse(m[1]);
  return JSON.parse(once);
}

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
const state = parseInitialState(html);
const cfg = decode(state.context?.appsPublicConfigs?.['custom-app-137010504-4']);
const token = state.context?.appsPublicTokens?.['custom-app-137010504-4'];
const rule = cfg?.rules?.find((r) => r.id === '5a89782a-88b8-4a8b-adb8-989ac9617b22');
console.log('token:', token?.slice(0, 20) + '...');
console.log('components:', JSON.stringify(rule?.items?.components, null, 2));

// Test offer API
const offerRes = await fetch('https://ecwid-product-bundles.vercel.app/api/storefront/offer?storeId=137010504', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  body: JSON.stringify({
    productId: '839034548',
    publicToken: token,
    publicConfig: cfg,
  }),
});
console.log('offer status', offerRes.status);
const offer = await offerRes.json().catch(() => null);
if (offer?.view) {
  console.log('offer items count:', offer.view.items?.length);
  console.log('offer product ids:', offer.view.items?.map((i) => i.productId));
  console.log('variants per item:', offer.view.items?.map((i) => (i.variants?.length ?? 0)));
}

// Test add-discounted
const lines = offer?.view?.items?.map((i) => ({
  productId: i.productId,
  quantity: i.minQuantity || 1,
  variantId: i.variants?.length > 1 ? i.variants[0]?.id : undefined,
}));
if (lines?.length) {
  const addRes = await fetch(
    'https://ecwid-product-bundles.vercel.app/api/storefront/add-discounted?storeId=137010504',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        ruleId: rule.id,
        lines,
        publicToken: token,
        publicConfig: cfg,
      }),
    },
  );
  console.log('add-discounted status', addRes.status);
  const addBody = await addRes.text();
  console.log('add-discounted body', addBody.slice(0, 2000));
}
