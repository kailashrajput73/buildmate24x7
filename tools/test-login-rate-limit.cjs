// Local UI regression: all login attempts are intercepted; no credentials reach any backend.
const { chromium } = require('../.local-tools/browser/node_modules/playwright')
const assert = require('node:assert/strict')
;(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  try {
    const page = await browser.newPage()
    let calls = 0
    await page.route('**/api/auth/staff/login', route => {
      calls++
      return route.fulfill(calls === 1
        ? { status: 429, headers: { 'Retry-After': '2' }, body: '' }
        : { status: 429, body: '' })
    })
    await page.goto('http://127.0.0.1:5173')
    await page.locator('input[type=email]').fill('test@example.test')
    await page.locator('input[type=password]').fill('local-test-placeholder')
    const submit = page.getByRole('button', { name: 'Sign in', exact: true })
    await submit.click()
    await page.getByText('Too many sign-in attempts.', { exact: false }).waitFor()
    assert.equal(await submit.isDisabled(), true)
    await page.locator('form').evaluate(form => form.requestSubmit())
    assert.equal(calls, 1)
    await page.waitForFunction(() => !document.querySelector('button[type=submit]').disabled)
    await submit.click()
    await page.getByRole('status').filter({ hasText: '5:00' }).waitFor()
    assert.equal(calls, 2)
    assert.equal(await submit.isDisabled(), true)
    console.log('PASS: empty 429 message, Retry-After countdown, duplicate-submit guard, five-minute fallback; no real login requests.')
  } finally { await browser.close() }
})().catch(error => { console.error(error); process.exitCode = 1 })
