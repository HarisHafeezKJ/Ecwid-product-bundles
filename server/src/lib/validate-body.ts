import { z } from 'zod';
import { isRuleType } from '@pb/shared';

const ruleTypeSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value && isRuleType(value) ? value : undefined));

export const offerBodySchema = z.object({
  productId: z.string().trim().min(1, 'productId is required'),
  ruleId: z.string().trim().optional(),
  ruleType: ruleTypeSchema,
  publicToken: z.string().trim().optional(),
  storeId: z.union([z.string(), z.number()]).optional(),
});

export const discountedLineSchema = z.object({
  productId: z.string().trim().min(1),
  quantity: z.coerce.number().int().positive().max(999),
  variantId: z.string().trim().optional(),
});

export const addDiscountedBodySchema = z.object({
  ruleId: z.string().trim().min(1, 'ruleId is required'),
  cartId: z.string().trim().optional(),
  lines: z.array(discountedLineSchema).min(1, 'lines is required'),
  publicToken: z.string().trim().optional(),
  storeId: z.union([z.string(), z.number()]).optional(),
});

export const cartLineSnapshotSchema = z.object({
  lineId: z.string().trim().optional(),
  productId: z.string().trim().min(1),
  variantId: z.string().trim().optional(),
  quantity: z.coerce.number().int().nonnegative(),
  unitPrice: z.coerce.number().nonnegative(),
  catalogPrice: z.coerce.number().nonnegative(),
  offerId: z.string().trim().optional(),
  dealId: z.string().trim().optional(),
  options: z.record(z.string()).optional(),
});

export const syncVolumeCartBodySchema = z.object({
  cartId: z.string().trim().optional(),
  publicToken: z.string().trim().optional(),
  storeId: z.union([z.string(), z.number()]).optional(),
  lines: z.array(cartLineSnapshotSchema).min(1, 'lines is required'),
});

type ParseResult<T> = { ok: true; data: T } | { ok: false; error: string };

function formatZodError(err: z.ZodError): string {
  return err.issues.map((issue) => issue.message).join('; ');
}

export function parseOfferBody(body: unknown): ParseResult<z.infer<typeof offerBodySchema>> {
  const merged =
    body && typeof body === 'object'
      ? body
      : {};
  const parsed = offerBodySchema.safeParse(merged);
  if (!parsed.success) return { ok: false, error: formatZodError(parsed.error) };
  return {
    ok: true,
    data: {
      ...parsed.data,
      ruleId: parsed.data.ruleId || undefined,
      publicToken: parsed.data.publicToken || undefined,
    },
  };
}

export function parseAddDiscountedBody(
  body: unknown,
): ParseResult<z.infer<typeof addDiscountedBodySchema>> {
  const parsed = addDiscountedBodySchema.safeParse(body ?? {});
  if (!parsed.success) return { ok: false, error: formatZodError(parsed.error) };
  return { ok: true, data: parsed.data };
}

export function parseSyncVolumeCartBody(
  body: unknown,
): ParseResult<z.infer<typeof syncVolumeCartBodySchema>> {
  const parsed = syncVolumeCartBodySchema.safeParse(body ?? {});
  if (!parsed.success) return { ok: false, error: formatZodError(parsed.error) };
  return { ok: true, data: parsed.data };
}
