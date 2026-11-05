import { test } from 'node:test'
import assert from 'node:assert/strict'
import { availableListings } from '../lib/dashboard-listings.ts'

test('dashboard counts only active listings with stock and an open pickup window', () => {
  const now = Date.parse('2026-11-05T10:00:00Z')
  const listing = { status: 'Active', availableQuantity: 2, pickupEnd: '2026-11-05T11:00:00Z' }
  assert.deepEqual(availableListings([listing, { ...listing, status: 'Inactive' }, { ...listing, availableQuantity: 0 }, { ...listing, pickupEnd: '2026-11-05T10:00:00Z' }], now), [listing])
})
