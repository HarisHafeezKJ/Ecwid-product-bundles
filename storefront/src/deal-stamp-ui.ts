import { PB_DEAL_TEXT_OPTION } from '@pb/shared';

const HIDE_CSS = `
.product-details__option:has([name="${PB_DEAL_TEXT_OPTION}"]),
.product-details__option:has([id="${PB_DEAL_TEXT_OPTION}"]),
.product-details__option:has([id*="${PB_DEAL_TEXT_OPTION}"]),
.product-details__options-row:has([name*="${PB_DEAL_TEXT_OPTION}"]),
.details-product-option:has([name="${PB_DEAL_TEXT_OPTION}"]),
.details-product-option:has([name*="${PB_DEAL_TEXT_OPTION}"]),
.ecwid-productOption[data-name="${PB_DEAL_TEXT_OPTION}"],
.ecwid-productOption[data-option-name="${PB_DEAL_TEXT_OPTION}"],
.ec-cart-option[data-option-name="${PB_DEAL_TEXT_OPTION}"],
.product-details-module__option:has(input[name*="${PB_DEAL_TEXT_OPTION}"]),
.product-details-module__option:has(textarea[name*="${PB_DEAL_TEXT_OPTION}"]),
label[for="${PB_DEAL_TEXT_OPTION}"],
label[for*="${PB_DEAL_TEXT_OPTION}"] {
  display: none !important;
}
`;

const STYLE_ID = 'pb-deal-stamp-hide';

function labelMatchesDealStamp(text: string | null | undefined): boolean {
  const normalized = (text ?? '').trim().toLowerCase();
  return normalized === PB_DEAL_TEXT_OPTION.toLowerCase() || normalized === '_pbdeal';
}

function hideElement(node: Element | null | undefined): void {
  if (node instanceof HTMLElement) node.style.display = 'none';
}

/** Hide the internal `_pbDeal` option Ecwid renders on PDP/cart — shoppers never fill this in. */
export function hideDealStampFields(root: ParentNode = document): void {
  const inputs = root.querySelectorAll<HTMLElement>(
    `input[name="${PB_DEAL_TEXT_OPTION}"], input[name*="${PB_DEAL_TEXT_OPTION}"], textarea[name="${PB_DEAL_TEXT_OPTION}"], textarea[name*="${PB_DEAL_TEXT_OPTION}"]`,
  );
  for (const input of inputs) {
    hideElement(
      input.closest('.product-details__option') ??
        input.closest('.details-product-option') ??
        input.closest('.ecwid-productOption') ??
        input.closest('.product-details-module__option') ??
        input.closest('.ec-cart-option') ??
        input.parentElement,
    );
  }

  const labels = root.querySelectorAll<HTMLLabelElement>('label');
  for (const label of labels) {
    const text = label.textContent ?? '';
    const forAttr = label.getAttribute('for') ?? '';
    if (labelMatchesDealStamp(text) || forAttr.includes(PB_DEAL_TEXT_OPTION)) {
      hideElement(
        label.closest('.product-details__option') ??
          label.closest('.details-product-option') ??
          label.closest('.ecwid-productOption') ??
          label.closest('.product-details-module__option') ??
          label.parentElement,
      );
    }
  }
}

function injectHideStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = HIDE_CSS;
  document.head.appendChild(style);
}

/** Keeps `_pbDeal` hidden as Instant Site / Ecwid hydrate product and cart DOM. */
export function startDealStampUiGuard(): () => void {
  injectHideStyles();
  hideDealStampFields();

  const observer = new MutationObserver(() => hideDealStampFields());
  observer.observe(document.documentElement, { childList: true, subtree: true });

  const interval = window.setInterval(() => hideDealStampFields(), 2000);

  return () => {
    observer.disconnect();
    window.clearInterval(interval);
  };
}
