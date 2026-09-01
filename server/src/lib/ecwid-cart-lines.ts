import type { PricedLine } from '@pb/shared';

export interface EcwidCartLinePayload {
  productId: number;
  quantity: number;
  options?: Record<string, string>;
  selectedPrice?: number;
}

/** Maps server-priced lines to Ecwid storefront JS `Cart.addProduct` payloads. */
export function pricedLinesToEcwidCartLines(priced: PricedLine[]): EcwidCartLinePayload[] {
  return priced.map((line) => ({
    productId: Number(line.productId),
    quantity: line.quantity,
    ...(line.options && Object.keys(line.options).length > 0 ? { options: line.options } : {}),
    selectedPrice: line.unitPrice,
  }));
}
