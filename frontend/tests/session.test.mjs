import assert from 'node:assert/strict'
import { test } from 'node:test'
import { clearSession, readSession, saveSession } from '../lib/session.ts'

test('logout clears both remembered and tab sessions without deleting unrelated data', () => {
  const storage = () => {
    const values = new Map()
    return {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    }
  }
  const originals = ['localStorage', 'sessionStorage'].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)])
  for (const [key] of originals) Object.defineProperty(globalThis, key, { configurable: true, value: storage() })
  try {
    const session = { userId: 1, name: 'Customer Test', email: 'test@example.com', role: 'Customer', token: 'test-only', expiresAt: new Date(Date.now() + 60_000).toISOString() }
    localStorage.setItem('unrelated', 'keep')
    for (const remember of [false, true]) {
      saveSession(session, remember)
      assert.equal(readSession()?.userId, 1)
      // Both stores can contain a session after multiple tabs or older app versions.
      localStorage.setItem('replate-session', JSON.stringify(session))
      sessionStorage.setItem('replate-session', JSON.stringify(session))
      clearSession()
      assert.equal(localStorage.getItem('replate-session'), null)
      assert.equal(sessionStorage.getItem('replate-session'), null)
      assert.equal(readSession(), null)
      assert.equal(localStorage.getItem('unrelated'), 'keep')
    }
  } finally {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    }
  }
})
