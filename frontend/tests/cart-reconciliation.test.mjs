import assert from 'node:assert/strict'
import { test } from 'node:test'
import { reconcileCart } from '../lib/cart-reconciliation.ts'

const lines = [{ surplusListingId: 1, quantity: 3 }, { surplusListingId: 2, quantity: 1 }]
const listing = { availableQuantity: 2, restaurant: { restaurantId: 1 } }

test('temporary failures reject reconciliation without changing saved cart input', async () => {
  for (const status of [undefined, 401, 403, 500]) {
    const original = structuredClone(lines)
    await assert.rejects(reconcileCart(original, async id => {
      if (id === 2) throw Object.assign(new Error('Temporary failure'), { status })
      return listing
    }), /Temporary failure/)
    assert.deepEqual(original, lines)
  }
})

test('only confirmed missing listings are removed; available quantities are clamped', async () => {
  for (const status of [404, 410]) {
    const result = await reconcileCart(lines, async id => {
      if (id === 2) throw Object.assign(new Error('Unavailable'), { status })
      return listing
    })
    assert.equal(result.removedCount, 1)
    assert.equal(result.items[0].quantity, 2)
    assert.equal(result.items[0].surplusListingId, 1)
  }
  assert.deepEqual(await reconcileCart([], async () => listing), { items: [], removedCount: 0 })
})
