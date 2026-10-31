// Run: node tools/test-cashfree-checkout.cjs (after npm ci in storefront).
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('../storefront/node_modules/typescript')
const source = fs.readFileSync(path.join(__dirname, '../storefront/lib/cashfree.ts'), 'utf8')
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText

function checkout() {
  const calls = []
  const context = { exports: {}, window: { location: {}, Cashfree: ({ mode }) => ({ checkout: async args => { calls.push({ mode, ...args }); return {} } }) } }
  vm.runInNewContext(code, context)
  return { start: context.exports.startPayment, calls, window: context.window }
}
for (const environment of ['sandbox', 'production']) {
  test(`Checkout uses backend ${environment} mode and session`, async () => {
    const { start, calls } = checkout()
    await start({ environment, paymentSessionId: 'session-123', orderId: 1 })
    assert.equal(calls.length, 1)
    assert.equal(calls[0].mode, environment)
    assert.equal(calls[0].paymentSessionId, 'session-123')
  })
}
test('An old sandbox session remains sandbox after a live session', async () => {
  const { start, calls } = checkout()
  await start({ environment: 'production', paymentSessionId: 'live-session', orderId: 2 })
  await start({ environment: 'sandbox', paymentSessionId: 'pending-test-session', orderId: 1 })
  assert.deepEqual(calls.map(c => c.mode), ['production', 'sandbox'])
})
test('Invalid or missing server mode cannot silently start sandbox checkout', async () => {
  const { start, calls } = checkout()
  await assert.rejects(() => start({ environment: 'invalid', paymentSessionId: 'session' }), /Invalid payment environment/)
  await assert.rejects(() => start({ paymentSessionId: 'session' }), /Invalid payment environment/)
  assert.equal(calls.length, 0)
})
test('Missing session fails before SDK invocation', async () => {
  const { start, calls } = checkout()
  await assert.rejects(() => start({ environment: 'production', paymentSessionId: '' }), /could not be started/)
  assert.equal(calls.length, 0)
})
test('Existing local mock checkout still works', async () => {
  const { start, calls, window } = checkout()
  await start({ environment: 'mock', orderId: 42 })
  assert.equal(window.location.href, '/checkout/return?order=42')
  assert.equal(calls.length, 0)
})
