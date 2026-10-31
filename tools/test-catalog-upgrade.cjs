// Local-only real HTTP + browser regression. Keeps clearly labelled QA fixtures for review.
const { chromium } = require('../.local-tools/browser/node_modules/playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const base = 'http://127.0.0.1:5081'
async function main() {
  let token
  async function call(path, body, method = body ? 'POST' : 'GET') {
    const response = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined })
    const text = await response.text()
    assert.ok(response.ok, `${method} ${path}: ${response.status} ${text.slice(0, 500)}`)
    return text ? JSON.parse(text) : null
  }
  assert.equal((await fetch(base + '/api/admin/catalog-structure/types')).status, 401)
  const auth = await call('/api/auth/staff/login', { email: process.env.LOCAL_ADMIN_EMAIL, password: process.env.LOCAL_ADMIN_PASSWORD })
  token = auth.accessToken
  async function master(path, name, fields = {}) {
    const list = await call(path + '?pageSize=200')
    return (list.items ?? list).find(x => x.name === name) ?? call(path, { name, isActive: true, sortOrder: 0, ...fields })
  }
  const category = await master('/api/admin/categories', 'LOCAL QA Catalog')
  const sub = await master('/api/admin/subcategories', 'LOCAL QA Fitting', { categoryId: category.id })
  const a = await master('/api/admin/brands', 'LOCAL QA Astral'), b = await master('/api/admin/brands', 'LOCAL QA Supreme')
  const type = await master('/api/admin/catalog-structure/types', 'LOCAL QA UPVC', { categoryId: category.id, subCategoryIds: [sub.id] })
  const products = []
  for (const [index, brand, size] of [[0, a, '20 mm'], [1, a, '25 mm'], [2, b, '20 mm']]) {
    const name = `LOCAL QA Elbow ${index}`
    const existing = await call('/api/admin/products?search=' + encodeURIComponent(name))
    const p = existing.items.find(x => x.name === name) ?? await call('/api/admin/products', {
      name, categoryId: category.id, subCategoryId: sub.id, brandId: brand.id, unit: 'pcs', gstRate: 18,
      mrp: 50, listPrice: 45, partnerDiscountPercent: 0, retailDiscountPercent: 0, rewardPointsPerUnit: 0, reorderLevel: 0, sequence: index,
      imageUrls: [], isActive: true, showOnWeb: true, showOnApp: true, aliases: [], translations: {}, groupIds: [], specs: [],
      catalog: { typeId: type.id, class: 'SDR 11', productFamily: 'LOCAL QA Elbow', size, length: '3 m', packSize: 20, boxDiscountType: 'Percentage', boxDiscountValue: 10 },
    })
    if (p.stockQty < 100) await call('/api/admin/stock/adjust', { productId: p.id, quantity: 100 - p.stockQty, isIncrease: true, reason: 'Local catalogue regression fixture' })
    products.push(p)
  }
  const familyList = await call(`/api/admin/catalog-structure/families?categoryId=${category.id}`)
  assert.equal(familyList.length, 2)
  const cards = await call(`/api/catalog/products?categoryId=${category.id}&typeId=${type.id}&collapse=true`)
  assert.equal(cards.total, 2)
  const app = await fetch(`${base}/api/catalog/products?categoryId=${category.id}&collapse=true`, { headers: { 'X-Client': 'app' } }).then(r => r.json())
  assert.deepEqual(app.items.map(p => p.id), cards.items.map(p => p.id))
  const facets = await call(`/api/catalog/facets?categoryId=${category.id}&typeId=${type.id}`)
  assert.equal(facets.sizes.length, 2)
  const cart = await call('/api/cart/preview', [{ productId: products[0].id, quantity: 1, purchaseUnit: 'Box' }, { productId: products[0].id, quantity: 2, purchaseUnit: 'Piece' }])
  assert.equal(cart.total, 990)
  assert.equal(cart.items[0].baseQuantity, 20)
  const exportResponse = await fetch(`${base}/api/admin/products/export?ids=${products[0].id}`, { headers: { Authorization: `Bearer ${token}` } })
  assert.equal(exportResponse.status, 200)
  fs.writeFileSync('.local-run/catalog-selected-export.xlsx', Buffer.from(await exportResponse.arrayBuffer()))
  const template = await fetch(base + '/api/admin/products/template', { headers: { Authorization: `Bearer ${token}` } })
  assert.equal(template.status, 200)
  fs.writeFileSync('.local-run/catalog-product-template.xlsx', Buffer.from(await template.arrayBuffer()))
  fs.writeFileSync('.local-run/catalog-fixtures.json', JSON.stringify({ categoryId: category.id, typeId: type.id, productIds: products.map(p => p.id) }, null, 2))
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  try {
    const admin = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    await admin.addInitScript(auth => localStorage.setItem('bm_admin_session', JSON.stringify(auth)), auth)
    await admin.goto('http://127.0.0.1:5173/products')
    await admin.getByRole('checkbox', { name: `Select ${products[0].code}`, exact: true }).check()
    const download = admin.waitForEvent('download')
    await admin.getByRole('button', { name: 'Export selected (1)' }).click()
    await (await download).saveAs('.local-run/catalog-browser-selected.xlsx')
    await admin.goto(`http://127.0.0.1:5173/products/${products[0].id}`)
    await admin.waitForFunction(() => [...document.querySelectorAll('input')].some(i => i.value.startsWith('LOCAL QA Elbow')))
    await admin.getByLabel('Class', { exact: true }).fill('SDR 13')
    await admin.getByRole('button', { name: 'Save product', exact: true }).click()
    await admin.getByText(/saved$/).first().waitFor()
    await admin.reload()
    await admin.waitForFunction(() => [...document.querySelectorAll('input')].some(i => i.value === 'SDR 13'))
    assert.equal(await admin.getByLabel('Class', { exact: true }).inputValue(), 'SDR 13')
    await admin.getByLabel('Class', { exact: true }).fill('SDR 11')
    await admin.getByRole('button', { name: 'Save product', exact: true }).click()
    await admin.getByText(/saved$/).first().waitFor()
    await admin.screenshot({ path: '.local-run/catalog-admin-product.png', fullPage: true })
    const web = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    const requests = []
    web.on('request', r => requests.push(r.url()))
    await web.goto(`http://127.0.0.1:3000/c/${category.id}`, { timeout: 120000 })
    await web.getByText('2 product families', { exact: true }).waitFor({ timeout: 60000 })
    await web.getByRole('button', { name: 'LOCAL QA UPVC', exact: true }).click()
    await web.getByLabel('size', { exact: true }).selectOption('25 mm')
    await web.getByText('1 product families', { exact: true }).waitFor()
    assert.equal(requests.some(url => /\/categories\/\d+\/items/.test(url)), false)
    await web.screenshot({ path: '.local-run/catalog-web-category.png', fullPage: true })
    await web.setViewportSize({ width: 390, height: 844 })
    assert.equal(await web.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true)
    await web.screenshot({ path: '.local-run/catalog-web-phone.png', fullPage: true })
    await web.setViewportSize({ width: 1440, height: 1000 })
    await web.goto(`http://127.0.0.1:3000/p/${products[0].id}`, { timeout: 120000 })
    await web.getByRole('button', { name: 'Full box (20 pcs)', exact: true }).click()
    await web.getByRole('button', { name: /add to cart/i }).last().click()
    await web.goto('http://127.0.0.1:3000/cart')
    await web.getByText(/box of 20/i).first().waitFor()
    await web.reload()
    await web.getByText(/box of 20/i).first().waitFor()
    await web.screenshot({ path: '.local-run/catalog-web-cart.png', fullPage: true })
    console.log('PASS: real local API masters, brand families, facets, app/web parity, package cart, selected export; browser product save/reload, filtering, box cart persistence.')
  } finally { await browser.close() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })

