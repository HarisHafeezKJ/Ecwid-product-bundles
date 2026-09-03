import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  PB_DEAL_TEXT_OPTION,
  encodeDealStampValue,
  decodeDealStampValue,
  stampCartLineOptions,
  ecwidCartOptions,
  readStampFromOptions,
  stripDealStampFromOptions,
} from './offer-line-stamp.js';

describe('encodeDealStampValue / decodeDealStampValue', () => {
  it('round-trips offerId + dealId + kind', () => {
    const encoded = encodeDealStampValue('offer-1', 'deal-2', 'pb-combo');
    const decoded = decodeDealStampValue(encoded);
    assert.equal(decoded.offerId, 'offer-1');
    assert.equal(decoded.dealId, 'deal-2');
    assert.equal(decoded.kind, 'pb-combo');
  });

  it('handles missing dealId and kind', () => {
    const decoded = decodeDealStampValue(encodeDealStampValue('offer-1'));
    assert.equal(decoded.offerId, 'offer-1');
    assert.equal(decoded.dealId, undefined);
    assert.equal(decoded.kind, undefined);
  });

  it('treats a plain display-name string as offerId only', () => {
    const decoded = decodeDealStampValue('Buy 5+ Get 10% Off');
    assert.equal(decoded.offerId, 'Buy 5+ Get 10% Off');
    assert.equal(decoded.dealId, undefined);
    assert.equal(decoded.kind, undefined);
  });
});

describe('stampCartLineOptions', () => {
  it('uses label when provided (ignores offerId encoding)', () => {
    const result = stampCartLineOptions(
      { Size: 'M' },
      'uuid-1',
      'deal-1',
      'pb-volume',
      'Qty Break 5+',
    );
    assert.equal(result?.[PB_DEAL_TEXT_OPTION], 'Qty Break 5+');
    assert.equal(result?.Size, 'M');
  });

  it('falls back to encoded value when label is not provided', () => {
    const result = stampCartLineOptions({ Size: 'M' }, 'uuid-1', 'deal-1', 'pb-combo');
    const stamp = result?.[PB_DEAL_TEXT_OPTION] ?? '';
    assert.ok(stamp.length > 0);
    const decoded = decodeDealStampValue(stamp);
    assert.equal(decoded.offerId, 'uuid-1');
    assert.equal(decoded.kind, 'pb-combo');
  });

  it('returns undefined when no stamp and no variant options', () => {
    const result = stampCartLineOptions(undefined);
    assert.equal(result, undefined);
  });

  it('strips existing _pbDeal before stamping', () => {
    const result = stampCartLineOptions(
      { Size: 'L', [PB_DEAL_TEXT_OPTION]: 'old-stamp' },
      'uuid-2',
      undefined,
      undefined,
      'New Label',
    );
    assert.equal(result?.[PB_DEAL_TEXT_OPTION], 'New Label');
    assert.equal(result?.Size, 'L');
  });
});

describe('ecwidCartOptions', () => {
  it('preserves _pbDeal in options', () => {
    const result = ecwidCartOptions({
      Size: 'M',
      [PB_DEAL_TEXT_OPTION]: 'My Bundle Deal',
    });
    assert.equal(result?.[PB_DEAL_TEXT_OPTION], 'My Bundle Deal');
    assert.equal(result?.Size, 'M');
  });

  it('strips legacy stamp keys (pbOfferId, pbDealId, pbKind)', () => {
    const result = ecwidCartOptions({
      Size: 'S',
      pbOfferId: 'x',
      pbDealId: 'y',
      pbKind: 'z',
    });
    assert.equal(result?.Size, 'S');
    assert.equal(result?.pbOfferId, undefined);
    assert.equal(result?.pbDealId, undefined);
    assert.equal(result?.pbKind, undefined);
  });

  it('returns undefined for empty input', () => {
    assert.equal(ecwidCartOptions(undefined), undefined);
    assert.equal(ecwidCartOptions({}), undefined);
  });
});

describe('readStampFromOptions', () => {
  it('reads display-name stamp as offerId', () => {
    const stamp = readStampFromOptions({ [PB_DEAL_TEXT_OPTION]: 'Volume Deal 5+' });
    assert.equal(stamp.offerId, 'Volume Deal 5+');
    assert.equal(stamp.kind, undefined);
  });

  it('reads encoded stamp with separator', () => {
    const encoded = encodeDealStampValue('uuid-1', 'deal-2', 'pb-combo');
    const stamp = readStampFromOptions({ [PB_DEAL_TEXT_OPTION]: encoded });
    assert.equal(stamp.offerId, 'uuid-1');
    assert.equal(stamp.dealId, 'deal-2');
    assert.equal(stamp.kind, 'pb-combo');
  });

  it('reads legacy flat keys', () => {
    const stamp = readStampFromOptions({
      pbOfferId: 'legacy-offer',
      pbDealId: 'legacy-deal',
      pbKind: 'pb-volume',
    });
    assert.equal(stamp.offerId, 'legacy-offer');
    assert.equal(stamp.dealId, 'legacy-deal');
    assert.equal(stamp.kind, 'pb-volume');
  });

  it('returns empty for no options', () => {
    const stamp = readStampFromOptions(undefined);
    assert.equal(stamp.offerId, undefined);
  });
});

describe('stripDealStampFromOptions', () => {
  it('removes _pbDeal key but keeps variant options', () => {
    const result = stripDealStampFromOptions({
      Size: 'M',
      Color: 'Red',
      [PB_DEAL_TEXT_OPTION]: 'My Deal',
    });
    assert.equal(result?.Size, 'M');
    assert.equal(result?.Color, 'Red');
    assert.equal(result?.[PB_DEAL_TEXT_OPTION], undefined);
  });
});
