import assert from 'node:assert/strict'
import { test } from 'node:test'
import { nextChoiceIndex } from '../lib/choice-navigation.ts'

test('settings tabs wrap with arrows and support Home/End without intercepting other keys', () => {
  assert.equal(nextChoiceIndex('ArrowRight', 3, 4), 0)
  assert.equal(nextChoiceIndex('ArrowLeft', 0, 4), 3)
  assert.equal(nextChoiceIndex('ArrowRight', 0, 4), 1)
  assert.equal(nextChoiceIndex('Home', 2, 4), 0)
  assert.equal(nextChoiceIndex('End', 1, 4), 3)
  assert.equal(nextChoiceIndex('Tab', 1, 4), null)
  assert.equal(nextChoiceIndex('ArrowDown', 1, 4), null)
  assert.equal(nextChoiceIndex('ArrowRight', 0, 0), null)
  assert.equal(nextChoiceIndex('ArrowRight', -1, 4), null)
  assert.equal(nextChoiceIndex('ArrowRight', 4, 4), null)
  assert.equal(nextChoiceIndex('ArrowLeft', 0, 1), 0)
})
