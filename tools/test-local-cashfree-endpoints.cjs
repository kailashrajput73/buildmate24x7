// Real local HTTP checks: no intercepted responses, no payment credentials, no production calls.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const { chromium } = require('../.local-tools/browser/node_modules/playwright')
const base = 'http://127.0.0.1:5173'
const route = '/api/admin/settings/cashfree'
async function main() {
  const unauthenticated = await fetch(base + route)
  assert.equal(unauthenticated.status, 401)
  const login = await fetch(base + '/api/auth/staff/login', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@buildmate24x7.in', password: process.env.BUILDMATE_LOCAL_ADMIN_PASSWORD || 'Admin@12345' }) })
  assert.equal(login.status, 200)
  const session = await login.json()
  const headers = { Authorization: `Bearer ${session.accessToken}`, 'Content-Type': 'application/json' }
  const get = async () => { const r = await fetch(base + route, { headers }); assert.equal(r.status, 200); return r.json() }
  let status = await get()
  assert.equal(status.effectiveMode, 'sandbox')
  assert.equal(status.productionConfigured, false)
  assert.equal(JSON.stringify(status).toLowerCase().includes('clientsecret'), false)
  const bad = await fetch(base + route, { method: 'PUT', headers, body: JSON.stringify({ revision: status.revision, mode: 'sandbox', sandbox: { clientId: 'invalid', clientSecret: 'invalid' } }) })
  assert.equal(bad.status, 400)
  // Save only non-secret setup when the fresh local database has no configured credentials.
  // Never replace, clear, activate or switch settings entered by the user.
  if (!status.activated && !status.sandboxConfigured && status.revision === 0) {
    const saved = await fetch(base + route, { method: 'PUT', headers, body: JSON.stringify({ revision: status.revision, mode: 'sandbox', activate: false }) })
    assert.equal(saved.status, 200)
    status = await saved.json()
    assert.equal(status.revision, 1)
  }
  assert.deepEqual(await get(), status)
  const audit = await fetch(base + route + '/audit', { headers })
  assert.equal(audit.status, 200)
  const swagger = await (await fetch('http://127.0.0.1:5081/swagger/v1/swagger.json')).json()
  assert.ok(swagger.paths[route].get && swagger.paths[route].put && swagger.paths[route + '/audit'].get)
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    await page.addInitScript(s => localStorage.setItem('bm_admin_session', JSON.stringify(s)), session)
    const apiResponse = page.waitForResponse(r => r.url().endsWith(route) && r.request().method() === 'GET')
    await page.goto(base + '/settings')
    assert.equal((await apiResponse).status(), 200)
    await page.getByText('Currently effective: Test Mode (Sandbox)', { exact: true }).waitFor()
    const section = page.locator('#cashfree-payment-gateway')
    assert.equal(await section.getByText('Not found', { exact: true }).count(), 0)
    assert.equal(await section.getByLabel('Test Client Secret', { exact: true }).inputValue(), '')
    assert.equal(await section.getByLabel('Live Client Secret', { exact: true }).inputValue(), '')
    await page.reload()
    await page.getByText('Currently effective: Test Mode (Sandbox)', { exact: true }).waitFor()
    assert.equal(await section.getByLabel('Test Client Secret', { exact: true }).inputValue(), '')
    fs.mkdirSync('.local-run/cashfree', { recursive: true })
    await section.screenshot({ path: '.local-run/cashfree/real-backend-settings.png' })
  } finally { await browser.close() }
  console.log(JSON.stringify({ backend: 'real .NET / PostgreSQL', unauthenticatedGet: 401, authenticatedGet: 200,
    invalidCredentialsPut: 400, auditGet: 200, registeredMethods: ['GET', 'PUT'], persistedRevision: status.revision,
    effectiveMode: status.effectiveMode, sandboxConfigured: status.sandboxConfigured, productionConfigured: status.productionConfigured,
    dashboardReload: 'passed', secretsReturned: false, merchantCredentialSave: status.sandboxConfigured ? 'configured by user' : 'pending user entry' }, null, 2))
}
main().catch(e => { console.error(e); process.exitCode = 1 })
