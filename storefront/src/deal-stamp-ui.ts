import { PB_DEAL_TEXT_OPTION } from '@pb/shared';

const STYLE_ID = 'pb-deal-stamp-hide';

/** Ecwid Instant Site renders TEXT options as `name="text"` with label "Enter your text". */
const HIDE_CSS = `
.product-details__option:has([name="${PB_DEAL_TEXT_OPTION}"]),
.product-details__option:has([name="text"][data-option-name="${PB_DEAL_TEXT_OPTION}"]),
.details-product-option:has([name="${PB_DEAL_TEXT_OPTION}"]),
.ecwid-productOption[data-name="${PB_DEAL_TEXT_OPTION}"],
.ec-cart-option[data-option-name="${PB_DEAL_TEXT_OPTION}"] {
  display: none !important;
}
`;

function hideElement(node: Element | null | undefined): void {
  if (node instanceof HTMLElement) node.style.display = 'none';
}

function isLegacyDealStampInput(input: HTMLInputElement | HTMLTextAreaElement): boolean {
  const name = input.getAttribute('name') ?? '';
  if (name === PB_DEAL_TEXT_OPTION || name.includes(PB_DEAL_TEXT_OPTION)) return true;
  if (input.getAttribute('data-option-name') === PB_DEAL_TEXT_OPTION) return true;

  const block = input.closest('.product-details__option, .details-product-option, .ecwid-productOption');
  const labelText = block?.querySelector('label')?.textContent?.trim().toLowerCase() ?? '';
  if (labelText === PB_DEAL_TEXT_OPTION.toLowerCase() || labelText === '_pbdeal') return true;

  // Legacy `_pbDeal` used title " " — Instant Site shows "Enter your text" for empty title.
  if (name === 'text' && labelText === 'enter your text' && !input.value.trim()) {
    const optionRoot = block ?? input.parentElement;
    const hasSizeOption = !!optionRoot
      ?.closest('.product-details__options, .details-product-options, form')
      ?.querySelector('[name="Size"], [data-option-name="Size"], .product-details__option--size');
    return !!hasSizeOption;
  }

  return false;
}

/** Hide leftover internal deal-stamp options until catalog cleanup removes them. */
export function hideDealStampFields(root: ParentNode = document): void {
  const fields = root.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
    `input[name="${PB_DEAL_TEXT_OPTION}"], input[name*="${PB_DEAL_TEXT_OPTION}"], textarea[name="${PB_DEAL_TEXT_OPTION}"], input[name="text"], textarea[name="text"]`,
  );
  for (const input of fields) {
    if (!isLegacyDealStampInput(input)) continue;
    hideElement(
      input.closest('.product-details__option') ??
        input.closest('.details-product-option') ??
        input.closest('.ecwid-productOption') ??
        input.closest('.product-details-module__option') ??
        input.closest('.ec-cart-option') ??
        input.parentElement,
    );
  }
}

function injectHideStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = HIDE_CSS;
  document.head.appendChild(style);
}

/** Keeps legacy `_pbDeal` hidden while Ecwid hydrates product/cart DOM. */
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
