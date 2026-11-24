import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyTenantDatasetScope, isDatasetHiddenForTenant, getTenantForHost } from '../../src/lib/tenant.ts';
import { questionIdVariants, pairingIdCandidates } from '../../src/lib/question-ids.ts';

test('ARKE never sees TestlyPro when browsing all datasets', () => {
  assert.deepEqual(applyTenantDatasetScope({}, 'arke', 'all'), { dataset: { $nin: ['testlypro'] } });
  assert.deepEqual(applyTenantDatasetScope({}, 'arke', undefined), { dataset: { $nin: ['testlypro'] } });
});

test('ARKE explicitly requesting TestlyPro matches nothing', () => {
  assert.deepEqual(applyTenantDatasetScope({}, 'arke', 'testlypro'), { dataset: { $in: [] } });
});

test('ARKE can still pick its visible datasets', () => {
  assert.deepEqual(applyTenantDatasetScope({}, 'arke', 'core_en_hi'), { dataset: 'core_en_hi' });
});

test('Prepzo sees everything, including TestlyPro', () => {
  assert.deepEqual(applyTenantDatasetScope({}, 'prepzo', 'all'), {});
  assert.deepEqual(applyTenantDatasetScope({}, 'prepzo', 'testlypro'), { dataset: 'testlypro' });
});

test('a non-string dataset value cannot inject an operator', () => {
  assert.deepEqual(applyTenantDatasetScope({}, 'prepzo', { $ne: null }), {});
  assert.deepEqual(applyTenantDatasetScope({}, 'arke', { $ne: null }), { dataset: { $nin: ['testlypro'] } });
});

test('hidden-dataset check and host mapping', () => {
  assert.equal(isDatasetHiddenForTenant('arke', 'testlypro'), true);
  assert.equal(isDatasetHiddenForTenant('prepzo', 'testlypro'), false);
  assert.equal(getTenantForHost('bank.theprepzo.com').id, 'prepzo');
  assert.equal(getTenantForHost('bank.arkescholar.com').id, 'arke');
});

test('id exclusion matches both string and ObjectId forms, and drops objects', () => {
  const variants = questionIdVariants(['6af42c98b534319c700d1def', '173759_en', { $ne: 1 }, 42]);
  assert.equal(variants.length, 4); // hex string + ObjectId, plain string, number-as-string
  assert.equal(String(variants[1]), '6af42c98b534319c700d1def');
  assert.equal(typeof variants[1], 'object');
});

test('pairing id handles numeric and third-dataset string ids', () => {
  assert.deepEqual(pairingIdCandidates(173759), [173759]);
  assert.deepEqual(pairingIdCandidates('173759'), ['173759', 173759]);
  assert.deepEqual(pairingIdCandidates('EM0000015'), ['EM0000015']);
  assert.deepEqual(pairingIdCandidates({ $gt: 0 }), []);
  assert.deepEqual(pairingIdCandidates(0), []);
});
