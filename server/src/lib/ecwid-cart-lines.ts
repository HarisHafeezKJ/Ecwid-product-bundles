import type { PricedLine } from '@pb/shared';
import { PB_DEAL_OPTION, PB_KIND_OPTION, PB_OFFER_OPTION } from '@pb/shared';

export interface EcwidCartLinePayload {
  productId: number;
  quantity: number;
  options?: Record<string, string>;
  selectedPrice?: number;
}

const STAMP_KEYS = new Set([PB_OFFER_OPTION, PB_DEAL_OPTION, PB_KIND_OPTION]);

/** Ecwid product options only — pb stamp keys are not real product options. */
export function stripStampOptions(options?: Record<string, string>): Record<string, string> | undefined {
  if (!options) return undefined;
  const stripped: Record<string, string> = {};
  for (const [key, value] of Object.entries(options)) {
    if (!STAMP_KEYS.has(key) && value) stripped[key] = value;
  }
  return Object.keys(stripped).length > 0 ? stripped : undefined;
}

/**
 * Maps server-priced lines to Ecwid storefront JS `Cart.addProduct` payloads.
 *
 * We deliberately do NOT set `selectedPrice`. Ecwid's storefront JS re-validates every cart
 * line after each mutation and, when a line's `selectedPrice` is below `productPrice`
 * without Pay-What-You-Want enabled and cached in the page, it drops the line with
 * "Product X is removed from cart as its price has increased." The bundle discount is
 * applied at the cart level through the `customize_cart_calculation` webhook
 * (`/api/webhooks/discount`) — that's the supported path for discounted lines that Ecwid
 * won't second-guess.
 */
export function pricedLinesToEcwidCartLines(priced: PricedLine[]): EcwidCartLinePayload[] {
  return priced.map((line) => {
    const options = stripStampOptions(line.options);
    return {
      productId: Number(line.productId),
      quantity: line.quantity,
      ...(options ? { options } : {}),
    };
  });
}
