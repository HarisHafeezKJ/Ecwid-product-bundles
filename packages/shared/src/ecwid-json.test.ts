import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { decodeEcwidNestedJson } from './ecwid-json.js';
import {
  normalizeRulesStorageDoc,
  unwrapStorageDoc,
  wrapStorageDoc,
} from './storage-envelope.js';
import { parseInstantSiteContextRaw } from './instant-site.js';

describe('decodeEcwidNestedJson', () => {
  it('parses JSON strings', () => {
    assert.deepEqual(decodeEcwidNestedJson('{"a":1}'), { a: 1 });
  });

  it('unwraps Ecwid { value } envelopes', () => {
    const inner = { rules: [] };
    assert.deepEqual(decodeEcwidNestedJson({ value: JSON.stringify(inner) }), inner);
  });

  it('unwraps double-encoded storage payloads', () => {
    const doc = wrapStorageDoc({ rules: [{ id: 'r1' }] });
    const encoded = JSON.stringify({ value: JSON.stringify(doc) });
    assert.deepEqual(unwrapStorageDoc(JSON.parse(encoded).value), { rules: [{ id: 'r1' }] });
  });
});

describe('normalizeRulesStorageDoc', () => {
  it('accepts v2 envelope', () => {
    const doc = wrapStorageDoc({ rules: [{ id: 'a' }] });
    assert.deepEqual(normalizeRulesStorageDoc(doc), { rules: [{ id: 'a' }] });
  });

  it('accepts legacy bare array', () => {
    assert.deepEqual(normalizeRulesStorageDoc([{ id: 'legacy' }]), { rules: [{ id: 'legacy' }] });
  });
});

describe('parseInstantSiteContextRaw', () => {
  it('extracts context from initialState JSON', () => {
    const raw = JSON.stringify({
      context: {
        appsPublicTokens: { app1: 'token-abc' },
      },
    });
    assert.deepEqual(parseInstantSiteContextRaw(raw)?.appsPublicTokens, { app1: 'token-abc' });
  });
});
