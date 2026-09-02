import { PB_DEAL_TEXT_OPTION } from '@pb/shared';

const HIDE_CSS = `
.product-details__option:has([name="${PB_DEAL_TEXT_OPTION}"]),
.product-details__option:has([id="${PB_DEAL_TEXT_OPTION}"]),
.product-details__option:has([id*="${PB_DEAL_TEXT_OPTION}"]),
.details-product-option:has([name="${PB_DEAL_TEXT_OPTION}"]),
.ecwid-productOption[data-name="${PB_DEAL_TEXT_OPTION}"],
.ec-cart-option[data-option-name="${PB_DEAL_TEXT_OPTION}"],
label[for="${PB_DEAL_TEXT_OPTION}"],
label[for*="${PB_DEAL_TEXT_OPTION}"] {
  display: none !important;
}
`;

/** Hide the internal deal-stamp option Ecwid renders on PDP/cart — shoppers never fill this in. */
export function hideDealStampFields(root: ParentNode = document): void {
  const labelMatches = (text: string | null | undefined): boolean =>
    text?.trim() === PB_DEAL_TEXT_OPTION;

  root.querySelectorAll('label, legend, .product-details__option-title, .ec-form__label').forEach((el) => {
    if (!labelMatches(el.textContent)) return;
    const host =
      el.closest('.product-details__option') ??
      el.closest('.details-product-option') ??
      el.closest('.ec-form__row') ??
      el.parentElement;
    if (host instanceof HTMLElement) host.hidden = true;
  });

  root
    .querySelectorAll<HTMLElement>(
      `[name="${PB_DEAL_TEXT_OPTION}"], [id="${PB_DEAL_TEXT_OPTION}"], [data-name="${PB_DEAL_TEXT_OPTION}"]`,
    )
    .forEach((input) => {
      const host =
        input.closest('.product-details__option') ??
        input.closest('.details-product-option') ??
        input.closest('.ec-form__row') ??
        input.parentElement;
      if (host instanceof HTMLElement) host.hidden = true;
    });
}

let guardStarted = false;

export function startDealStampUiGuard(injectStyles: (id: string, css: string) => void): void {
  if (guardStarted) return;
  guardStarted = true;

  injectStyles('pb-deal-stamp-hide', HIDE_CSS);
  hideDealStampFields();

  const observer = new MutationObserver(() => hideDealStampFields());
  observer.observe(document.body, { childList: true, subtree: true });
}
