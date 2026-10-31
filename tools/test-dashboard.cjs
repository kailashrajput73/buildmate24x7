// Read-only check against the running local API and admin application.
const assert = require('node:assert/strict');
const { chromium } = require('../.local-tools/browser/node_modules/playwright');
async function main() {
  const base = 'http://127.0.0.1:5173';
  const login = await fetch(`${base}/api/auth/staff/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: process.env.LOCAL_ADMIN_EMAIL, password: process.env.LOCAL_ADMIN_PASSWORD }),
  });
  assert.equal(login.status, 200, 'Local staff login');
  const auth = await login.json();
  const response = await fetch(`${base}/api/admin/dashboard`, { headers: { Authorization: `Bearer ${auth.accessToken}` } });
  assert.equal(response.status, 200, 'Dashboard API');
  const dashboard = await response.json();
  assert.ok(dashboard.overview);
  assert.equal(dashboard.trend.length, 30);
  console.log('Dashboard overview:', JSON.stringify(dashboard.overview));
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.addInitScript(session => localStorage.setItem('bm_admin_session', JSON.stringify(session)), auth);
    await page.goto(base);
    await page.getByText('All records', { exact: true }).waitFor();
    await page.getByText('total products', { exact: true }).waitFor();
    assert.equal(await page.getByText('Something went wrong. Please try again.', { exact: true }).count(), 0);
    await page.screenshot({ path: '.local-run/dashboard-fixed.png', fullPage: true });
    assert.deepEqual(errors, []);
    console.log('Dashboard browser check passed.');
  } finally { await browser.close(); }
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
