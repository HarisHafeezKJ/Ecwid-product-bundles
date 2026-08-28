# Wix App Analysis & Ecwid Migration Specification

This document is a technical analysis of the existing Wix CLI app `us-product-bundles`. It is intended as a migration specification for rebuilding equivalent merchant and shopper behavior on Ecwid. Behavior described here is taken from the repository source. Items that cannot be determined from the code are marked `UNKNOWN — REQUIRES INVESTIGATION`.

---

## 1. Executive Summary

The app is a **Wix Stores AOV (average order value) suite**. Merchants create discount **offers**. Shoppers see those offers on product pages and the cart. Four offer types exist:

| Offer type (`ruleType`) | Merchant-facing label | Shopper surface | Discount applied how |
| --- | --- | --- | --- |
| `VOLUME_DISCOUNT` | Quantity break | Product page plugin `volume-offer` | Sale price written onto cart lines (`catalogOverrideFields`) |
| `FIXED_BUNDLE` | Bundle | Product page plugin `bundle-offer` | Same: priced line overrides at add-to-cart |
| `MIX_AND_MATCH` | Mix & Match | Product page plugin `mix-match-offer` | Same: priced line overrides at add-to-cart |
| `CART_UPSELL` | Upsells | Cart-page embedded script | Suggestion UI only — **no discount** |

**What the merchant controls:** create / edit / pause / delete offers; product targeting; discount math; copy; visual style; per-item variant locking (bundles); quantity tiers; cart-upsell trigger/suggested products; enable/disable of the cart embedded script.

**What the shopper sees:** offer widgets on product pages (auto-placed site plugins plus an optional custom-element widget); a cart upsell block on `/cart` when the script is enabled and a trigger product is in the cart.

**How pricing actually works today:** Bundle / Mix / Quantity **do not** use live Wix Automatic Discount rules. On add-to-cart the backend recomputes sale prices from catalog + rule and writes them via `catalogOverrideFields`. A later cart-sync pass re-prices volume/mix lines when quantity changes. Cart upsell adds catalog-priced items with no override. Leftover Wix Automatic Discount rules are **cleared** on save.

**What must be reproduced on Ecwid:** the four offer types, admin CRUD, storefront widgets, cart upsell, server-side price calculation (never trust client prices), cart re-pricing when quantity changes, checkout promo labels, variant picking, and conversion recording. Wix-specific placement (site plugins, embedded scripts, `catalogOverrideFields`, Wix Data collections) must be replaced with Ecwid equivalents after research.

---

## 2. Application Architecture

```text
Wix Dashboard (React, @wix/design-system)
    ↓ saveBundleRule() / listBundleRules() / deleteBundleRule()
Wix Data collections (PRIVILEGED)
    bundle-rules  ·  app-settings  ·  rule-impressions
    ↓
Dashboard APIs (auth.elevate)     Storefront APIs (httpClient.fetchWithAuth)
    /api/dashboard/discount-sync*     /api/storefront/offer
    /api/dashboard/discount-remove    /api/storefront/add-discounted
                                      /api/storefront/cart-upsell
                                      /api/storefront/sync-volume-cart
    ↓                                 ↓
Wix Stores catalog V1/V3          Product-page custom elements
Wix eCom cart + checkout          Cart embedded script (BODY_END)
orders.onOrderApproved            Site plugins (auto-add to product slots)
```

### Runtime layers

| Layer | Technology | Role |
| --- | --- | --- |
| App host | Wix CLI + Astro (`output: "server"`) + `@wix/astro` | Bundles dashboard, APIs, extensions |
| Admin UI | React + `@wix/design-system` | Offer list + full-page editor |
| Persistence | `@wix/data` collections scoped to `@ayanmuazzam/us-product-bundles` | Rules, settings, conversions |
| Catalog | `@wix/stores` V1 and V3 (version detected at runtime) | Products, variants, inventory, collections |
| Cart / checkout | `@wix/ecom`, `@wix/site-ecom` | Add lines, override prices, open side cart, create checkout |
| Storefront widgets | Custom elements (`bundle-widget`, `bundle-offer`, `volume-offer`, `mix-match-offer`) | Product-page UI |
| Cart UI | Embedded script `cart-upsell` | Cart upsell + volume cart re-sync |
| Privileged backend | `auth.elevate(...)` | Read/write PRIVILEGED collections, cart mutations, discount CRUD |

### Identity

| Key | Value | Source |
| --- | --- | --- |
| App ID | `97b98274-1d83-4461-a2bd-5f6c6afbd588` | `wix.config.json`, `src/lib/collections.ts` |
| Namespace | `@ayanmuazzam/us-product-bundles` | same |
| Code identifier | `us_product_bundles` | `wix.config.json` |
| Project type | `App` | `wix.config.json` |
| Stores catalog app ID (used in cart `catalogReference.appId`) | `215238eb-22a5-4c36-9e7b-e7c08025e04e` | `STORES_CATALOG_APP_ID` |
| Wix Stores product-page app IDs (plugin placements) | `a0c68605-c2e7-4c8d-9ea1-767f9770e087` and `1380b703-ce81-ff05-f115-39571d94dfcd` | site plugin `placements` |

There is **no separate global settings dashboard page**. Per-offer `widgetStyle` is the live configuration. The `app-settings` collection exists and is written on view increment; several of its fields have **no admin UI and no storefront consumption**.

---

## 3. Project Structure

```text
us-product-bundles/
  wix.config.json              App ID, namespace, project type
  astro.config.mjs             Server output, Wix adapter, CORS for storefront
  package.json                 Wix SDKs + React + Astro
  public/                      Plugin logos / widget thumbnail
  src/
    extensions.ts              Registers all Wix extensions
    env.d.ts                   Generated SDK types
    lib/                       Shared domain logic (rules, pricing, catalog, cart)
    pages/api/
      dashboard/               Discount sync/remove (elevated)
      storefront/              Offer load, ATC, cart upsell, volume sync
    extensions/
      dashboard/pages/my-page/ Home + offer editor
      dashboard/modals/edit-bundle/  Legacy modal (registered; not opened from home)
      backend/data-collections/ CMS schemas
      backend/service-plugins/ Discount triggers + cart validations (both no-op)
      backend/events/          Order-approved attribution
      backend/cms.ts           Elevated data helpers
      backend/build-widget-view.ts
      backend/build-cart-upsell.ts
      site/plugins/            Auto-added product-page plugins
      site/widgets/            Place-anywhere custom element
      site/embedded-scripts/   Cart upsell + volume cart sync
```

Registered extensions (`src/extensions.ts`):

1. Dashboard page `my-page` (title **Bundles**, `routePath: ''`)
2. Data collections
3. Dashboard modal `edit-bundle`
4. Custom element `bundle-widget`
5. eCom discount triggers SPI `bundle-triggers`
6. eCom validations SPI `bundle-validate`
7. Embedded script `cart-upsell`
8. Event `order-attribution`
9. Site plugin `bundle-offer`
10. Site plugin `volume-offer`
11. Site plugin `mix-match-offer`

---

## 4. Complete Feature Inventory

| # | Feature | Admin Control | Frontend | Backend | Database | External API | Wix Dependency |
| - | --- | --- | --- | --- | --- | --- | --- |
| 1 | List offers | Home table, search, type/status filters | — | `listBundleRules` | `bundle-rules` | — | Wix Data, Dashboard |
| 2 | Create offer (4 types) | Create modal → editor | Widgets/script after save+publish | `saveBundleRule` | `bundle-rules` | Discount sync (clears Wix rules) | Dashboard, Data |
| 3 | Edit offer | Editor (setup + style) | Same widgets re-fetch rule | `getBundleRule` / `saveBundleRule` | `bundle-rules` | Discount sync | Dashboard, Data, Stores catalog |
| 4 | Pause / activate | Table toggle + editor toggle + checkbox | Hidden when not `ACTIVE` | `setBundleStatus` | `bundle-rules.status` | Discount cleared if not ACTIVE | Data |
| 5 | Delete offer | Table action + confirm | Widget empty | `deleteBundleRule` | remove row | `discount-remove` | Data, eCom discounts |
| 6 | Quantity break | Targeting, layout, variations, tiers, copy, style | `volume-offer` on product page | offer API + add-discounted + volume sync | `bundle-rules` | Stores catalog | Site plugin, eCom cart |
| 7 | Fixed bundle | Products, min qty, variant lock, discount, copy, style | `bundle-offer` | offer API + add-discounted | `bundle-rules` | Stores catalog | Site plugin, eCom cart |
| 8 | Mix & Match | Tiers, product pool, copy, style | `mix-match-offer` | offer API + add-discounted + volume sync | `bundle-rules` | Stores catalog / categories | Site plugin, eCom cart |
| 9 | Cart upsell | Trigger + suggested products, copy, style, script toggle | Cart page `#pb-cart-upsell` | `cart-upsell` API | `bundle-rules` | `embeddedScripts`, cart add | Embedded script, site-ecom checkout |
| 10 | Place-anywhere widget | Editor props `product-id`, `rule-type` | `<bundle-widget>` | offer API | `bundle-rules` | — | Custom element, Editor SDK |
| 11 | Live editor preview | Preview column (desktop/tablet/mobile) | Client-side HTML only | — | — | — | Dashboard only |
| 12 | Monthly views counter | Stats cards (read-only) | Incremented when offer API loads without `ruleId` | `incrementMonthlyViews` | `app-settings` | `appInstances` billing | App Management, Data |
| 13 | Conversion / ROI rows | **No admin UI** | — | `orders.onOrderApproved` | `rule-impressions` | eCom orders | Events |
| 14 | Combo inventory decrement | — | — | On approved combo-kind order lines | Stores inventory | `@wix/stores` inventory | Stores |
| 15 | Checkout promo label | `widgetStyle.checkoutLabel` | Cart line `descriptionLines` + 🏷 | `priceLinesForRule` | stamped on cart line | eCom cart overrides | `catalogOverrideFields` |
| 16 | Volume cart reprice | Implicit (rule tiers) | Embedded script watches cart qty | `syncVolumeCart` | — | eCom cart update/remove/add | Embedded script |
| 17 | Variant picking | Bundle item checkboxes; volume `allowVariantChoice` | Selects in widget | Variants from catalog | stored on items | Stores variants | Stores V1/V3 |
| 18 | Stock display | — | Out-of-stock badges in widget | `areProductsInStock` | — | Stores inventory | Stores |
| 19 | Support contacts | Email / WhatsApp buttons | — | — | hardcoded | mailto / wa.me | None |
| 20 | Setup guide modal | Help card | — | — | — | — | Dashboard UI |
| 21 | Discount rule sync | On save / home refresh | **Currently clears** Wix Automatic Discounts | `syncBundleDiscount` | `wixDiscountRuleId` | `discountRules` + REST | eCom Discount Rules |
| 22 | Custom discount triggers SPI | — | — | Returns **zero** triggers | — | eCom SPI | Service plugin |
| 23 | Cart validation SPI | — | — | Returns **zero** violations | — | eCom SPI | Service plugin |
| 24 | Plan tiers | Read from billing / settings | Feature locks **always allow** | `getPlanElevated` | `app-settings.planTier` | `appInstances.getAppInstance` | App Management |
| 25 | Theme presets (volume style) | 4 preset buttons | Widget CSS vars | — | `widgetStyle` | — | Dashboard |
| 26 | Tier images | Media Manager picker | Volume widget images | — | `volumeTiers[].imageUrl` | `dashboard.openMediaManager` | Media Manager |
| 27 | CORS for storefront APIs | — | Widgets call same-origin APIs | `corsHeaders` allowlist | — | — | Wix site hostnames |

---

## 5. Admin Dashboard

### 5.1 Admin Pages

There is **one** dashboard page extension.

#### Admin Page: Bundles (home + editor)

- **Extension title:** `Bundles`
- **UI header:** `Product Bundles & Upsells`
- **Route:** `routePath: ''` (app dashboard root)
- **ID:** `a21086b0-9a02-4f89-935e-061c45c2283a`
- **Navigation:** Wix Dashboard app entry (not a nested route)
- **Permissions:** Wix Dashboard access for the installing merchant. No in-app role checks. Collection CRUD is PRIVILEGED and runs in the dashboard/API identity.
- **Views:** React state `view: 'home' | 'editor'` in `my-page.tsx`. Home stays mounted (`display: none` when editor is open).

##### Home (`DashboardHome`)

**Purpose:** list offers, show impression counts, create/edit/pause/delete, contact support, open setup guide.

**Data loaded:**

- `listBundleRules()` → all rows in `bundle-rules` (newest first)
- `loadAppSettings()` → `currentViewsCount` if `viewsPeriod` matches current UTC `YYYY-MM`
- Fire-and-forget `syncMissingDiscountsRemote()` → POST `/api/dashboard/discount-sync-missing`

**Data saved:** none on load. Status toggle and delete persist immediately.

**Components:** `SupportWidget`, hero banner, `HelpCard`, `ViewsStats`, `OffersTable`, `CreateOfferModal`.

##### Editor (`OfferEditor`)

**Purpose:** create or edit one offer. Two tabs: **1. Setup & Offer Rules** and **2. Design & Storefront Style**. Live HTML preview on the right.

**Data loaded (edit):** `getCatalogVersion()`, `getBundleRule(ruleId)`, hydrate product names/images/variants from Stores.

**Data saved:** `saveBundleRule(...)` then toast `Saved successfully.` and return to home (list refresh via `listEpoch`).

##### Legacy modal: Edit Bundle

- Dashboard modal ID `2865ddfc-3332-4f62-b1c1-ea796221806f`, title `Edit Bundle`, 720×720.
- Registered and implemented (`edit-bundle.tsx`).
- `EDIT_BUNDLE_MODAL_ID` is exported but **`dashboard.openModal` is never called** from the current home/editor.
- Treat as **legacy / unused by the current admin UX**. `CollectionPicker` lives only in this modal folder and is not imported by the page editor.

---

### 5.2 Admin Controls

Defaults below come from `emptyRuleInput`, `defaultWidgetStyle`, `DEFAULT_SETTINGS`, and editor `blankDraft`. Style numeric/color defaults are in `src/lib/widget-style.ts` (`DEFAULT_WIDGET_STYLE`) plus type-specific overlays.

#### Home controls

| Admin Control | Type | Default | Stored In | Frontend Effect | Logic |
| --- | --- | --- | --- | --- | --- |
| Create New Offer | Button | — | — | Opens type picker | Sets editor session `{ mode: 'create', ruleType }` |
| Search offers by name | Search | `''` | Component state only | Filters table | `title.toLowerCase().includes(term)` |
| Type filter | SegmentedToggle | `ALL` | Component state | Filters table | `VOLUME_DISCOUNT` / `FIXED_BUNDLE` / `MIX_AND_MATCH` / `CART_UPSELL` |
| Status filter | Dropdown | `ALL` | Component state | Filters table | `ACTIVE` or `DISABLED` (UI label **Paused**) |
| Status toggle | ToggleSwitch | rule.status | `bundle-rules.status` | Offer appears only if `ACTIVE` | `ACTIVE` ↔ `DISABLED`; toast; `saveBundleRule` |
| Edit | Button | — | — | Opens editor | `{ mode: 'edit', ruleType, ruleId }` |
| Pause / Activate Offer | Secondary action | — | same as toggle | same | same as toggle |
| Delete Offer | Secondary action | — | row removed | Widget gone | `window.confirm`; `deleteBundleRule`; also removes stored Wix discount IDs |
| Setup Guide & Tips | Button + Modal | closed | — | None | Copy-only |
| Email | Button | — | hardcoded `support@fmemodules.com` | None | `mailto:` |
| WhatsApp | Button | — | hardcoded `923315986829` | None | `https://wa.me/923315986829` |

`DRAFT` is a valid `RuleStatus` in types/mappers but the current UI never sets it (only `ACTIVE` / `DISABLED`).

#### Editor chrome (all types)

| Admin Control | Type | Default | Stored In | Frontend Effect | Logic |
| --- | --- | --- | --- | --- | --- |
| Offer name (header input + Setup field) | Text | Type-specific (`Quantity discount`, `Bundle offer`, `Mix & Match`, `Upsell`) | `bundle-rules.title` **required** | Not shown to shoppers | Validation: trim nonempty |
| Active / Paused | ToggleSwitch + Checkbox “Activate Offer Immediately” | `ACTIVE` | `status` | Widget hidden unless `ACTIVE` | Save persists immediately on Save Offer |
| Cancel / back | Button | — | — | Discard unsaved | `onClose(false)` |
| Save Offer | Button | — | whole rule | After publish, widgets fetch new rule | `validateRuleForm` then `saveBundleRule` |
| Tab Setup / Style | Custom tabs | `setup` | — | Preview still uses full draft | Local state |
| Preview device | SegmentedToggle | `desktop` | — | Preview width only | 340 / 420 / 100% |

#### Placement / targeting

| Admin Control | Location | Type | Default | Stored In | Frontend Effect |
| --- | --- | --- | --- | --- | --- |
| Checkout Discount Label / Checkout Promo Label | Setup (not cart upsell) | Text | Type promo (`SAVE & SMILE`, `Mix & Match`, etc.) | `widgetStyle.checkoutLabel` (+ `promoLabel` mirror) | Cart line promo text via `discountDisplayName` |
| Widget Header Text / Heading | Cart upsell | Text | `Customers also bought` | `widgetStyle.blockTitle` | Cart block `<h3>` |
| Display on all product pages | Bundle + Mix | Checkbox | `true` | `applyToAllProducts`; `displayOn` = `ALL_ITEMS` or `PRIMARY`; `targetProductId` | See §8 placement rules |
| Primary Target Product | Bundle when not all-pages | Product search | empty | `targetProductId` / `primaryProductId` | Bundle widget only on that product page when `applyToAllProducts` is false |
| What does this discount apply to? | Quantity only | Dropdown `ALL` / `ONE` | `ALL` | `applyToAllProducts` | All product pages vs selected pool (max 25) |
| Selected products | Quantity when `ONE` | Product pool | `[]` | `items.components` | Widget on those product pages |
| Let customers choose different variation for each item | Quantity only | Checkbox | `true` | `allowVariantChoice` | Per-unit variant selects when qty > 1 and variants exist. Bundle/Mix force `true` on save. Cart upsell always `false`. |

#### Discount (fixed bundle only in current Setup)

| Admin Control | Type | Allowed | Default | Stored In | Frontend Effect |
| --- | --- | --- | --- | --- | --- |
| Discount Format | Dropdown | `NONE`, `PERCENTAGE`, `FIXED_AMOUNT`, `SET_PRICE` | `NONE` for bundle | `discountType` | Per-unit sale via `bundleLineSale` |
| Discount Amount | Number | %: 0–100; else ≥ 0 (UI max 1_000_000) | `0` | `discountValue` | Clamped again on save (`clampDiscountValue`) |

Quantity and Mix discounts live **on tiers**, not on `discountType`/`discountValue` of the rule. Cart upsell forces `discountType: 'NONE'`, `discountValue: 0` on save.

#### Quantity tiers (`VolumeTiersEditor`, `exactQty=true`)

| Control | Type | Default (3 tiers) | Validation | Stored In | Frontend |
| --- | --- | --- | --- | --- | --- |
| Tier Title Header | Text | `#N Deal Offer` | — | `volumeTiers[].title` | Volume card title |
| Exact quantity | Number ≥ 1 | 1, 2, 3 | At least 2 tiers; each qty **strictly greater** than previous | `volumeTiers[].qty` | Radio for that exact qty; cart deal only at exact qty (`exactVolumeTier`) |
| Discount Type | Dropdown | `PERCENTAGE` | `PERCENTAGE` / `FIXED_AMOUNT` / `SET_PRICE` | `volumeTiers[].discountType` | Unit sale price |
| Discount Value | Number | 0, 10, 15 | ≥ 0; % capped 100 | `volumeTiers[].discountValue` | Same |
| Tier image | Media Manager | `''` | data: URLs stripped | `imageUrl` | Volume card image |
| Image corner radius | Slider 0–50 | `0` | — | `imageRadius` | CSS |
| Image size | Slider 24–200 | `86` | — | `imageSize` | CSS |
| Add / Remove tier | Buttons | min 2 visible (remove only if > 2) | — | array | Extra radios |

#### Mix rules (`EditorMixMatchRules`)

| Control | Type | Default | Validation | Stored In | Frontend |
| --- | --- | --- | --- | --- | --- |
| Minimum items required | Number | 2, 3, 4 | Increasing; 1–5 tiers; first tier qty = eligibility (`mixRequiredQty`) | `volumeTiers[].qty` also copied to `requiredCount` on save | CTA stays “Select N more” until qty met |
| Discount type / value | Dropdown + number | 5 / 10 / 15 % | same as volume types | tiers | Highest reached tier via `bestVolumeTier` (cart + mix pricing) |
| Add / delete tier | Button | — | max 5 | array | Extra summary rows |

#### Bundle products (`EditorBundleProducts` + `BundleItemCard`)

| Control | Type | Default | Validation | Stored In | Frontend |
| --- | --- | --- | --- | --- | --- |
| Add Product to Bundle | Search grid | — | ≥ 2 products; first is primary | `items.components` | Product rows in widget |
| Reorder | Drag / up / down | first = primary | Must keep one primary (index 0) | `isPrimary` | Display order |
| Min Quantity | Number ≥ 1 | `1` | — | `minQuantity` | Line qty on ATC |
| Let customers choose variation… | Checkbox | `true` if variants | If locked, `defaultVariantId` required | `adminLocksVariant`, `chooseVariationPerItem` | Hide vs show variant UI |
| Bundle variation | Dropdown | first in-stock | required when locked | `defaultVariantId` | Hidden pick; used on ATC |
| Remove | IconButton | — | — | splice | Product gone |

#### Mix product pool

| Control | Type | Limits | Stored In | Frontend |
| --- | --- | --- | --- | --- |
| Product pool | Search grid | 2–25 products **or** (legacy) a collection ID | `items` and/or `sourceCollectionId` | Mix cards; eligibility pool |

The current **page editor does not expose CollectionPicker**. Collection fallback still exists in `saveBundleRule` / `loadMixPoolIdsByRule` if `sourceCollectionId` is set (legacy modal / old data).

#### Cart upsell products + script

| Control | Type | Validation | Stored In | Frontend |
| --- | --- | --- | --- | --- |
| Enable cart upsell script | Toggle | — | Embedded script param `enabled` (`true`/`false`) via `embeddedScripts.embedScript` | Script reads `#pb-upsell-config data-enabled`. Toast: enable requires **Publish**. |
| Trigger Products | Product grid | ≥ 1 | `triggerProductIds` | Cart offer shows when any trigger is in cart |
| Suggested Upsell Products | Product grid | ≥ 1 | `suggestedProductIds` | Suggested cards (in-stock only; already-in-cart filtered out) |

#### Copy (Block customization)

**Volume:** Block title, Add to cart button text, Offer summary title (`summaryBuy` + `summarySave`), Standard price text.

**Bundle:** Block title, Add to cart text, Buy all at text, Buy all Tag text.

**Mix:** 18 copy fields including `{{COUNT}}` in `qtyPromptText` (see `EditorMixCopy` LEFT/RIGHT lists). Defaults in `MIX_COPY_DEFAULTS`.

**Upsell:** Heading text, Add button text, Selected button text (`buyAllTagText`). Checkout CTA text is **hardcoded** as `Add N item(s) & checkout →` (`checkoutCtaLabel`) — not an admin field.

#### Style tab (persisted in `widgetStyle` OBJECT)

All style values are parsed/clamped in `parseWidgetStyle` (hex colors; sizes typically 10–32px; opacities 0–100; radii 0–32; `variationsWidth` 20–100; `ctaWidth` 0–100).

**Volume style cards:** Quick Theme Presets (Clean Minimal, Ocean Breeze, Sunset Gold, Modern Dark); Block title; Offer Card (incl. selected bg/border); Offer title; Offer subtitle; Price; Variation dropdown; Add to cart Button.

**Bundle style cards:** Product dividers (`LINE` / `PLUS` / `PLUS_LINE`); Block Title; Product; Product Title; Product Quantity; Product Price; Product Option Name; Product Option Item Number; Product Variations; Product Discount Price; Buy All At; Buy All At Price; Buy All At Tag; Add To Cart Button (incl. active/success colors).

**Mix style cards:** Block title; Product card; Selected product; Product title; Product quantity and options; Product price; Summary; Add to cart button.

**Upsell style cards:** Block title; Product card; Selected product; Product title; Product price; Add button; Checkout button (uses `buyAll*` fields).

Changes take effect on **Save Offer**, then after the site has the new data (storefront fetches on each widget load). No extra “publish widgets” step except Wix site publish for plugins/script.

---

### 5.3 Admin Actions

| Action | Trigger | Backend | Side effects |
| --- | --- | --- | --- |
| Refresh list | Mount, `listEpoch`, after mutate | `listBundleRules`, `loadAppSettings` | Discount backfill |
| Create | Type select | none until Save | Editor blank draft |
| Save | Save Offer | `items.insert` or `update` then POST `/api/dashboard/discount-sync` | Clears Wix Automatic Discount for that rule; may resync other cart-upsell rows after bundle membership change (those also clear) |
| Toggle status | Switch | `saveBundleRule` with new status | Inactive → discount removed |
| Delete | Confirm | `items.remove` + POST `/api/dashboard/discount-remove` | Irreversible |
| Enable cart script | Toggle | `embeddedScripts.embedScript({ parameters: { enabled } })` | Merchant must publish site |
| Pick tier image | Button | `dashboard.openMediaManager({ category: 'IMAGE', multiSelect: false })` | URL stored; base64 rejected on persist |

---

### 5.4 Admin Permissions

| Concern | What the code does |
| --- | --- |
| Dashboard access | Standard Wix app dashboard. No custom RBAC. |
| Data collections | `itemRead/Insert/Update/Remove: 'PRIVILEGED'` on all three collections. Dashboard SDK identity can query; storefront uses elevated backend APIs. |
| Catalog | Dashboard calls Stores APIs without elevate. Backend offer/ATC uses `elevate: true`. If Stores not installed, editor sets `storesUnavailable` and product search fails empty. |
| Discount Rules | `auth.elevate(discountRules.*)` only on dashboard API routes. |
| Cart mutations | `auth.elevate(cart.addToCart / getCart / updateLineItemsQuantity / removeLineItems)` on storefront APIs. |
| Embedded script | `embeddedScripts.getEmbeddedScript` / `embedScript` from dashboard. |
| Billing plan | `appInstances.getAppInstance` (dashboard) or elevated (backend). Fallback `app-settings.planTier`. |
| Authorization failure | Caught, `console.error`, toast or empty list / save error text. No custom 403 UI. |

Exact Wix Dev Center permission scopes are **not in this repo** (`UNKNOWN — REQUIRES INVESTIGATION` in the Dev Center app). From code usage they must include Wix Data, Stores catalog+inventory (V1 and V3), eCom cart, Discount Rules, App Instances, Embedded Scripts, Orders webhooks, Media Manager.

---

## 6. Frontend Functionality

### 6.1 Storefront Components

| Component | Tag | Placement | Auto-add | Filters `ruleType` |
| --- | --- | --- | --- | --- |
| Quantity Break plugin | `volume-offer` | Product page slot `product-page-details-1` | Yes | `VOLUME_DISCOUNT` |
| Bundle Offer plugin | `bundle-offer` | `product-page-details-2` | Yes | `FIXED_BUNDLE` |
| Mix and Match Offer plugin | `mix-match-offer` | `product-page-details-3` | Yes | `MIX_AND_MATCH` |
| Bundle Widget | `bundle-widget` | Merchant-placed; default 450×420; `autoAdd: false` | No | Optional `rule-type` attr; empty = all matching product-page types |
| Cart Upsell script | injects `#pb-cart-upsell` | Cart page DOM (after line items / before coupon) | Via embed + publish | `CART_UPSELL` |

Plugins **subclass** `BundleWidget` and force `rule-type`. All product widgets share `bundle-widget.tsx`.

**Product ID resolution:** attribute `product-id` / `productid`, else slug from `window.location.pathname` via `findProductBySlug`.

**Editor canvas:** `wixWindow.viewMode() === 'Editor'` → placeholder HTML, no live offer.

**Multiple offers:** if no `rule-id` and multiple views returned, parent mounts one child custom element per view (`rule-id` + `rule-type` set).

### 6.2 User Interactions

#### Quantity break

1. Customer sees titled block and one card per **exact** tier qty (radio).
2. Selecting a qty updates `volumeQty` and variant unit picks if `allowVariantChoice` and multiple variants.
3. Click add → `addDiscountedCatalogLines(ruleId, parts)` → POST `/api/storefront/add-discounted` → side cart opens.
4. Loading: button uses `addingToCartText` / disabled via `adding` flag.
5. Error: widget replaced with `addToCartErrorText`.

Does **not** appear if: no active matching rule, empty items, `overViewLimit` (currently never true), API 204, product id unresolved.

#### Fixed bundle

1. Lists each bundle product with qty, price, optional variant selects, dividers.
2. “Buy all at” summary uses `discounted` / `original` from server view model.
3. Add bundle → combo parts (per-unit variants if `chooseVariationPerItem`) → same add-discounted API.

Does **not** appear if rule not `ACTIVE` or `ruleShowsOnProductPage` is false.

#### Mix & Match

1. Pool of products with qty steppers and variants.
2. CTA disabled until selected qty ≥ first tier qty (`mixRequiredCount`).
3. Summary uses mix totals; add → add-discounted with selected lines only.

#### Cart upsell

1. Runs only if `#pb-upsell-config[data-enabled=true]` **and** path looks like `/cart` or `/cart-page`.
2. Reads current cart, GET `/api/storefront/cart-upsell?productIds=...` (max 50 IDs).
3. Customer selects suggested items (variant expand), then checkout CTA **or** native checkout intercept if any selected.
4. Selected items added at **full catalog price** via `currentCart.addToCurrentCart` (not add-discounted).
5. Then `createCheckoutFromCurrentCart` + `ecom.navigateToCheckoutPage`, fallback click native checkout.
6. Add timeout 8000 ms. Errors show red banner then continue native checkout.

Empty cart, no matching trigger, or all suggested already in cart → widget removed.

#### Volume cart sync (same embedded script)

Always started when the script file loads (`startVolumeCartSync`), **even if** upsell `data-enabled` is false — **if the script tag still loads**. `UNKNOWN — REQUIRES INVESTIGATION` whether Wix still injects the script HTML when `enabled=false` (the HTML always includes the module; `data-enabled` only gates `runCartUpsell`). Volume sync watches qty controls, `pb-cart-changed`, focus, interval 12s, POST `/api/storefront/sync-volume-cart`.

### 6.3 Conditional Rendering

```text
IF productId resolved
AND GET /api/storefront/offer returns views
AND view.overViewLimit is not true
AND rule.status === ACTIVE
AND ruleShowsOnProductPage(rule, productId)
THEN render widget for that ruleType
ELSE render empty (innerHTML = '')
```

```text
CART_UPSELL storefront:
IF embedded enabled === 'true'
AND pathname matches /cart
AND cart has lines
AND at least one ACTIVE CART_UPSELL rule is triggered
AND at least one suggested product in stock and not already in cart
THEN mount #pb-cart-upsell
```

Site plugin settings panels are read-only copy: “Configure offers and style in the Bundles Dashboard.”

Custom element panel: optional Product ID; Offer type Auto / Quantity / Bundle / Mix (not cart upsell).

### 6.4 Frontend State

| State | Where | Persistence |
| --- | --- | --- |
| Selected variants, mix qtys, volume qty, `adding` | Custom element instance fields | Lost on refresh |
| Upsell selected/expanded/variant maps | Module-level `state` in cart-upsell.ts | Lost on refresh |
| Cart line sale prices + promo marks | Wix cart (`catalogOverrideFields`, options `pbOfferId`/`pbDealId`, invisible Unicode in description) | Until line removed / re-synced |
| Offer rules | Wix Data | Persistent |
| Monthly views | `app-settings` | Persistent per UTC month |
| Conversions | `rule-impressions` | Persistent |
| Dashboard draft | React state | Until save/cancel |
| Table filters/search | React state | Temporary |
| Catalog version cache | module `cachedVersion` | Process lifetime |

No `localStorage` / `sessionStorage` usage found in `src/`.

---

## 7. Admin → Frontend Mapping

| Admin Setting | Stored Value | Frontend Component | Condition | Behavior |
| --- | --- | --- | --- | --- |
| status Active | `ACTIVE` | All widgets / upsell | required | Shown |
| status Paused | `DISABLED` | same | — | Not listed by storefront queries (`status: 'ACTIVE'`) |
| title | string | Admin table only | — | Not shopper-facing |
| checkoutLabel / promoLabel | string | Cart line 🏷 text | Bundle/Mix/Qty ATC | `discountDisplayName` |
| blockTitle | string | Widget heading / upsell h3 | always for that offer | Copy |
| addToCartText | string | ATC / Add + | always | Copy |
| applyToAllProducts | boolean | Product plugins | see placement | All pages vs targeted |
| targetProductId / items pool | IDs | Product plugins | Mix/Volume/Bundle rules | Which PDP |
| items + minQuantity | components | Bundle widget | — | Lines and qty |
| adminLocksVariant / defaultVariantId | bool / id | Bundle widget | has variants | Lock vs choose |
| chooseVariationPerItem | bool | Bundle widget | unlocked and qty>1 | Per-unit selects |
| allowVariantChoice | bool | Volume widget | — | Per-unit variants |
| discountType/Value | enum/number | Bundle prices | — | `bundleLineSale` |
| volumeTiers | array | Volume radios / Mix summary | — | Exact qty (volume) vs best tier (mix) |
| triggerProductIds | array | Cart upsell | any in cart | Show block |
| suggestedProductIds | array | Cart upsell | in stock, not in cart | Cards |
| widgetStyle colors/sizes | object | CSS variables on widget | always | Appearance |
| layout VERTICAL/HORIZONTAL | OfferLayout | Volume widget only in editor | Bundle/Mix/Upsell hide layout card | Volume PDP layout |
| embedded `enabled` | `'true'`/`'false'` | Cart script | publish | Mount upsell |
| wixDiscountRuleId | string | **Not used for live pricing** | — | Cleared on sync |
| app-settings.widgetTitle | `'Frequently Bought Together'` | **Stored but no frontend usage found** | — | Dead for storefront |
| app-settings.buttonLabel | `'Add Bundle to Cart'` | **Stored but no frontend usage found** | — | Dead |
| app-settings.showSavingsBadge | `true` | **Stored but no frontend usage found** | — | Dead |
| app-settings.themeSyncEnabled | `true` | **Stored but no frontend usage found** | — | Dead |
| app-settings.stockShieldEnabled / stockThreshold | `true` / `1` | Validation SPI ignores | — | Dead; inventory still used for widget in-stock flags with threshold 1 hardcoded in `build-widget-view` |
| planTier / monthlyViewsLimit | FREE / 1000… | Stats + view increment | cap **not enforced** (`overLimit: false`) | Count only |
| Preview device toggle | local | Editor only | — | No storefront |

**Frontend behavior with no admin control:**

- Cart page detection regex `/\/cart(-page)?(\/|$)/i`
- Upsell checkout label `Add N items & checkout →`
- Native checkout intercept
- Side cart open after product-page ATC
- Unicode zero-width offer stamping on cart lines
- CORS origin allowlist
- Plugin slot IDs
- Support email/WhatsApp
- Volume exact-qty vs Mix “qty or more” (`bestVolumeTier`)
- In-stock filter for upsell suggestions
- `PROMO_TAG` 🏷 on cart lines

---

## 8. Business Logic

### Placement (`ruleShowsOnProductPage`)

```text
IF productId empty OR ruleType === CART_UPSELL → false
IF applyToAllProducts → true
IF MIX_AND_MATCH OR VOLUME_DISCOUNT →
  productId in mixPoolProductIds(rule) OR productId === targetProductId
ELSE (FIXED_BUNDLE) → productId === targetProductId
```

`applyToAllProducts` missing in CMS: inferred false only if `displayOn === 'PRIMARY'` and `primaryProductId` nonempty; else true.

### Fixed bundle eligibility (ATC + order attribution)

```text
items.length >= 2
AND for every item: cartQty(productId) >= minQuantity
```

ATC `priceFixed` also requires every requested line product to be in the bundle.

### Quantity break eligibility (ATC)

```text
volumeTiers nonempty
IF applyToAllProducts → some cart product qty matches exactVolumeTier
ELSE → some targeted product qty matches exactVolumeTier
```

Exact match: `tier.qty === floor(qty)` and tier is discountable (`discountValue > 0` unless `SET_PRICE`).

**Cart sync** uses the same exact-qty rule. Changing qty off-deal restores catalog price (`catalogPlan`).

If **multiple** volume rules uniquely claim a product, `uniqueVolumeRuleForProduct` returns undefined (no auto-apply).

### Mix & Match eligibility

```text
poolIds = items product IDs else collection products
required = min(volumeTiers.qty) else requiredCount (>=1)
mixMatchCartQty(lines in pool) >= required
```

Pricing uses **highest** matching tier (`bestVolumeTier` / `volumeUnitPrice`), not exact qty.

FIXED_AMOUNT on a mix/volume tier is **spread per unit**: `perUnitOff = tier.discountValue / qty`.

SET_PRICE: `min(basePrice, discountValue)` (never raises price).

PERCENTAGE: `base * (1 - pct/100)`.

### Bundle line sale (`bundleLineSale`)

- `NONE`: full price
- `PERCENTAGE`: unit * (1 - pct/100)
- `FIXED_AMOUNT`: max(0, unit - amount) **per unit**
- `SET_PRICE`: min(unit, amount)

### Cart upsell trigger

```text
ANY triggerProductId has qty > 0 in cart
Suggested = suggestedProductIds else items not in trigger set
```

No discount. Out-of-stock suggested products dropped.

### Views

Each product-page offer GET **without** `ruleId` increments `currentViewsCount` for UTC month. `overLimit` is hardcoded `false` (plan caps deferred). Child widgets pass `ruleId` so they do not double-count.

### Order attribution

On `orders.onOrderApproved`:

1. Combo-kind lines (`catalogReference.appId === APP_ID` and options kind `pb-combo` / `pb-volume` / empty): decrement inventory for parts; record conversion with combo price.
2. Else for each **active** rule, if `isRuleEligible` on order lines, insert `rule-impressions` once per `(orderId, bundleRuleId)`.
3. Revenue = sum of matching line totals, else order total.

### Pricing trust

`priceLinesForRule` **never** uses client-sent prices. Catalog price is loaded elevated. Throws `Bundle is not available` / `incomplete` / `Quantity break is not available` / `Product is not in this quantity break` / `Product is not available`.

### Hardcoded / deferred rules

- `canUseRuleType`, `canSeeRoi`, `canUseUpsells` always `true`.
- Stock-shield cart validation returns `violations: []`.
- Discount SPI `listTriggers` / `getEligibleTriggers` return empty arrays (overrides-only pricing).
- `syncBundleDiscount` **deletes** Wix Automatic Discount for every rule type including ACTIVE Bundle/Mix/Quantity/Upsell.

---

## 9. Data Flow

### Create / update offer

```text
OfferEditor.handleSave
    ↓ validateRuleForm
    ↓ saveBundleRule
        parse/wrap items, merge widgetStyle, clamp discount
        MIX empty items + sourceCollectionId → expand up to 100 collection products
        CART_UPSELL → applyToAll true, discount NONE
        items.update/insert bundle-rules (preserve wixDiscountRuleId)
    ↓ POST /api/dashboard/discount-sync { ruleId }
        getBundleRuleElevated
        syncBundleDiscount → removeDiscount + persist wixDiscountRuleId ''
    ↓ toast + refresh home
```

### Product page render

```text
Custom element connected / attribute change
    ↓ resolveProductId
    ↓ GET /api/storefront/offer?productId&ruleType&ruleId
        buildStorefrontWidgetViews
            getPlanElevated + matching ACTIVE rules
            incrementMonthlyViews if no ruleId
            resolve items, variants, stock, originals/discounted/savings
    ↓ JSON { view, views } or 204
    ↓ render HTML + bind clicks
```

### Add discounted items

```text
Widget add*
    ↓ ensureVisitorCartId (getCurrentCart or createCart)
    ↓ POST /api/storefront/add-discounted { cartId, ruleId, lines }
        getBundleRuleElevated ACTIVE
        priceLinesForRule (eligibility + catalog prices + dealId)
        elevate cart.addToCart(overrideCatalogLineItems)
    ↓ ecom.refreshCart + ecom.openSideCart
```

### Cart upsell

```text
Embedded script (enabled)
    ↓ getCurrentCart → product IDs
    ↓ GET/POST /api/storefront/cart-upsell
        listActiveRulesElevated('CART_UPSELL')
        isCartUpsellTriggered → load suggested in-stock products
    ↓ paint #pb-cart-upsell
    ↓ checkout: addCatalogLines (full price) → createCheckoutFromCurrentCart → navigateToCheckoutPage
```

### Volume/mix cart reprice

```text
qty change / pb-cart-changed / interval
    ↓ POST /api/storefront/sync-volume-cart { cartId }
        parseCartCatalogLines (offer/deal stamps)
        plan volume/mix updates; skip products in an eligible fixed bundle
        applyLinePlans: update qty or remove+re-add with overrides or catalog prices
    ↓ refreshStorefrontCart
```

### Conversion

```text
orders.onOrderApproved
    ↓ attributeApprovedOrder
        combo lines → decrementComboInventory + insertConversion
        else eligibility → insertConversion (skip duplicate orderId+ruleId)
```

---

## 10. Database / Storage

All collections: namespace `@ayanmuazzam/us-product-bundles`, permissions **PRIVILEGED** all operations. Created by Data Collection extension `af186b92-7245-4d29-90e4-1539839f82a4`.

### Collection: `bundle-rules`

**Purpose:** one row per merchant offer.

| Field | Type | Purpose | Used By |
| --- | --- | --- | --- |
| `_id` | string (Wix) | Primary id | All |
| `title` | TEXT | Admin name; required to map | Admin |
| `ruleType` | TEXT | `FIXED_BUNDLE` \| `MIX_AND_MATCH` \| `VOLUME_DISCOUNT` \| `CART_UPSELL` | Admin + FE |
| `discountType` | TEXT | Bundle-level discount | Bundle pricing |
| `discountValue` | NUMBER | Bundle-level amount | Bundle pricing |
| `status` | TEXT | `ACTIVE` \| `DRAFT` \| `DISABLED` | Listing / storefront |
| `primaryProductId` | TEXT | Primary / target fallback | Placement |
| `displayOn` | TEXT | `PRIMARY` \| `ALL_ITEMS` | Placement inference |
| `applyToAllProducts` | BOOLEAN | Storewide vs targeted | Placement |
| `targetProductId` | TEXT | Specific PDP | Placement |
| `layout` | TEXT | `VERTICAL` \| `HORIZONTAL` | Volume widget |
| `widgetStyle` | OBJECT (untyped fields) | Copy + design | Widgets / upsell |
| `items` | OBJECT | `{ components: BundleItem[],` plus legacy style keys `}` | Products / copy fallback |
| `sourceCollectionId` | TEXT | Mix collection fallback | Mix pool |
| `requiredCount` | NUMBER | Mix min qty fallback | Mix |
| `volumeTiers` | OBJECT | `{ tiers: VolumeTier[] }` | Qty / Mix |
| `triggerProductIds` | ARRAY_STRING | Upsell triggers | Cart script |
| `suggestedProductIds` | ARRAY_STRING | Upsell suggestions | Cart script |
| `allowVariantChoice` | BOOLEAN | Volume per-unit variants | Volume widget |
| `wixDiscountRuleId` | TEXT | Comma-separated Wix discount IDs | Sync (cleared) |

**Indexes:** `(status, primaryProductId)`, `(status, ruleType, targetProductId)`, `(status, ruleType, applyToAllProducts)`.

**CRUD:** insert/update/delete from dashboard `saveBundleRule` / `deleteBundleRule`. Storefront reads via elevated `items.query`/`get`. No storefront writes to this collection.

**BundleItem fields (inside `items.components`):** `productId`, `name`, `imageUrl`, `isPrimary`, `minQuantity`, `price`, `sku`, `defaultVariantId`, `adminLocksVariant`, `chooseVariationPerItem`.

**VolumeTier fields:** `qty`, `discountType`, `discountValue`, `title`, `imageUrl`, `imageRadius`, `imageSize`.

### Collection: `app-settings`

**Purpose:** singleton-ish settings + view counters. Seeded `initialData` one Default row.

| Field | Type | Default | Used By |
| --- | --- | --- | --- |
| `title` | TEXT | `Default` | Mapper only |
| `widgetTitle` | TEXT | `Frequently Bought Together` | **Stored but no frontend usage found** |
| `buttonLabel` | TEXT | `Add Bundle to Cart` | **Stored but no frontend usage found** |
| `showSavingsBadge` | BOOLEAN | `true` | **Stored but no frontend usage found** |
| `themeSyncEnabled` | BOOLEAN | `true` | **Stored but no frontend usage found** |
| `stockShieldEnabled` | BOOLEAN | `true` | **Stored but no frontend usage found** (SPI disabled) |
| `stockThreshold` | NUMBER | `1` | **Not wired to admin or SPI**; stock checks in widget builder use hardcoded `1` |
| `planTier` | TEXT | `FREE` | Fallback if billing unread; written on view increment |
| `monthlyViewsLimit` | NUMBER | `1000` | Copied from plan table; **not enforced** |
| `currentViewsCount` | NUMBER | `0` | Dashboard stats |
| `viewsPeriod` | TEXT | `''` | UTC `YYYY-MM` |

**Who writes:** `incrementMonthlyViews` (elevated insert/update). `saveAppSettings` exists; **no dashboard form** calls it except that increment path.

### Collection: `rule-impressions`

**Purpose:** conversion rows (not page impressions despite the name).

| Field | Type | Purpose | Used By |
| --- | --- | --- | --- |
| `bundleRuleId` | TEXT | Offer | Order event |
| `converted` | BOOLEAN | Always `true` on insert | — |
| `revenueGenerated` | NUMBER | Attributed revenue | Inserted; **no dashboard read** |
| `orderId` | TEXT | Dedup key | Lookup before insert |

**Indexes:** `bundleRuleId`, `orderId`. Dashboard **does not display** these rows (`canSeeRoi` is always true but unused in UI).

### Other storage

- Wix cart line `catalogReference.options.pbOfferId` / `pbDealId`
- Invisible Unicode offer mark in `descriptionLines.plainText`
- Embedded script parameters `{ enabled: 'true'|'false' }`
- In-memory catalog version cache
- **No** Wix Secrets / `.env` app config in repo

---

## 11. APIs

### 11.1 Wix APIs

| API | Module | How used | Auth |
| --- | --- | --- | --- |
| Data query/get/insert/update/remove | `@wix/data` `items` | Rules, settings, impressions | Dashboard identity or `auth.elevate` |
| Catalog version | `@wix/stores` `catalogVersioning.getCatalogVersion` | V1 vs V3 vs not installed | optional elevate |
| Products V1 | `products.query/get/search` | Catalog | optional elevate |
| Products V3 | `productsV3.query/search/get` | Catalog | optional elevate |
| Variants V3 | `readOnlyVariantsV3.queryVariants` | Variant lists | elevate on backend |
| Inventory V1/V3 | `inventory`, `inventoryItemsV3` | Stock flags; combo decrement | elevate for decrement |
| Collections V1 | `collections.queryCollections` | Mix collection list (legacy picker) | optional elevate |
| Categories V3 | `@wix/categories` `queryCategories`, `listItemsInCategory` | Mix collection products | optional elevate |
| Cart | `@wix/ecom` `cart`, `currentCart` | Create/get/add/update/remove, checkout from cart | visitor + elevate on APIs |
| Site eCom | `@wix/site-ecom` `ecom.refreshCart`, `openSideCart`, `navigateToCheckoutPage` | After ATC / checkout | storefront |
| Discount rules | `@wix/ecom` `discountRules` + REST `https://www.wixapis.com/ecom/v1/discount-rules` | Create/update/delete/query — **currently used to delete leftovers** | elevate |
| Custom triggers SPI | `@wix/ecom/service-plugins` `customTriggers` | Returns empty | platform |
| Validations SPI | `validations.getValidationViolations` | Returns empty | `validateInCart: false` |
| Orders event | `orders.onOrderApproved` | Attribution | event |
| App instance | `@wix/app-management` `appInstances.getAppInstance` | Billing package name | dashboard / elevate |
| Embedded scripts | `embeddedScripts.getEmbeddedScript`, `embedScript` | Cart script enabled flag | dashboard |
| Dashboard | `@wix/dashboard` toasts, `observeState` (modal), `openMediaManager` | Admin UX | dashboard |
| Editor widget props | `@wix/editor` `widget.getProp/setProp` | Custom element settings | Editor |
| Site window | `@wix/site-window` `viewMode` | Editor vs live | storefront |
| HTTP with auth | `@wix/essentials` `httpClient.fetchWithAuth` | Call own `/api/*` | signed |

**HTTP app routes**

| Function | Method | Body / query | Response | Caller |
| --- | --- | --- | --- | --- |
| `/api/storefront/offer` | GET, OPTIONS | `productId` required; `ruleType` optional; `ruleId` optional | `{ view, views }` or 204 | Widgets |
| `/api/storefront/add-discounted` | POST | `{ ruleId, lines[], cartId }` | `{ ok: true }` | Widgets |
| `/api/storefront/cart-upsell` | GET, POST, OPTIONS | `productIds` query or body (max 50) | upsell payload or 204 | Cart script |
| `/api/storefront/sync-volume-cart` | POST | `{ cartId }` | `{ ok, updated }` | Cart script |
| `/api/dashboard/discount-sync` | POST | `{ ruleId }` | `{ wixDiscountRuleId }` | `saveBundleRule` |
| `/api/dashboard/discount-sync-missing` | POST | `{}` | `{ byId, failedIds }` | Home refresh |
| `/api/dashboard/discount-remove` | POST | `{ discountRuleId }` | `{ ok: true }` | Delete offer |

CORS: allow `localhost`, `127.0.0.1`, `*.wixsite.com`, `*.wix-dev-sites.org`, `*.wix.com`. Astro `security.checkOrigin` is **off**; allowlist is in `api-response.ts`.

Error handling: 400 for validation / `CLIENT_ERRORS` set; 404 rule not found on discount-sync; 500 otherwise. Storefront GET failures log and return `undefined` (empty widget).

Retry: discount persist 2 attempts with 400ms delay; REST create after SDK fail; 500ms then find-by-name. Rule sync serialized per `ruleId`. Cart sync serialized per `cartId`. No generic HTTP retry on storefront GET.

### 11.2 External APIs

| API | Usage |
| --- | --- |
| WhatsApp `https://wa.me/923315986829` | Support button |
| `mailto:support@fmemodules.com` | Support button |
| Wix REST Discount Rules (same platform, not third-party SaaS) | Fallback create |

`@wix/crm` and `@wix/redirects` are in `package.json` but **not imported anywhere in `src/`**.

No other third-party HTTP APIs found.

---

## 12. Authentication & Authorization

| Surface | Mechanism | On failure |
| --- | --- | --- |
| Dashboard pages | Wix Dashboard session | Page does not load (platform) |
| Dashboard → `/api/dashboard/*` | `fetchWithAuth` | Toast / console; save continues with previous `wixDiscountRuleId` if sync returns undefined |
| Storefront → `/api/storefront/*` | `fetchWithAuth` (visitor) | Empty widget / ATC error message |
| PRIVILEGED CMS from APIs | `auth.elevate(items.*)` | Logged; empty rules / default settings |
| Cart write | `auth.elevate(cart.*)` | `failResponse` message to widget |
| Public vs auth | No anonymous public Data access (PRIVILEGED). Storefront never talks to CMS directly. | — |
| Role checks | None in app code | — |

---

## 13. App Lifecycle

| Event | What the code does |
| --- | --- |
| Install | Data Collection extension creates collections; `app-settings` seed row. Site plugins `installation.autoAdd: true`. Custom element `autoAdd: false`. **No** `onAppInstalled` handler in repo. |
| First dashboard open | Home loads rules (empty table empty-state) + settings views. Discount sync no-op if no `wixDiscountRuleId`. |
| First offer save | Insert `bundle-rules`; discount sync clears any Wix rule id. |
| First shopper PDP | Plugins on product slots (after merchant publishes site). Widget fetches offer API. |
| First cart visit | Upsell only if script embedded with `enabled=true` and site published. |
| Update app | `UNKNOWN — REQUIRES INVESTIGATION` (no migration scripts in repo). |
| Uninstall | `UNKNOWN — REQUIRES INVESTIGATION` (no cleanup handler). Collections/discount leftovers may remain on site — not coded. |
| Configure | Cart script toggle + per-offer save. Help modal tells merchant to publish Wix site. |

Default new offer: `status: 'ACTIVE'`, `applyToAllProducts: true`.

---

## 14. Error Handling

| Case | Admin | Frontend |
| --- | --- | --- |
| List load fail | Toast `Could not refresh offers.` | — |
| Save fail | Inline `Could not save the rule.` | — |
| Validation | Inline `validateRuleForm` strings (e.g. `Enter a title.`, `Select at least two products.`) | CTA blocked until Mix qty; ATC throws |
| Edit load fail | `Could not load this offer. Cancel and try again.` Save disabled | — |
| Delete fail | Toast `Could not delete offer.` | — |
| Status fail | Toast `Could not update status.` | — |
| Stores missing | `storesUnavailable`; empty product search | Widgets 204 / empty |
| Offer API 204/error | — | Empty widget (keep previous view on refresh error if already shown) |
| ATC fail | — | `addToCartErrorText` or default `Could not add to cart.` |
| Upsell checkout fail | — | Banner then native checkout click |
| Discount sync fail | Console; home may toast only on full refresh fail | Pricing still via overrides |
| Media Manager fail | Toast `Could not open Media Manager.` | — |
| Cart script toggle fail | Toast `Could not update the cart script.` | — |
| Order attribution fail | Console only | Order still succeeds |
| Empty offers | Table empty state + Create CTA | No widget |
| Invalid `ruleType` query | 400 `Invalid ruleType` | Empty |

---

## 15. UI/UX Behavior

**Admin**

- Home loading: centered `Loader` until first successful load with empty rules.
- Table loading keeps data; Create disabled while `loading`.
- Mutating lock (`mutating` ref) blocks overlapping delete/toggle.
- Delete: `Delete "title"? This cannot be undone.`
- Toasts: success/error as in §5.3.
- Editor error banner `#fef2f2`.
- Preview: “Live Store Preview” with device widths; not a live site iframe.
- Upsell enable toast: `Cart upsells enabled. Publish the site to apply.`
- Help modal 3 steps + Editor/Studio slot tip.

**Storefront**

- Adding state re-renders button (`Adding...` mix copy).
- Mix CTA shows `Select {{COUNT}} more` until eligible.
- Out of stock / unavailable option strings from `widgetStyle`.
- Upsell selected button uses `buyAllTagText` or `Selected ✓`.
- Volume empty product: `Volume product is unavailable.`
- Editor placeholder via `editorHtml`.

---

## 16. Wix-Specific Dependencies

| Wix capability | What it does | Where | Why required | Ecwid replacement |
| --- | --- | --- | --- | --- |
| Dashboard Page + Design System | Merchant admin | `my-page` | CRUD UX | Ecwid admin app / Control Panel iframe — **Ecwid equivalent requires further research** |
| Dashboard Modal | Legacy editor | `edit-bundle` | Unused by current nav | Skip unless needed |
| Wix Data collections | Persist rules/settings/conversions | 3 collections | App data | External DB or Ecwid extra fields — research |
| `auth.elevate` | Bypass visitor permissions | cms, cart, discounts | PRIVILEGED + cart price overrides | Server secret token |
| Stores catalog V1+V3 | Products/variants/stock | `catalog.ts` | Dual-catalog App Market rule | Ecwid Products API |
| Categories / collections | Mix pool from collection | `catalog-collections.ts` | Legacy mix source | Ecwid categories |
| eCom cart `catalogOverrideFields` | Sale price + description on line | `priced-cart-lines.ts` | Core discount UX | Ecwid discounts / custom prices — **research** |
| `currentCart` / `createCart` / side cart | Visitor cart | `widget-cart.ts` | ATC | Ecwid Cart API / JS SDK |
| `createCheckoutFromCurrentCart` + `navigateToCheckoutPage` | Upsell checkout | cart-upsell | Continue to Wix checkout | Ecwid checkout URL — research |
| Site Plugins + product slots | Auto PDP widgets | three plugins | Placement without merchant drag | Ecwid product page hooks / Gadget — research |
| Custom element + Editor panel | Place anywhere | `bundle-widget` | Alternate placement | Theme JS / app block — research |
| Embedded script BODY_END | Cart DOM + qty observer | `cart-upsell` | Cart page has no plugin slot used | Ecwid JS for cart page — research |
| `embeddedScripts.embedScript` | Enable flag | UpsellScriptCard | Toggle injection | App setting |
| Discount Rules + custom trigger SPI | Historical auto-discounts; now emptied | `wix-discount-sync`, `bundle-triggers` | Leftover cleanup | Ecwid discount engine — research |
| eCom validations SPI | Stock shield placeholder | `bundle-validate` | Disabled | Ecwid cart validation — research |
| `orders.onOrderApproved` | Conversions + combo inventory | event | Analytics / stock | Ecwid order webhook |
| App instances billing | Plan name | `plan.ts` | Future gates | Ecwid app billing |
| Media Manager | Tier images | `TierImagePicker` | Image URL | Ecwid file upload / CDN |
| `dashboard.showToast` / Media Manager | Admin chrome | editor/home | UX | Host UI |
| Site Window `viewMode` | Editor placeholder | widget | Avoid live ATC in editor | N/A or Ecwid preview |
| CORS Wix hostnames | Storefront API | `api-response.ts` | Cross-origin widgets | Ecwid storefront origins |
| Product page app IDs / slot IDs | Plugin placement | `*.extension.ts` | Wix Stores PDP | Ecwid layout |
| Invisible Unicode + `pbOfferId` | Stamp offer on lines | `offer-line-stamp.ts` | Reprice grouping | Ecwid line custom data — research |

---

## 17. Ecwid Migration Requirements

### Must Rebuild

- Four offer types with the same eligibility and pricing math
- Admin list + editor (setup + style) including copy and visual tokens
- Product-page widgets for volume / bundle / mix
- Cart upsell (trigger → suggest → add full price → checkout)
- Server-side price calculation and cart reprice for volume/mix qty changes
- Checkout-visible promo label on discounted lines
- Variant lock vs customer choice (bundles) and per-unit volume variants
- Conversion recording (optional for v1 if ROI UI still absent)
- Dual handling of “all products” vs selected products
- Exact-qty volume vs mix “highest tier”

### Wix-Specific Functionality

- Site plugin slots, custom elements, embedded scripts
- Wix Data PRIVILEGED collections
- `catalogOverrideFields` and Wix cart option stamping
- Wix Automatic Discount sync (currently a no-op clearer)
- `auth.elevate`, Dashboard SDK, Editor widget API
- Stores V1/V3 catalog branching
- App instance billing package parsing

### Platform-Dependent Functionality

- Where product widgets inject (Ecwid product page vs Wix slots)
- How cart page is detected (Wix `/cart` vs Ecwid cart URL)
- How to set a line sale price without Wix overrides
- Checkout navigation
- Inventory decrement for combo SKUs (Wix path exists for combo catalog app id; current ATC uses Stores catalog app id — combo inventory may only hit **legacy** combo lines)
- Publishing model (Wix Editor publish vs Ecwid instant)

### Unknown / Requires Research

- Ecwid APIs for custom line prices and promo labels
- Ecwid admin app extension model
- Whether Ecwid supports per-line hidden metadata (offer/deal ids)
- App billing / plan limits on Ecwid
- Cart page script injection points
- Media storage for tier images
- Whether leftover Wix Discount Rules code should be ported at all (currently unused for live pricing)

---

## 18. Wix → Ecwid Mapping

| Existing Wix Functionality | Wix Implementation | Required Ecwid Functionality | Migration Notes |
| --- | --- | --- | --- |
| Admin settings / offers | Dashboard page + editor | Ecwid admin app | Rebuild UI |
| Product widgets | Site plugins + custom element | Storefront integration | Platform-specific slots |
| Cart upsell | Embedded script + DOM hooks | Cart page JS | Selectors are Wix `data-hook`s — will not work on Ecwid |
| Data storage | Wix Data 3 collections | External DB / Ecwid storage | Research required |
| Catalog | Stores V1/V3 | Ecwid Products | Map ids, variants, stock |
| Discounted ATC | Elevated `addToCart` + overrides | Custom price lines | Confirmed Wix; Ecwid unknown |
| Volume reprice | `syncVolumeCart` | Cart update API | Need qty-change hook |
| Checkout | site-ecom navigate | Ecwid checkout | Research |
| Conversions | `onOrderApproved` | Order webhook | Research |
| Script enable | `embeddedScripts` | App config | Research |
| Auth | Wix signed `fetchWithAuth` + elevate | App secret / server | Different model |
| Design system | `@wix/design-system` | Any admin UI kit | Visual parity optional |
| Billing plans | `appInstances` | Ecwid billing | Feature locks not enforced today |
| Media | Media Manager | Ecwid images | Research |

---

## 19. Proposed Ecwid Architecture

### Confirmed from existing Wix implementation

- Source of truth is **per-offer documents** (not only global settings).
- Storefront is **read-only** against CMS; writes go through **authenticated backend**.
- Shopper never sends sale prices; server recomputes.
- Product-page offers and cart upsell are **separate surfaces**.
- Cart upsell does **not** discount.
- Volume deals are **exact quantity**; mix is **tier threshold**.
- Multiple product-page offers can stack as sibling widgets.
- Style is CSS-variable driven from `widgetStyle`.

### Proposed Ecwid architecture

*(Assumption — not present in this repo.)*

| Concern | Proposal |
| --- | --- |
| Admin | Ecwid Custom App Control Panel page listing offers + editor |
| Storefront | Ecwid JS Gadget or theme modification on product and cart |
| Backend | App server (Node) holding rules (Postgres/Mongo) + REST for storefront |
| Auth | Ecwid OAuth; server uses store token for Products/Cart/Orders |
| Settings | Store-level: script on/off; Offer-level: same fields as `BundleRule` |
| Webhooks | `order.created` / paid for attribution |
| Product-level | Target product IDs on the offer, not Wix PDP slots |
| Customer | No membership logic in Wix app — guest cart is enough |

Do not treat this table as implemented fact.

---

## 20. Features That Cannot Be Directly Migrated

- Wix product-page **slot IDs** and Stores app definition IDs
- `catalogOverrideFields` + Unicode description stamping
- Wix Editor `viewMode` and custom-element stretch
- `embeddedScripts` parameter templating `{{enabled}}`
- Dual Stores catalog V1/V3
- Wix Automatic Discount SPI (already unused for live prices)
- `@wix/design-system` pixel-identical admin
- Dashboard Media Manager
- CORS allowlist of Wix hostnames
- `ecom.openSideCart` / `navigateToCheckoutPage`
- Combo line `appId === APP_ID` inventory path (current ATC uses Stores catalog app id)

---

## 21. Unknowns / Research Required

| Item | What was found | Why unclear | Files | Needed |
| --- | --- | --- | --- | --- |
| Dev Center permission list | APIs called in code | Scopes not in repo | `package.json`, lib/* | Export from Wix Dev Center |
| Uninstall cleanup | No handler | Platform may drop collections | — | Wix + Ecwid lifecycle docs |
| Whether `enabled=false` still loads cart-upsell.ts | HTML always has script tag; JS gates upsell only | Volume sync may still run | `cart-upsell.html`, `cart-upsell.ts` | Test on a site |
| ROI dashboard | Impressions written, never listed | Future feature? | `impressions.ts`, `ViewsStats.tsx` | Product decision |
| Dead `syncTieredDiscount` | Implemented, not called from `runBundleDiscountSync` | Historical Automatic Discounts | `wix-discount-sync.ts` | Confirm do-not-port |
| `CollectionPicker` | Exists, unused by page editor | Mix collection still in data model | `CollectionPicker.tsx`, `rules.ts` | Support old rows only vs rebuild picker |
| `edit-bundle` modal | Registered, never opened | Dead UX | `edit-bundle.tsx`, `collections.ts` | Don’t migrate unless needed |
| `@wix/crm`, `@wix/redirects` | Dependencies only | Unused | `package.json` | Don’t migrate |
| Ecwid line-item custom price | — | Not in this repo | — | Ecwid API research |
| Currency / tax | `formatMoney` is `$` + 2 decimals | No Wix currency API usage found | `pricing.ts` | Multi-currency on Ecwid |
| Theme “publish” requirement | Help text + upsell toast | Exact Wix publish vs Preview | `HelpCard.tsx` | Ecwid equivalent |
| View limit enforcement | Comment “deferred” | When it will ship | `cms.ts`, `plan.ts` | Product decision |
| Stock shield | Comment “until storefront settings ship again” | Disabled | `bundle-validate.ts` | Product decision |

---

## 22. Migration Checklist

- [ ] Reproduce `BundleRule` data model (including `widgetStyle` and `volumeTiers`)
- [ ] Admin: list, filter, create 4 types, edit, pause, delete, validation messages
- [ ] Quantity break: all vs selected products, exact qty tiers, optional per-unit variants, layout
- [ ] Bundle: ≥2 products, primary, min qty, variant lock, four discount modes
- [ ] Mix: 2–25 pool, 1–5 increasing tiers, summary + `{{COUNT}}` CTA
- [ ] Cart upsell: triggers, suggestions, script/on flag, intercept checkout, no discount
- [ ] Server pricing + eligibility identical to `price-lines-for-rule.ts` / `pricing.ts`
- [ ] Cart qty change reprice for volume (exact) and mix (best tier); don’t steal fixed-bundle lines
- [ ] Promo label on cart/checkout lines
- [ ] Product-page injection strategy on Ecwid
- [ ] Cart-page injection strategy on Ecwid
- [ ] Catalog + variants + stock mapping
- [ ] Order webhook attribution (if keeping ROI later)
- [ ] Decide: drop Wix Automatic Discount port
- [ ] Decide: drop unused app-settings fields or wire them
- [ ] Multi-currency / taxes research
- [ ] Replace Wix `data-hook` cart selectors
- [ ] Auth model (no `elevate`)
- [ ] QA matrix: V1-equivalent Ecwid catalog; guest cart; variant products; overlapping offers

---

## 23. File-by-File Reference

| File | Responsibility | Admin/Frontend/Backend | Important Functions |
| --- | --- | --- | --- |
| `src/extensions.ts` | Register extensions | App | `app().use(...)` |
| `wix.config.json` | App identity | Config | — |
| `astro.config.mjs` | Server, CORS, Wix adapter | Config | — |
| `package.json` | Dependencies | Config | — |
| `src/lib/types.ts` | Domain types | Shared | `BundleRule`, `WidgetStyle` |
| `src/lib/collections.ts` | IDs, collection names | Shared | `COLLECTIONS`, `APP_ID` |
| `src/lib/rules.ts` | Rule CRUD + empty draft | Admin + Backend | `saveBundleRule`, `findActiveRulesForProduct` |
| `src/lib/settings.ts` | Settings load/save | Backend + Admin | `loadAppSettings`, `currentViewsPeriod` |
| `src/lib/mappers.ts` | CMS → domain | Shared | `toBundleRule`, `DEFAULT_SETTINGS` |
| `src/lib/rule-placement.ts` | PDP visibility | Backend | `ruleShowsOnProductPage` |
| `src/lib/bundle-eligibility.ts` | Cart/order eligibility | Backend | `isRuleEligible`, mix/volume/upsell helpers |
| `src/lib/pricing.ts` | Money math | Shared | `bundleLineSale`, `exactVolumeUnitPrice` |
| `src/lib/discount.ts` | Types, clamp, option labels | Admin | `clampDiscountValue` |
| `src/lib/volume-tiers.ts` | Tier parse/defaults | Shared | `exactVolumeTier`, `bestVolumeTier` |
| `src/lib/widget-style.ts` | Style defaults/parse | Shared | `defaultWidgetStyle`, `parseWidgetStyle` |
| `src/lib/widget-style-css.ts` | CSS variables | Frontend | `widgetStyleCssVars` |
| `src/lib/storefront-style.ts` | Legacy copy + color parse | Shared | `checkoutCtaLabel` |
| `src/lib/mix-match-copy.ts` | Mix copy/style defaults | Shared | `mixCtaLabel` |
| `src/lib/cart-upsell-style.ts` | Upsell style defaults | Shared | `UPSELL_STYLE_DEFAULTS` |
| `src/lib/discount-label.ts` | Checkout label | Backend | `discountDisplayName` |
| `src/lib/rule-labels.ts` | Admin labels | Admin | `ruleTypeLabel` |
| `src/lib/plan.ts` | Billing → tier, unused gates | Backend | `getEffectivePlan`, `viewLimitForPlan` |
| `src/lib/impressions.ts` | Conversion rows | Backend | `insertConversion` |
| `src/lib/order-attribution.ts` | Order approved logic | Backend | `attributeApprovedOrder` |
| `src/lib/catalog.ts` | Products/variants/stock | Shared | `getCatalogProduct`, `getVersion` |
| `src/lib/catalog-auth.ts` | Optional elevate wrap | Backend | `wrapCatalogFn` |
| `src/lib/catalog-map.ts` | V1/V3 product map | Backend | `mapV1Product`, `mapV3Product` |
| `src/lib/catalog-variants.ts` | Variant mapping | Backend | `mapV1Variants` |
| `src/lib/catalog-collections.ts` | Categories/collections | Backend | `listProductIdsInCollection` |
| `src/lib/bundle-items.ts` | Parse wrap items | Shared | `parseBundleItems` |
| `src/lib/bundle-combo-line.ts` | Combo parts / parse order lines | Shared | `buildComboParts`, `parseComboLine` |
| `src/lib/bundle-volume-line.ts` | Volume parts | Frontend | `buildVolumeParts` |
| `src/lib/bundle-variant-units.ts` | Per-unit variant keys | Frontend | `primeVolumeVariantUnits` |
| `src/lib/bundle-inventory.ts` | Decrement stock | Backend | `decrementComboInventory` |
| `src/lib/widget-view.ts` | Fetch offer views | Frontend | `loadWidgetViews`, `resolveProductId` |
| `src/lib/widget-cart.ts` | ATC + checkout nav | Frontend | `addDiscountedCatalogLines`, `goToWixCheckout` |
| `src/lib/storefront-client.ts` | Authenticated HTTP | FE+Admin | `storefrontGet/Post` |
| `src/lib/dashboard-discount-client.ts` | Discount API client | Admin | `syncRuleDiscountRemote` |
| `src/lib/wix-discount-sync.ts` | Clear/upsert Wix discounts | Backend | `syncBundleDiscount` |
| `src/lib/price-lines-for-rule.ts` | Server ATC pricing | Backend | `priceLinesForRule` |
| `src/lib/priced-cart-lines.ts` | Override payload | Backend | `overrideCatalogLineItems` |
| `src/lib/offer-line-stamp.ts` | pbOfferId / Unicode mark | Backend | `encodeOfferMark` |
| `src/lib/volume-cart-sync.ts` | Reprice cart | Backend | `syncVolumeCart` |
| `src/lib/volume-cart-apply.ts` | Apply line plans | Backend | `applyLinePlans` |
| `src/lib/volume-cart-snap.ts` | Cart snapshot helpers | Backend | — |
| `src/lib/volume-trigger.ts` | `{id}__q{qty}` | Backend (unused live SPI) | `volumeTriggerId` |
| `src/lib/cart-lines.ts` | Line qty aggregation | Shared | `lineItemsToCartQty` |
| `src/lib/cart-catalog-lines.ts` | Parse cart for sync | Backend | `parseCartCatalogLines` |
| `src/lib/cart-id.ts` | Extract cart id | Shared | `cartIdFrom` |
| `src/lib/cart-upsell-ui.ts` | Upsell HTML/CSS types | Frontend | `cartUpsellMarkup` |
| `src/lib/cart-upsell.css.ts` | Upsell CSS | Frontend | `CART_UPSELL_CSS` |
| `src/lib/api-response.ts` | JSON/CORS/errors | Backend | `jsonResponse`, `failResponse` |
| `src/lib/guards.ts` | asString/asNumber | Shared | — |
| `src/lib/html.ts` | escape, slug | Frontend | `slugFromPath` |
| `src/lib/product-image.ts` | Wix image URLs | Admin+FE | `toHttpImageUrl` |
| `src/lib/display-on.ts` | PRIMARY/ALL_ITEMS | Shared | `asDisplayOn` |
| `src/lib/data-pages.ts` | Paginate queries | Backend | `collectQueryPages` |
| `src/lib/offer-cart-qty.ts` | Qty keys | Backend | — |
| `src/lib/widget-html.ts` | Shared HTML helpers | Frontend | — |
| `src/lib/bundle-markup.ts` / `mix-match-markup.ts` | Markup builders | Frontend | — |
| `src/lib/storefront-copy.ts` | Copy helpers | Shared | — |
| `src/extensions/backend/cms.ts` | Elevated CMS/plan/views | Backend | `incrementMonthlyViews` |
| `src/extensions/backend/build-widget-view.ts` | Offer payload | Backend | `buildStorefrontWidgetViews` |
| `src/extensions/backend/build-cart-upsell.ts` | Upsell payload | Backend | `buildCartUpsellView` |
| `src/extensions/backend/data-collections/*` | Schemas | Backend | collection field lists |
| `src/extensions/backend/service-plugins/bundle-triggers/*` | Empty triggers | Backend | `listTriggers` |
| `src/extensions/backend/service-plugins/bundle-validate/*` | Empty violations | Backend | `getValidationViolations` |
| `src/extensions/backend/events/order-attribution/*` | Order webhook | Backend | `onOrderApproved` |
| `src/pages/api/storefront/offer.ts` | GET offer | Backend | `GET` |
| `src/pages/api/storefront/add-discounted.ts` | POST ATC | Backend | `POST` |
| `src/pages/api/storefront/cart-upsell.ts` | GET/POST upsell | Backend | — |
| `src/pages/api/storefront/sync-volume-cart.ts` | POST sync | Backend | — |
| `src/pages/api/dashboard/discount-sync.ts` | POST sync one | Backend | — |
| `src/pages/api/dashboard/discount-sync-missing.ts` | POST sync all | Backend | — |
| `src/pages/api/dashboard/discount-remove.ts` | POST delete discounts | Backend | — |
| `src/extensions/dashboard/pages/my-page/my-page.tsx` | Home/editor shell | Admin | `DashboardPage` |
| `src/extensions/dashboard/pages/my-page/my-page.extension.ts` | Page registration | Admin | — |
| `src/extensions/dashboard/pages/my-page/home/DashboardHome.tsx` | Home logic | Admin | `refresh`, `handleDelete` |
| `src/extensions/dashboard/pages/my-page/home/OffersTable.tsx` | Table UI | Admin | filters |
| `src/extensions/dashboard/pages/my-page/home/CreateOfferModal.tsx` | Type picker | Admin | — |
| `src/extensions/dashboard/pages/my-page/home/ViewsStats.tsx` | View counts | Admin | — |
| `src/extensions/dashboard/pages/my-page/home/HelpCard.tsx` | Guide modal | Admin | — |
| `src/extensions/dashboard/pages/my-page/home/offer-columns.ts` | Table labels | Admin | `formatDiscount` |
| `src/extensions/dashboard/pages/my-page/SupportWidget.tsx` | Support | Admin | — |
| `src/extensions/dashboard/pages/my-page/editor/OfferEditor.tsx` | Save/load | Admin | `handleSave` |
| `src/extensions/dashboard/pages/my-page/editor/editor-draft.ts` | Draft mapping | Admin | `blankDraft`, `draftFromRule` |
| `src/extensions/dashboard/pages/my-page/editor/editor-types.ts` | Draft types | Admin | — |
| `src/extensions/dashboard/pages/my-page/editor/EditorSetup.tsx` | Tab 1 composition | Admin | — |
| `src/extensions/dashboard/pages/my-page/editor/EditorStyle.tsx` | Tab 2 router | Admin | — |
| `src/extensions/dashboard/pages/my-page/editor/EditorDetails.tsx` | Title, labels, placement | Admin | — |
| `src/extensions/dashboard/pages/my-page/editor/EditorTargeting.tsx` | Volume products | Admin | — |
| `src/extensions/dashboard/pages/my-page/editor/EditorLayout.tsx` | Volume layout | Admin | — |
| `src/extensions/dashboard/pages/my-page/editor/EditorVariations.tsx` | Volume variants flag | Admin | — |
| `src/extensions/dashboard/pages/my-page/editor/EditorDiscount.tsx` | Bundle discount | Admin | — |
| `src/extensions/dashboard/pages/my-page/editor/EditorCopy.tsx` | Copy fields | Admin | — |
| `src/extensions/dashboard/pages/my-page/editor/EditorMixCopy.tsx` | Mix copy | Admin | — |
| `src/extensions/dashboard/pages/my-page/editor/EditorBundleProducts.tsx` | Bundle lines | Admin | — |
| `src/extensions/dashboard/pages/my-page/editor/BundleItemCard.tsx` | Per-item controls | Admin | — |
| `src/extensions/dashboard/pages/my-page/editor/EditorMixMatchPool.tsx` | Mix pool | Admin | — |
| `src/extensions/dashboard/pages/my-page/editor/EditorMixMatchRules.tsx` | Mix tiers | Admin | — |
| `src/extensions/dashboard/pages/my-page/editor/VolumeTiersEditor.tsx` | Volume tiers | Admin | — |
| `src/extensions/dashboard/pages/my-page/editor/EditorUpsellProducts.tsx` | Triggers/suggestions | Admin | — |
| `src/extensions/dashboard/pages/my-page/editor/UpsellScriptCard.tsx` | Script toggle | Admin | `handleToggle` |
| `src/extensions/dashboard/pages/my-page/editor/EditorBundleStyle.tsx` | Bundle design | Admin | — |
| `src/extensions/dashboard/pages/my-page/editor/EditorVolumeStyle.tsx` | Volume design + presets | Admin | — |
| `src/extensions/dashboard/pages/my-page/editor/EditorMixMatchStyle.tsx` | Mix design | Admin | — |
| `src/extensions/dashboard/pages/my-page/editor/EditorUpsellStyle.tsx` | Upsell design | Admin | — |
| `src/extensions/dashboard/pages/my-page/editor/style-fields.tsx` | Color/size controls | Admin | `SizeField`, `ColorField` |
| `src/extensions/dashboard/pages/my-page/editor/ProductPoolGrid.tsx` | Product multi-select | Admin | — |
| `src/extensions/dashboard/pages/my-page/editor/ProductSearchBar.tsx` | Product search | Admin | — |
| `src/extensions/dashboard/pages/my-page/editor/hydrate-items.ts` | Live catalog hydrate | Admin | `hydrateDraftItems` |
| `src/extensions/dashboard/pages/my-page/editor/TierImagePicker.tsx` | Media Manager | Admin | `openPicker` |
| `src/extensions/dashboard/pages/my-page/editor/PreviewFrame.tsx` | Device preview chrome | Admin | — |
| `src/extensions/dashboard/pages/my-page/editor/StorefrontPreview.tsx` | Preview router | Admin | — |
| `src/extensions/dashboard/pages/my-page/editor/BundlePreview.tsx` etc. | Type previews | Admin | — |
| `src/extensions/dashboard/modals/edit-bundle/*` | Legacy modal | Admin (unused nav) | `validateRuleForm` **also used by page editor** |
| `src/extensions/dashboard/modals/edit-bundle/edit-bundle-form.ts` | Shared validation | Admin | `validateRuleForm` |
| `src/extensions/site/widgets/bundle-widget/bundle-widget.tsx` | PDP widget | Frontend | `refresh`, `addFixed/Volume/Mix` |
| `src/extensions/site/widgets/bundle-widget/bundle-widget.extension.ts` | Custom element config | Frontend | — |
| `src/extensions/site/widgets/bundle-widget/bundle-widget.panel.tsx` | Editor settings | Admin (Editor) | `product-id`, `rule-type` |
| `src/extensions/site/widgets/bundle-widget/widget-markup.ts` | HTML | Frontend | `fixedBundleHtml` |
| `src/extensions/site/widgets/bundle-widget/widget-shell.ts` | Bindings | Frontend | `primeSelections` |
| `src/extensions/site/widgets/bundle-widget/mix-match-bind.ts` | Mix controls | Frontend | `bindMixControls` |
| `src/extensions/site/plugins/*/ *.extension.ts` | Auto slots | Frontend | placements |
| `src/extensions/site/plugins/*/*.tsx` | Subclass widgets | Frontend | force `rule-type` |
| `src/extensions/site/plugins/offer-plugin-panel.tsx` | Shared panel copy | Editor | — |
| `src/extensions/site/embedded-scripts/cart-upsell/cart-upsell.ts` | Cart entry | Frontend | `runCartUpsell`, `checkoutSelected` |
| `src/extensions/site/embedded-scripts/cart-upsell/cart-upsell.html` | Config + script | Frontend | `data-enabled` |
| `src/extensions/site/embedded-scripts/cart-upsell/cart-upsell.extension.ts` | BODY_END | Frontend | — |
| `src/extensions/site/embedded-scripts/cart-upsell/cart-upsell-mount.ts` | DOM mount / checkout intercept | Frontend | `cartPageLooksLikely` |
| `src/extensions/site/embedded-scripts/cart-upsell/cart-upsell-bind.ts` | Clicks/state paint | Frontend | `paintUpsell` |
| `src/extensions/site/embedded-scripts/cart-upsell/cart-upsell-offers.ts` | Filter offers | Frontend | `visibleCartUpsellOffers` |
| `src/extensions/site/embedded-scripts/cart-upsell/volume-cart-bind.ts` | Qty observer | Frontend | `startVolumeCartSync` |
| `public/*.svg` `bundle-widget-thumbnail.png` | Logos/thumbs | Assets | — |

CSS modules (`offer-editor.module.css`, `mix-editor.module.css`, `bundle-widget.module.css`, `mix-match.module.css`) are presentation only.

---

## 24. Final Summary

This Wix app lets a store merchant create **quantity breaks**, **fixed bundles**, **mix-and-match pools**, and **cart upsells**. Configuration lives almost entirely on each **bundle-rules** row (`widgetStyle`, products, tiers). The storefront shows auto-inserted product-page widgets and, if enabled and published, a cart recommendations block.

Discounts for bundle / mix / quantity are applied by **server-computed sale prices on cart lines**, not by live Wix Automatic Discounts (those are cleared). Cart upsell adds full-price catalog items. Volume and mix prices can be **re-synced** when cart quantity changes. Conversions are stored on order approval but **not shown** in the dashboard. Several `app-settings` fields and the discount/validation SPIs are **dormant**.

For Ecwid, rebuild the offer model, admin editor, product-page and cart UIs, and the pricing/eligibility engine. Replace every Wix placement, auth, catalog, and cart-override mechanism after researching Ecwid’s cart and storefront extension APIs. Do not assume a 1:1 equivalent for `catalogOverrideFields`, site plugins, or elevated Wix Data.
