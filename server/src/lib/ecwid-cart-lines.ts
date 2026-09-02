import type { PricedLine } from '@pb/shared';
import { ecwidCartOptions } from '@pb/shared';

export interface EcwidCartLinePayload {
  productId: number;
  quantity: number;
  options?: Record<string, string>;
  selectedPrice?: number;
}

/** @deprecated Use ecwidCartOptions from @pb/shared */
export function stripStampOptions(options?: Record<string, string>): Record<string, string> | undefined {
  return ecwidCartOptions(options);
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
 *
 * Variant options plus an invisible deal stamp embedded at add-to-cart from offer widgets.
 */
export function pricedLinesToEcwidCartLines(priced: PricedLine[]): EcwidCartLinePayload[] {
  return priced.map((line) => {
    const options = ecwidCartOptions(line.options);
    return {
      productId: Number(line.productId),
      quantity: line.quantity,
      ...(options ? { options } : {}),
    };
  });
}
