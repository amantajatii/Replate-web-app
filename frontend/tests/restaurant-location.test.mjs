import assert from 'node:assert/strict'
import { test } from 'node:test'
import { pickupMapUrl } from '../lib/restaurant-location.ts'

test('pickup map links require real, valid coordinates and preserve zero', () => {
  for (const [lat, lon] of [[null, 100], [0, null], [91, 0], [0, -181], [NaN, 0], [0, Infinity]]) assert.equal(pickupMapUrl(lat, lon), null)
  const first = new URL(pickupMapUrl(-7.8, 110.3))
  assert.equal(first.searchParams.get('query'), '-7.8,110.3')
  assert.notEqual(pickupMapUrl(-7.8, 110.3), pickupMapUrl(0, 0))
  assert.equal(new URL(pickupMapUrl(0, 0)).searchParams.get('query'), '0,0')
})
