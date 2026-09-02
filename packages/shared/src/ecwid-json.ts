export interface DecodeEcwidJsonOptions {
  maxDepth?: number;
}

/**
 * Unwrap Ecwid nested JSON (string JSON, repeated stringification, or `{ value }` envelopes).
 * Used by Ecwid storage API, Instant Site `appsPublicConfigs`, and legacy double-encoded docs.
 */
export function decodeEcwidNestedJson(
  raw: unknown,
  options: DecodeEcwidJsonOptions = {},
): unknown {
  const maxDepth = options.maxDepth ?? 6;
  let current = raw;

  for (let depth = 0; depth < maxDepth; depth++) {
    if (typeof current === 'string') {
      const trimmed = current.trim();
      if (!trimmed) return null;
      try {
        current = JSON.parse(trimmed);
        continue;
      } catch {
        return depth === 0 ? null : current;
      }
    }

    if (current && typeof current === 'object' && !Array.isArray(current)) {
      const obj = current as Record<string, unknown>;
      if (obj.value != null) {
        const keys = Object.keys(obj);
        const isApiEnvelope =
          keys.length === 1 ||
          (keys.length === 2 && keys.includes('key') && keys.includes('value')) ||
          (keys.length === 2 && keys.includes('key'));
        if (isApiEnvelope) {
          current = obj.value;
          continue;
        }
      }
    }

    break;
  }

  return current;
}
