// BuildMate mock API — zero dependencies (Node 18+).
// Serves realistic in-memory data in the same JSON shapes as the .NET API so the admin panel,
// storefront and Flutter app can be developed and demoed without the backend.
//
//   node tools/mock-api/server.mjs            → http://localhost:5080
//   Staff login: admin@buildmate24x7.in / Admin@12345     Any OTP: 123456
//
// Data resets on restart. Payments are simulated (no Cashfree call).
import http from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { parseMultipart, readXlsx, writeXlsx } from './xlsx.mjs'
import { qrPng } from './qr.mjs'

const PORT = Number(process.env.PORT ?? 5080)
const HERE = dirname(fileURLToPath(import.meta.url))
const ART = join(HERE, 'art')

// ------------------------------------------------------------------ helpers
let seed = 42
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
const pick = (a) => a[Math.floor(rnd() * a.length)]
const r2 = (v) => Math.round(v * 100) / 100
const now = () => new Date()
const iso = (d) => new Date(d).toISOString()
const daysAgo = (n, h = 10) => { const d = new Date(); d.setUTCDate(d.getUTCDate() - n); d.setUTCHours(h - 5, Math.floor(rnd() * 60)); return d }
const page = (rows, q) => {
  const p = Math.max(1, Number(q.page ?? 1)); const s = q.__all ? Math.max(1, rows.length) : Math.min(200, Number(q.pageSize ?? 25)) // __all: Excel exports
  return { items: rows.slice((p - 1) * s, p * s), total: rows.length, page: p, pageSize: s }
}
const like = (v, q) => !q || (v ?? '').toString().toLowerCase().includes(q.toLowerCase())
const istDate = (d) => new Date(new Date(d).getTime() + 5.5 * 3600e3).toISOString().slice(0, 10)
const inRange = (d, q) => (!q.from || istDate(d) >= q.from) && (!q.to || istDate(d) <= q.to)
class HttpError extends Error { constructor(status, msg, code) { super(msg); this.status = status; this.code = code } }
const fail = (status, msg, code) => { throw new HttpError(status, msg, code) }

// ------------------------------------------------------------------ data
const settings = {
  storeName: 'BuildMate 24x7', legalName: 'Shivani Electrochem Services', addressLine: '16/18 E, Sahajanand Society, Vill Baroi, Ta-Mundra, Dist-Bhuj', city: 'Mundra (Kutchh)', state: 'Gujarat', pincode: '370421',
  gstin: '24AUWPC0904B1Z5', pan: 'AUWPC0904B', bankName: 'Axis Bank', bankBranch: 'Baroi', bankAccountNo: '918020016036424', bankIfsc: 'UTIB0002227', invoiceLogoUrl: '/ses-logo.png',
  supportPhone: '9000000000', supportEmail: 'support@buildmate24x7.in', whatsAppNumber: '9000000000', openingHours: 'Open 24x7',
  minOrderValue: 199, deliveryFee: 99, freeDeliveryAbove: 2999, deliveryPincodes: [], homeDeliveryEnabled: true, storePickupEnabled: true,
  rewardPointValue: 1, invoicePrefix: 'SESW', invoiceNumberDigits: 3,
  invoiceTerms: 'Interest @ 18% p.a. will be charged if payment is not made within due date.\nOur risk and responsibility ceases as soon as the goods leave our premises.\nSubject to MUNDRA Jurisdiction only.\nE. & O. E.',
  supportedLanguages: ['en', 'hi'], androidAppUrl: '', iosAppUrl: '', minAppVersion: '1.0.0',
}
const GST_STATE = { 'Jammu and Kashmir': '01', 'Himachal Pradesh': '02', Punjab: '03', Chandigarh: '04', Uttarakhand: '05', Haryana: '06', Delhi: '07', Rajasthan: '08', 'Uttar Pradesh': '09', Bihar: '10', Sikkim: '11', 'Arunachal Pradesh': '12', Nagaland: '13', Manipur: '14', Mizoram: '15', Tripura: '16', Meghalaya: '17', Assam: '18', 'West Bengal': '19', Jharkhand: '20', Odisha: '21', Chhattisgarh: '22', 'Madhya Pradesh': '23', Gujarat: '24', 'Dadra and Nagar Haveli and Daman and Diu': '26', Maharashtra: '27', Karnataka: '29', Goa: '30', Lakshadweep: '31', Kerala: '32', 'Tamil Nadu': '33', Puducherry: '34', 'Andaman and Nicobar Islands': '35', Telangana: '36', 'Andhra Pradesh': '37', Ladakh: '38' }
const stateCode = (state, gstin) => (gstin && /^\d\d/.test(gstin.trim()) ? gstin.trim().slice(0, 2) : Object.entries(GST_STATE).find(([k]) => k.toLowerCase() === String(state ?? '').trim().toLowerCase())?.[1] ?? null)
const DELIVERY_GST = 18
// Indian financial year label for a date (IST): Apr 2026 – Mar 2027 → "26-27"
const fyLabel = (d = new Date()) => { const t = new Date(d.getTime() + 5.5 * 3600e3); const y = t.getUTCMonth() >= 3 ? t.getUTCFullYear() : t.getUTCFullYear() - 1; return `${String(y % 100).padStart(2, '0')}-${String((y + 1) % 100).padStart(2, '0')}` }
const invoiceCounters = {} // fy -> next number
const fmtInvoice = (fy, n) => `${(settings.invoicePrefix || 'INV').trim()}/${fy}/${String(n).padStart(Math.min(8, Math.max(1, Number(settings.invoiceNumberDigits) || 3)), '0')}`

const catalog = {
  'Pipes & Fittings': ['CPVC Pipes', 'CPVC Fittings', 'UPVC Pipes', 'UPVC Fittings', 'PVC Pipes', 'PVC Fittings'],
  Plumbing: ['Water Tanks', 'Valves'],
  Sanitary: ['Taps & Faucets', 'Showers', 'Wash Basins', 'Water Closets', 'Bath Accessories'],
  Electrical: ['House Wires', 'Multiple Application Cables', 'Multicore Flexible Industrial Cables', 'Submersible Cables', 'LAN & Computer Cables', 'CCTV Cables', 'TV & Satellite Cables', 'Speaker Cables', 'Telephone Cables', 'Switches & Sockets', 'MCB & DB', 'LED Lighting', 'Fans'],
  Hardware: ['Hand Tools', 'Adhesives & Sealants', 'Fasteners', 'Door Fittings'],
  'Building Materials': ['Cement', 'Waterproofing', 'Tile Adhesives', 'Wall Putty'],
}
const categories = []; const subcategories = []
let sid = 1
Object.entries(catalog).forEach(([name, subs], i) => {
  categories.push({ id: i + 1, name, description: '', imageUrl: `/files/mock/${['pipe', 'tank', 'tap', 'wire', 'plier', 'bag'][i]}.svg`, sortOrder: i + 1, isActive: true })
  subs.forEach((s, j) => subcategories.push({ id: sid++, categoryId: i + 1, name: s, sortOrder: j + 1, isActive: true }))
})
const brandNames = ['Astral', 'Supreme', 'King', 'Ashirvad', 'Sintex', 'Jaquar', 'Hindware', 'Cera', 'Havells', 'Polycab', 'Anchor', 'Finolex', 'Crompton', 'Taparia', 'Pidilite', 'UltraTech', 'Dr. Fixit', 'Birla White']
const brands = brandNames.map((n, i) => ({ id: i + 1, name: n, logoUrl: null, sortOrder: i, isActive: true }))
const brandId = (n) => brands.find((b) => b.name === n).id
const subId = (n) => subcategories.find((s) => s.name === n).id

// name, sub, brand, unit, hsn, gst, mrp, list, partnerDisc, retailDisc, points, rol, stock, aliases, hindi, art
const raw = [
  ['Ashirvad CPVC Ball Valve 3/4"', 'Valves', 'Ashirvad', 'pcs', '8481', 18, 380, 340, 16, 7, 2, 40, 120, 'ball valve,stop cock', 'बॉल वाल्व 3/4"', 'valve'],
  ['Sintex Triple Layer Water Tank 1000 L', 'Water Tanks', 'Sintex', 'pcs', '3925', 18, 9800, 8450, 10, 4, 60, 4, 14, 'tanki,water tank', 'पानी की टंकी 1000 लीटर', 'tank'],
  ['Jaquar Continental Pillar Cock', 'Taps & Faucets', 'Jaquar', 'pcs', '8481', 18, 2650, 2350, 12, 5, 15, 10, 36, 'tap,nal,tonti', 'जगुआर नल', 'tap'],
  ['Jaquar Florentine Wall Mixer', 'Taps & Faucets', 'Jaquar', 'pcs', '8481', 18, 5890, 5200, 12, 5, 30, 6, 18, 'mixer,diverter', '', 'tap'],
  ['Hindware Overhead Shower 6"', 'Showers', 'Hindware', 'pcs', '8481', 18, 1450, 1250, 14, 6, 8, 10, 40, 'shower,fauvara', 'शावर', 'shower'],
  ['Cera Wall Hung Wash Basin', 'Wash Basins', 'Cera', 'pcs', '6910', 18, 3200, 2780, 12, 5, 18, 5, 22, 'basin,wash basin', '', 'basin'],
  ['Hindware EWC Floor Mounted (S-Trap)', 'Water Closets', 'Hindware', 'pcs', '6910', 18, 7800, 6900, 10, 4, 40, 4, 3, 'toilet,commode,western seat', 'कमोड', 'wc'],
  ['Jaquar Towel Rail 24"', 'Bath Accessories', 'Jaquar', 'pcs', '7324', 18, 2150, 1890, 12, 5, 10, 6, 24, 'towel rod', '', 'accessory'],
  ['Anchor Roma 6A Switch', 'Switches & Sockets', 'Anchor', 'pcs', '8536', 18, 48, 42, 20, 10, 0.4, 500, 2400, 'switch,button', 'स्विच', 'switch'],
  ['Anchor Roma 6A 3-Pin Socket', 'Switches & Sockets', 'Anchor', 'pcs', '8536', 18, 125, 108, 20, 10, 0.8, 200, 900, 'socket,plug point', 'सॉकेट', 'socket'],
  ['Havells Crabtree Athena 16A Switch', 'Switches & Sockets', 'Havells', 'pcs', '8536', 18, 210, 182, 18, 8, 1.5, 100, 380, 'switch,16 amp switch', '', 'switch'],
  ['Havells 32A SP MCB C-Curve', 'MCB & DB', 'Havells', 'pcs', '8536', 18, 345, 290, 18, 8, 2.5, 50, 200, 'mcb,circuit breaker', 'एमसीबी', 'mcb'],
  ['Havells 8-Way SPN Distribution Board', 'MCB & DB', 'Havells', 'pcs', '8537', 18, 2350, 1990, 15, 6, 15, 8, 26, 'db box,distribution box', '', 'db'],
  ['Crompton 9W LED Bulb (Pack of 4)', 'LED Lighting', 'Crompton', 'pack', '8539', 12, 520, 399, 22, 12, 3, 40, 160, 'led bulb,bulb', 'एलईडी बल्ब', 'bulb'],
  ['Havells 20W LED Batten 4 ft', 'LED Lighting', 'Havells', 'pcs', '9405', 18, 640, 520, 20, 10, 4, 30, 110, 'tube light,batten', 'ट्यूबलाइट', 'batten'],
  ['Crompton HS Plus 1200 mm Ceiling Fan', 'Fans', 'Crompton', 'pcs', '8414', 18, 2750, 2290, 12, 6, 15, 10, 34, 'pankha,ceiling fan', 'पंखा', 'fan'],
  ['Havells Efficiencia Neo BLDC Fan 1200 mm', 'Fans', 'Havells', 'pcs', '8414', 18, 5450, 4590, 10, 5, 30, 6, 16, 'bldc fan,pankha', '', 'fan'],
  ['Taparia Combination Plier 8"', 'Hand Tools', 'Taparia', 'pcs', '8203', 18, 420, 365, 15, 6, 2, 20, 60, 'plier,pakad', 'प्लास', 'plier'],
  ['Taparia Screwdriver Set (6 pcs)', 'Hand Tools', 'Taparia', 'set', '8205', 18, 560, 480, 15, 6, 3, 15, 45, 'screwdriver,pechkas', 'पेचकस सेट', 'screwdriver'],
  ['Pidilite Fevicol SH 1 kg', 'Adhesives & Sealants', 'Pidilite', 'pcs', '3506', 18, 330, 295, 12, 5, 2, 40, 140, 'fevicol,glue', 'फेविकोल', 'adhesive'],
  ['Pidilite M-Seal 100 g', 'Adhesives & Sealants', 'Pidilite', 'pcs', '3214', 18, 70, 62, 15, 6, 0.4, 100, 420, 'm seal,leak seal', 'एम-सील', 'tube'],
  ['Pidilite CPVC Solvent Cement 118 ml', 'Adhesives & Sealants', 'Pidilite', 'pcs', '3506', 18, 260, 225, 15, 6, 1.5, 50, 180, 'solvent,cpvc glue', 'सॉल्वेंट', 'adhesive'],
  ['Dr. Fixit LW+ 1 L', 'Waterproofing', 'Dr. Fixit', 'pcs', '3824', 18, 285, 255, 12, 5, 2, 40, 120, 'waterproofing,lw plus', '', 'bucket'],
  ['Dr. Fixit Roofseal 4 L', 'Waterproofing', 'Dr. Fixit', 'pcs', '3209', 18, 2390, 2050, 12, 5, 14, 10, 30, 'roof seal,terrace waterproof', '', 'bucket'],
  ['UltraTech Cement OPC 53 Grade (50 kg)', 'Cement', 'UltraTech', 'bag', '2523', 28, 440, 395, 4, 2, 1, 100, 400, 'cement,siment', 'सीमेंट', 'bag'],
  ['UltraTech Tile Fixo 20 kg', 'Tile Adhesives', 'UltraTech', 'bag', '3214', 18, 650, 560, 10, 4, 4, 30, 90, 'tile adhesive', '', 'bag'],
  ['Birla White Wall Care Putty 40 kg', 'Wall Putty', 'Birla White', 'bag', '3214', 18, 980, 850, 10, 4, 6, 25, 70, 'putty,wall putty', 'पुट्टी', 'bag'],
]
const racks = [{ id: 1, code: 'R1', name: 'Main rack', rows: 4, columns: 6, isActive: true }, { id: 2, code: 'R2', name: 'Electrical aisle', rows: 3, columns: 5, isActive: true }]
const rackLocations = []
let rlid = 1
for (const r of racks) for (let a = 1; a <= r.rows; a++) for (let c = 1; c <= r.columns; c++) rackLocations.push({ id: rlid++, rackId: r.id, label: `${r.code}-${String.fromCharCode(64 + a)}${c}`, rowNo: a, columnNo: c })

const products = raw.map((x, i) => {
  const sub = subcategories.find((s) => s.name === x[1])
  return {
    id: i + 1, code: `BM${String(i + 1).padStart(6, '0')}`, name: x[0], description: `${x[0]}. Genuine ${x[2]} product supplied by BuildMate 24x7 with GST invoice.`,
    categoryId: sub.categoryId, subCategoryId: sub.id, brandId: brandId(x[2]), barcode: null, unit: x[3], hsnCode: x[4], gstRate: x[5],
    mrp: x[6], listPrice: x[7], partnerDiscountPercent: x[8], retailDiscountPercent: x[9], rewardPointsPerUnit: x[10], reorderLevel: x[11],
    sequence: 90000 + i, stockQty: x[12], reservedQty: 0, averageCost: r2(x[7] * 0.72), imageUrls: [`/files/mock/${x[15]}.svg`],
    isActive: true, showOnWeb: true, showOnApp: true, aliases: x[13].split(','), translations: x[14] ? { hi: x[14] } : {},
    groupIds: [], locations: [{ rackLocationId: (i % 24) + 1, quantity: x[12] }], createdAt: iso(daysAgo(120)), updatedAt: iso(daysAgo(5)),
  }
})
// Real catalogue from the store's sheets (tools/mock-api/data/*.json, built by tools/catalog-import).
// Stock is invented for the demo; prices are MRP as supplied.
for (const file of ['pipes-fittings.json', 'electrical.json']) {
  const realFile = join(HERE, 'data', file)
  if (!existsSync(realFile)) continue
  const real = JSON.parse(readFileSync(realFile, 'utf8'))
  for (const r of real) {
    const id = products.length + 1
    let b = brands.find((x) => x.name.toLowerCase() === r.brand.toLowerCase())
    if (!b) { b = { id: brands.length + 1, name: r.brand, logoUrl: null, sortOrder: brands.length, isActive: true }; brands.push(b) }
    const sub = subcategories.find((x) => x.name === r.subCategory)
    const stock = rnd() < 0.06 ? 0 : Math.max(r.packSize ?? 0, 10 + Math.floor(rnd() * (r.mrp > 20000 ? 6 : r.mrp > 1000 ? 40 : 400)))
    products.push({
      id, code: r.code, name: r.name, description: r.description, categoryId: sub.categoryId, subCategoryId: sub.id, brandId: b.id, barcode: null,
      unit: r.unit, hsnCode: r.hsn, gstRate: r.gst, mrp: r.mrp, listPrice: r.listPrice, partnerDiscountPercent: r.partnerDiscount, retailDiscountPercent: r.retailDiscount,
      rewardPointsPerUnit: 0, reorderLevel: r.reorderLevel, sequence: 1000 + r.sequence, stockQty: stock, reservedQty: 0, averageCost: r.cost ?? 0,
      imageUrls: [r.image ?? `/files/mock/${r.category === 'Electrical' ? 'wire' : r.subCategory.endsWith('Pipes') ? 'pipe' : 'fitting'}.svg`],
      isActive: r.active, showOnWeb: true, showOnApp: true, aliases: r.aliases, translations: {}, groupIds: [],
      variantFamily: r.variantFamily, variantLabel: r.variantLabel, specs: Object.entries(r.specs).map(([k, v]) => `${k}: ${v}`),
      locations: [{ rackLocationId: (id % 24) + 1, quantity: stock }], createdAt: iso(daysAgo(30)), updatedAt: iso(daysAgo(1)),
    })
  }
}
for (const p of products) { p.variantFamily ??= null; p.variantLabel ??= null; p.specs ??= [] }

const groups = [
  { id: 1, name: 'Bathroom Fitting Kit', description: 'Everything for a standard bathroom', imageUrl: null, sortOrder: 1, isActive: true, productIds: products.filter((p) => p.categoryId === categories.find((c) => c.name === 'Sanitary').id || p.subCategoryId === subId('Valves')).map((p) => p.id) },
  { id: 2, name: 'House Wiring Essentials', description: 'Wires, switches, MCBs', imageUrl: null, sortOrder: 2, isActive: true, productIds: products.filter((p) => [subId('House Wires'), subId('Switches & Sockets'), subId('MCB & DB')].includes(p.subCategoryId)).map((p) => p.id) },
]
groups.forEach((g) => g.productIds.forEach((pid) => products.find((p) => p.id === pid).groupIds.push(g.id)))

const roles = [
  { id: 1, name: 'Administrator', description: 'Full access', permissions: ['*'], isSystem: true },
  { id: 2, name: 'Store Manager', description: 'Runs the store: orders, dispatch, counter billing, stock, partners', permissions: ['dashboard.view', 'catalog.view', 'catalog.manage', 'purchases.manage', 'stock.view', 'stock.adjust', 'racks.manage', 'partners.view', 'partners.manage', 'kyc.approve', 'orders.view', 'orders.manage', 'orders.special_discount', 'dispatch.manage', 'billing.counter', 'service_requests.manage', 'reports.view', 'rewards.adjust'], isSystem: false },
  { id: 3, name: 'Sales Manager', description: 'Manages assigned referral partners', permissions: ['dashboard.view', 'catalog.view', 'partners.view', 'partners.manage', 'orders.view', 'service_requests.manage', 'reports.view'], isSystem: false },
  { id: 4, name: 'Warehouse', description: 'Purchases, racks, stock and dispatch', permissions: ['catalog.view', 'purchases.manage', 'stock.view', 'racks.manage', 'orders.view', 'dispatch.manage'], isSystem: false },
  { id: 5, name: 'Counter Staff', description: 'Walk-in billing and pickups', permissions: ['catalog.view', 'stock.view', 'orders.view', 'dispatch.manage', 'billing.counter'], isSystem: false },
]
const permissionCatalogue = [
  ['dashboard.view', 'View dashboard', 'General'], ['catalog.view', 'View catalogue', 'Catalogue'], ['catalog.manage', 'Manage categories, brands, products, groups', 'Catalogue'],
  ['purchases.manage', 'Enter and upload purchases', 'Inventory'], ['stock.view', 'View stock and inventory reports', 'Inventory'], ['stock.adjust', 'Adjust stock manually', 'Inventory'],
  ['racks.manage', 'Manage racks and locations', 'Inventory'], ['partners.view', 'View referral partners', 'Partners'], ['partners.manage', 'Create and edit referral partners', 'Partners'],
  ['kyc.approve', 'Approve or reject KYC', 'Partners'], ['rewards.adjust', 'Adjust reward points', 'Partners'], ['orders.view', 'View orders', 'Sales'], ['orders.manage', 'Edit and cancel orders', 'Sales'],
  ['orders.special_discount', 'Give special discounts', 'Sales'], ['dispatch.manage', 'Dispatch orders and issue invoices', 'Sales'], ['billing.counter', 'Counter billing for walk-in customers', 'Sales'],
  ['service_requests.manage', 'Manage plumber / electrician requests', 'Services'], ['content.manage', 'Manage website and app content', 'Content'], ['reports.view', 'View reports and analytics', 'Reports'],
  ['users.manage', 'Manage staff users and roles', 'Admin'], ['settings.manage', 'Manage settings and integrations', 'Admin'],
].map(([key, label, group]) => ({ key, label, group }))

const users = [
  { id: 1, userType: 'Staff', name: 'Administrator', email: 'admin@buildmate24x7.in', phone: null, roleId: 1, isActive: true, lastLoginAt: iso(daysAgo(0)), createdAt: iso(daysAgo(200)) },
  { id: 2, userType: 'Staff', name: 'Rakesh Sharma', email: 'rakesh@buildmate24x7.in', phone: '9811100001', roleId: 2, isActive: true, lastLoginAt: iso(daysAgo(1)), createdAt: iso(daysAgo(180)) },
  { id: 3, userType: 'Staff', name: 'Neha Jain', email: 'neha@buildmate24x7.in', phone: '9811100002', roleId: 3, isActive: true, lastLoginAt: iso(daysAgo(2)), createdAt: iso(daysAgo(150)) },
  { id: 4, userType: 'Staff', name: 'Imran Khan', email: 'imran@buildmate24x7.in', phone: '9811100003', roleId: 4, isActive: true, lastLoginAt: iso(daysAgo(0)), createdAt: iso(daysAgo(140)) },
]
const partnerSeed = [
  ['Mahesh Prajapati', 'Plumber', 'Prajapati Plumbing Works', 'Zero Point', 'Mundra', '370421', 'Approved'],
  ['Sunil Gadhvi', 'Electrician', 'Gadhvi Electricals', 'Station Road', 'Bhuj', '370001', 'Approved'],
  ['Ramesh Suthar', 'Contractor', 'Suthar Constructions', 'Sector 8', 'Gandhidham', '370201', 'Approved'],
  ['Deepak Ahir', 'Plumber', null, 'Baroi Road', 'Mundra', '370421', 'Approved'],
  ['Arif Memon', 'Electrician', 'A.M. Electric Services', 'Bhid Gate', 'Bhuj', '370001', 'Approved'],
  ['Kailash Rabari', 'Plumber', null, 'Navinal', 'Mundra', '370421', 'Approved'],
  ['Vijay Chaudhary', 'Builder', 'Chaudhary Builders', 'Ward 12-B', 'Gandhidham', '370201', 'Approved'],
  ['Prakash Soni', 'Electrician', null, 'Bunder Road', 'Mandvi', '370465', 'Pending'],
  ['Gopal Jadeja', 'Plumber', 'Jadeja Sanitary', 'Ganga Nagar', 'Anjar', '370110', 'Pending'],
  ['Salim Juneja', 'Contractor', null, 'Kidana', 'Gandhidham', '370201', 'Pending'],
  ['Bharat Maheshwari', 'Plumber', null, 'Madhapar', 'Bhuj', '370020', 'Rejected'],
  ['Naresh Kanani', 'Electrician', null, 'Mirjapar', 'Bhuj', '370040', 'NotSubmitted'],
]
const partners = partnerSeed.map((p, i) => {
  const id = 100 + i
  users.push({ id, userType: 'Partner', name: p[0], phone: `98${String(29000000 + i * 1371).padStart(8, '0')}`, email: null, isActive: true, lastLoginAt: iso(daysAgo(i)), createdAt: iso(daysAgo(150 - i * 9)), preferredLanguage: i % 3 ? 'en' : 'hi' })
  return {
    userId: id, partnerType: p[1], businessName: p[2], addressLine: `${10 + i}, Main Road`, area: p[3], city: p[4], state: 'Gujarat', pincode: p[5],
    latitude: 22.84 + i / 200, longitude: 69.72 + i / 200, gstin: p[2] ? `24ABCDE${1000 + i}F1Z${i % 9}` : null, locationVerified: p[6] === 'Approved',
    kycStatus: p[6], kycSubmittedAt: p[6] === 'NotSubmitted' ? null : iso(daysAgo(140 - i * 9)), kycReviewedById: ['Approved', 'Rejected'].includes(p[6]) ? 2 : null,
    kycReviewedAt: ['Approved', 'Rejected'].includes(p[6]) ? iso(daysAgo(138 - i * 9)) : null, kycRemarks: p[6] === 'Rejected' ? 'Aadhaar photo is blurred. Please upload a clear photo.' : null,
    managerId: i % 2 ? 3 : 2, createdByAdmin: i === 6, rewardBalance: 0,
    documents: p[6] === 'NotSubmitted' ? [] : [{ id: id * 10 + 1, documentType: 'Aadhaar', documentNumberMasked: `XXXXXXXX${4100 + i}`, fileKey: 'private/kyc/aadhaar.png', uploadedAt: iso(daysAgo(140 - i * 9)) },
      { id: id * 10 + 2, documentType: 'ShopPhoto', documentNumberMasked: null, fileKey: 'private/kyc/shop.png', uploadedAt: iso(daysAgo(140 - i * 9)) }],
  }
})
const customers = ['Anita Mehta', 'Rohit Shah', 'Kavita Joshi', 'Sanjay Thakkar', 'Pooja Patel', 'Manish Kothari'].map((n, i) => {
  const id = 200 + i
  users.push({ id, userType: 'Customer', name: n, phone: `97${String(14000000 + i * 2213).padStart(8, '0')}`, email: null, isActive: true, createdAt: iso(daysAgo(90 - i * 10)), preferredLanguage: 'en' })
  return id
})
// Kutch addresses; the last customer is in Rajasthan so a few demo invoices show IGST (inter-state supply)
const custPlaces = [['Mundra', 'Gujarat', '370421', 'Shantinagar'], ['Bhuj', 'Gujarat', '370001', 'Sanskar Nagar'], ['Gandhidham', 'Gujarat', '370201', 'Sector 5'], ['Anjar', 'Gujarat', '370110', 'Devaliya Naka'], ['Mandvi', 'Gujarat', '370465', 'Salaya'], ['Mount Abu', 'Rajasthan', '307501', 'Delwara Road']]
const addresses = customers.map((uid, i) => ({ id: i + 1, userId: uid, name: users.find((u) => u.id === uid).name, phone: users.find((u) => u.id === uid).phone, line1: `${20 + i}, ${custPlaces[i][3]}`, line2: null, landmark: 'Near water tank', city: custPlaces[i][0], state: custPlaces[i][1], pincode: custPlaces[i][2], isDefault: true }))

// ---- orders
const orders = []
const rewardTxns = []
const notifications = []
const stockMoves = []
// ---- Product movement classification (same rules as api/.../Inventory/ProductMovement.cs)
// Movement = successful dispatch (dispatchedAt). Days are IST calendar days: 0–30 Fast, 31–120 Slow, 121+ Non-moving.
// Never dispatched: aged from the first stock receipt (else createdAt) and flagged neverDispatched.
const FAST_MAX_DAYS = 30, SLOW_MAX_DAYS = 120
const istDayNo = (d) => Math.floor((new Date(d).getTime() + 5.5 * 3600e3) / 86400e3)
const RECEIPT_TYPES = ['PurchaseIn', 'OpeningStock', 'AdjustmentIn']
function movementOf(p, at = now()) {
  const ref = p.lastDispatchedAt ?? p.agingFromAt ?? p.createdAt
  const days = Math.max(0, istDayNo(at) - istDayNo(ref))
  return { movement: days <= FAST_MAX_DAYS ? 'Fast' : days <= SLOW_MAX_DAYS ? 'Slow' : 'NonMoving', daysSinceMovement: days, neverDispatched: !p.lastDispatchedAt, lastDispatchedAt: p.lastDispatchedAt ?? null, movementReferenceAt: ref }
}
const recordDispatch = (p, at) => { if (!p.lastDispatchedAt || new Date(at) > new Date(p.lastDispatchedAt)) p.lastDispatchedAt = iso(new Date(at)) }
// every ledger row passes through here, so the first (earliest) receipt is always captured; returns don't count
stockMoves.push = function (...rows) {
  for (const m of rows) {
    const p = products[m.productId - 1]
    if (p && m.quantity > 0 && RECEIPT_TYPES.includes(m.type) && (!p.agingFromAt || new Date(m.createdAt) < new Date(p.agingFromAt))) p.agingFromAt = m.createdAt
  }
  return Array.prototype.push.apply(this, rows)
}
let orderSeq = 1, invSeq = 1, dispSeq = 1, payId = 1, evId = 1, itemId = 1, mvId = 1, rtId = 1
const orderNo = (d) => `BM${istDate(d).slice(2, 4)}${istDate(d).slice(5, 7)}${String(orderSeq++).padStart(5, '0')}`
const user = (id) => users.find((u) => u.id === id)
const partnerOf = (id) => partners.find((p) => p.userId === id)
const discFor = (p, kind) => (kind === 'Partner' ? p.partnerDiscountPercent : p.retailDiscountPercent)
function recalc(o) {
  for (const i of o.items) {
    i.unitPrice = r2(i.listPrice * (1 - Math.min(100, i.discountPercent + i.specialDiscountPercent) / 100))
    i.lineTotal = r2(i.unitPrice * i.quantity)
    i.taxAmount = r2((i.lineTotal * i.gstRate) / (100 + i.gstRate))
  }
  o.subTotal = r2(o.items.reduce((s, i) => s + i.listPrice * i.quantity, 0))
  const net = r2(o.items.reduce((s, i) => s + i.lineTotal, 0))
  o.discountTotal = r2(o.subTotal - net)
  // delivery is taxed at 18% (GST-inclusive); the bill is rounded to the rupee and the difference shown as Round Off
  o.taxTotal = r2(o.items.reduce((s, i) => s + i.taxAmount, 0) + (o.shippingFee * DELIVERY_GST) / (100 + DELIVERY_GST))
  const exact = r2(net + o.shippingFee)
  o.grandTotal = Math.round(exact)
  o.roundOff = r2(o.grandTotal - exact)
  o.rewardPointsEarned = o.customerKind === 'Partner' ? r2(o.items.reduce((s, i) => s + i.rewardPoints, 0)) : 0
}
const ev = (o, action, details, by) => o.events.push({ id: evId++, at: iso(o._clock ?? now()), action, details: details ?? null, by: by ?? null })
function makeOrder({ userId, kind, channel, at, lines, fulfilment, status }) {
  const u = userId ? user(userId) : null
  const addr = addresses.find((a) => a.userId === userId)
  const o = {
    id: orders.length + 1, orderNo: orderNo(at), createdAt: iso(at), channel, customerKind: kind, status: 'PendingPayment', paymentStatus: 'Pending', paymentMethod: channel === 'Store' ? 'CashAtStore' : 'Cashfree', paidAt: null,
    fulfilmentType: fulfilment, scheduledAt: null, userId: userId ?? null, customerName: u?.name ?? 'Walk-in customer', customerPhone: u?.phone ?? null,
    customerGstin: kind === 'Partner' ? partnerOf(userId)?.gstin ?? null : null,
    shipLine1: fulfilment === 'HomeDelivery' ? addr?.line1 ?? '12, Main Road' : null, shipLine2: null, shipCity: fulfilment === 'HomeDelivery' ? addr?.city ?? partnerOf(userId)?.city ?? 'Mundra' : null,
    shipState: fulfilment === 'HomeDelivery' ? addr?.state ?? 'Gujarat' : null, shipPincode: fulfilment === 'HomeDelivery' ? addr?.pincode ?? partnerOf(userId)?.pincode ?? '370421' : null,
    shippingFee: 0, amountPaid: 0, rewardsCredited: false, customerNotes: rnd() < 0.15 ? 'Please keep it ready by evening' : null, internalNotes: null, cancelReason: null,
    items: lines.map(([pid, q]) => { const p = products[pid - 1]; return { id: itemId++, productId: p.id, productCode: p.code, productName: p.name, hsnCode: p.hsnCode, quantity: q, listPrice: p.listPrice, discountPercent: discFor(p, kind), specialDiscountPercent: 0, gstRate: p.gstRate, rewardPoints: kind === 'Partner' ? r2(p.rewardPointsPerUnit * q) : 0, addedAtStore: channel === 'Store' } }),
    events: [], payments: [], dispatch: null, stockReserved: false, _clock: at,
  }
  if (fulfilment === 'HomeDelivery' && channel !== 'Store') o.shippingFee = 99
  recalc(o)
  if (o.shippingFee && o.grandTotal - o.shippingFee >= settings.freeDeliveryAbove) { o.shippingFee = 0; recalc(o) }
  ev(o, 'Order placed', `${o.items.length} item(s), ₹${o.grandTotal.toFixed(2)}`)
  orders.push(o)
  if (status === 'PendingPayment') return o
  pay(o, channel === 'Store' ? 'CashAtStore' : 'Cashfree')
  if (status === 'Cancelled') { cancel(o, 'Customer changed plans', null); return o }
  if (['Processing', 'ReadyForPickup', 'OutForDelivery', 'Completed'].includes(status)) {
    o.status = 'Processing'; o.scheduledAt = iso(new Date(at.getTime() + 6 * 3600e3)); ev(o, 'Pickup / delivery scheduled', `${fulfilment === 'StorePickup' ? 'Store pickup' : 'Home delivery'}`, 'Rakesh Sharma')
  }
  if (status === 'ReadyForPickup') { o.status = 'ReadyForPickup'; ev(o, 'Status updated', 'ReadyForPickup', 'Imran Khan') }
  if (['OutForDelivery', 'Completed'].includes(status)) dispatch(o, {}, 'Imran Khan')
  if (status === 'Completed' && o.status === 'OutForDelivery') { o.status = 'Completed'; ev(o, 'Delivered', null, 'Imran Khan') }
  delete o._clock
  return o
}
function pay(o, method) {
  o.status = 'Paid'; o.paymentStatus = 'Success'; o.paidAt = iso(o._clock ?? now()); o.amountPaid = o.grandTotal; o.paymentMethod = method
  o.payments.push({ id: payId++, at: o.paidAt, method, status: 'Success', amount: o.grandTotal, reference: method === 'Cashfree' ? `CF${Math.floor(rnd() * 1e9)}` : null })
  ev(o, 'Payment received', `₹${o.grandTotal.toFixed(2)} received via ${method}`)
  for (const i of o.items) products[i.productId - 1].reservedQty += i.quantity
  o.stockReserved = true
  if (o.userId) notify(o.userId, `Order ${o.orderNo} confirmed`, o.fulfilmentType === 'StorePickup' ? "Payment received. We'll let you know when it's ready for pickup." : "Payment received. We'll schedule your delivery shortly.", `order:${o.id}`)
}
function dispatch(o, d, by) {
  const balance = r2(o.grandTotal - o.amountPaid)
  if (balance > 0.009) {
    if (!d.balanceCollectedVia) fail(409, `Collect the balance of ₹${balance.toFixed(2)} (cash, UPI or card) before dispatch.`, 'balance_due')
    o.payments.push({ id: payId++, at: iso(now()), method: d.balanceCollectedVia, status: 'Success', amount: balance, reference: d.balanceReference ?? null }); o.amountPaid = o.grandTotal
    ev(o, 'Balance collected', `₹${balance.toFixed(2)} via ${d.balanceCollectedVia}`, by)
  }
  for (const i of o.items) {
    const p = products[i.productId - 1]
    if (o.stockReserved) p.reservedQty = Math.max(0, p.reservedQty - i.quantity)
    p.stockQty = r2(p.stockQty - i.quantity)
    stockMoves.push({ id: mvId++, createdAt: iso(o._clock ?? now()), productId: p.id, type: 'SaleOut', quantity: -i.quantity, balanceAfter: p.stockQty, unitCost: p.averageCost, referenceType: 'Order', referenceNo: o.orderNo, note: o.customerName })
  }
  o.stockReserved = false
  const at = o._clock ? new Date(o._clock.getTime() + 8 * 3600e3) : now()
  for (const i of o.items) recordDispatch(products[i.productId - 1], at)
  o.dispatch = { dispatchNo: `DS2627${String(dispSeq++).padStart(5, '0')}`, invoiceNo: takeInvoiceNo(at), dispatchedAt: iso(at), dispatchedBy: by, vehicleNo: d.vehicleNo ?? null, deliveryPerson: d.deliveryPerson ?? null, notes: d.notes ?? null }
  o.status = o.fulfilmentType === 'HomeDelivery' ? 'OutForDelivery' : 'Completed'
  ev(o, 'Dispatched', `Invoice ${o.dispatch.invoiceNo}`, by)
  if (o.customerKind === 'Partner' && o.rewardPointsEarned > 0) {
    const p = partnerOf(o.userId); p.rewardBalance = r2(p.rewardBalance + o.rewardPointsEarned)
    rewardTxns.push({ id: rtId++, partnerUserId: o.userId, createdAt: o.dispatch.dispatchedAt, type: 'Earned', points: o.rewardPointsEarned, balanceAfter: p.rewardBalance, orderId: o.id, orderNo: o.orderNo, note: `Order ${o.orderNo}` })
    o.rewardsCredited = true; ev(o, 'Reward points credited', `${o.rewardPointsEarned} points`, by)
  }
  if (o.userId) notify(o.userId, o.fulfilmentType === 'HomeDelivery' ? 'Out for delivery 🚚' : 'Order collected — thank you!', `Order ${o.orderNo} · Invoice ${o.dispatch.invoiceNo}`, `order:${o.id}`)
}
function cancel(o, reason, by) {
  if (o.stockReserved) { for (const i of o.items) products[i.productId - 1].reservedQty = Math.max(0, products[i.productId - 1].reservedQty - i.quantity); o.stockReserved = false }
  o.status = 'Cancelled'; o.cancelReason = reason; ev(o, 'Cancelled', reason, by)
}

// opening stock
for (const p of products) stockMoves.push({ id: mvId++, createdAt: iso(daysAgo(120)), productId: p.id, type: 'OpeningStock', quantity: p.stockQty + 200, balanceAfter: p.stockQty + 200, unitCost: p.averageCost, referenceType: 'Opening', referenceNo: null, note: 'Opening stock' })
for (const p of products) p.stockQty += 200

const approved = partners.filter((p) => p.kycStatus === 'Approved').map((p) => p.userId)
const sellable = products.filter((p) => p.isActive && p.listPrice > 0)
for (let d = 34; d >= 0; d--) {
  const n = 1 + Math.floor(rnd() * (d < 7 ? 4 : 3))
  for (let k = 0; k < n; k++) {
    const r = rnd()
    const channel = r < 0.55 ? 'App' : r < 0.8 ? 'Web' : 'Store'
    const kind = channel === 'App' ? 'Partner' : channel === 'Web' ? 'Retail' : rnd() < 0.3 ? 'Partner' : 'WalkIn'
    const userId = kind === 'Partner' ? pick(approved) : kind === 'Retail' ? pick(customers) : null
    const lines = []; const cnt = 1 + Math.floor(rnd() * 5)
    for (let j = 0; j < cnt; j++) { const pid = pick(sellable).id; if (!lines.some((l) => l[0] === pid)) { const p = products[pid - 1]; lines.push([pid, p.listPrice > 2000 ? 1 + Math.floor(rnd() * 2) : 2 + Math.floor(rnd() * (p.listPrice < 100 ? 40 : 8))]) } }
    const fulfilment = channel === 'Store' ? 'StorePickup' : rnd() < 0.45 ? 'HomeDelivery' : 'StorePickup'
    const status = channel === 'Store' ? 'Completed' : d > 3 ? (rnd() < 0.06 ? 'Cancelled' : 'Completed') : pick(['Paid', 'Paid', 'Processing', 'ReadyForPickup', 'OutForDelivery', 'Completed', 'PendingPayment'])
    makeOrder({ userId, kind, channel, at: daysAgo(d, 9 + Math.floor(rnd() * 11)), lines, fulfilment, status: status === 'ReadyForPickup' && fulfilment === 'HomeDelivery' ? 'Processing' : status })
  }
}
// make sure a few products are low
products[12].stockQty = 3; products[16].stockQty = 8; products[2].stockQty = 22

const purchases = [
  { id: 1, purchaseNo: 'PU262700001', purchaseDate: istDate(daysAgo(20)), supplierName: 'Astral Distributors', supplierGstin: '08AAACA1234A1Z5', supplierInvoiceNo: 'AD/2526/8812', notes: null, createdAt: iso(daysAgo(20)), items: [[1, 100, 360, 30], [2, 80, 560, 30], [4, 1000, 16, 35]] },
  { id: 2, purchaseNo: 'PU262700002', purchaseDate: istDate(daysAgo(12)), supplierName: 'Polycab Wires Pvt Ltd', supplierGstin: '24AAACP5678B1Z2', supplierInvoiceNo: 'PWL-55219', notes: 'Diwali stock', createdAt: iso(daysAgo(12)), items: [[15, 50, 1700, 28], [16, 40, 2650, 28]] },
  { id: 3, purchaseNo: 'PU262700003', purchaseDate: istDate(daysAgo(4)), supplierName: 'Jaquar & Co', supplierGstin: '06AAACJ1111C1Z9', supplierInvoiceNo: 'JQ/45110', notes: null, createdAt: iso(daysAgo(4)), items: [[9, 24, 2100, 25], [10, 10, 4700, 25], [14, 12, 1700, 25]] },
].map((p) => ({ ...p, items: p.items.map(([pid, q, lp, d]) => ({ productId: pid, productCode: products[pid - 1].code, productName: products[pid - 1].name, quantity: q, listPrice: lp, purchaseDiscountPercent: d, netRate: r2(lp * (1 - d / 100)), lineTotal: r2(lp * (1 - d / 100) * q), rackLabel: rackLocations[(pid - 1) % 24].label })) }))
purchases.forEach((pu) => { pu.totalAmount = r2(pu.items.reduce((s, i) => s + i.lineTotal, 0)); pu.items.forEach((i) => stockMoves.push({ id: mvId++, createdAt: pu.createdAt, productId: i.productId, type: 'PurchaseIn', quantity: i.quantity, balanceAfter: products[i.productId - 1].stockQty, unitCost: i.netRate, referenceType: 'Purchase', referenceNo: pu.purchaseNo, note: pu.supplierName })) })

const serviceRequests = [
  ['Plumber', 'Kitchen sink is leaking from below, need urgent repair', 0, 'Pending'],
  ['Electrician', 'Install 3 ceiling fans and 6 LED battens in new flat', 1, 'InProgress'],
  ['Plumber', 'Bathroom concealed pipe leakage, wall getting wet', 2, 'Pending'],
  ['Electrician', 'MCB tripping repeatedly in the evening', 3, 'Completed'],
  ['Plumber', 'Fit new geyser and mixer in bathroom', 5, 'Completed'],
].map(([t, desc, d, st], i) => ({
  id: i + 1, requestNo: `SR${String(i + 1).padStart(6, '0')}`, userId: customers[i % customers.length], createdAt: iso(daysAgo(d, 11)), serviceType: t, description: desc,
  contactName: user(customers[i % customers.length]).name, contactPhone: user(customers[i % customers.length]).phone, address: '20, Shantinagar, Mundra', pincode: '370421',
  preferredAt: iso(daysAgo(d - 1, 11)), status: st, assignedPartnerId: st !== 'Pending' ? (t === 'Plumber' ? 100 : 101) : null, adminNotes: null,
  history: [{ at: iso(daysAgo(d, 11)), status: 'Pending', note: 'Request created', by: null }, ...(st !== 'Pending' ? [{ at: iso(daysAgo(d, 13)), status: 'InProgress', note: 'Technician assigned', by: 'Neha Jain' }] : []), ...(st === 'Completed' ? [{ at: iso(daysAgo(d - 1, 18)), status: 'Completed', note: null, by: 'Neha Jain' }] : [])],
}))

const banners = [
  { id: 1, title: 'Everything to build your home', subtitle: 'Plumbing, sanitary, electrical & hardware — open 24x7', imageUrl: '/banners/hero-1.svg', mobileImageUrl: null, linkType: 'None', linkValue: null, placement: 'Both', sortOrder: 1, isActive: true },
  { id: 2, title: 'Partner prices for plumbers & electricians', subtitle: 'Download the BuildMate Partner app and earn reward points', imageUrl: '/banners/hero-2.svg', mobileImageUrl: null, linkType: 'Url', linkValue: '/partner', placement: 'Web', sortOrder: 2, isActive: true },
  { id: 3, title: 'Wiring season sale', subtitle: 'Ultravolt house wires, switches and MCBs in one place', imageUrl: '/banners/hero-3.svg', mobileImageUrl: null, linkType: 'ProductGroup', linkValue: '2', placement: 'Both', sortOrder: 3, isActive: true },
]
const sections = [
  { id: 5, title: 'Pipes & fittings', type: 'Category', referenceId: 1, maxItems: 12, placement: 'Both', sortOrder: 0, isActive: true },
  { id: 1, title: 'Bathroom fitting kit', type: 'ProductGroup', referenceId: 1, maxItems: 12, placement: 'Both', sortOrder: 1, isActive: true },
  { id: 2, title: 'Wiring essentials', type: 'ProductGroup', referenceId: 2, maxItems: 12, placement: 'Both', sortOrder: 2, isActive: true },
  { id: 3, title: 'Best deals', type: 'Discounted', referenceId: null, maxItems: 12, placement: 'Both', sortOrder: 3, isActive: true },
  { id: 4, title: 'Cement & building materials', type: 'Category', referenceId: 6, maxItems: 12, placement: 'Both', sortOrder: 4, isActive: true },
]
const outbox = orders.filter((o) => o.paidAt).slice(-25).map((o, i) => ({ id: i + 1, createdAt: o.paidAt, eventType: o.dispatch ? 'order.dispatched' : 'order.paid', status: 'Skipped', attempts: 0, lastError: null, processedAt: o.paidAt, payload: JSON.stringify({ orderNo: o.orderNo, grandTotal: o.grandTotal }) }))
function notify(userId, title, body, link) { notifications.push({ id: notifications.length + 1, userId, createdAt: iso(now()), title, body, link, isRead: false }) }
const carts = new Map() // userId -> [{productId, quantity}]
const sessions = new Map() // token -> userId

// ------------------------------------------------------------------ DTO mappers
const catName = (id) => categories.find((c) => c.id === id)?.name
const subName = (id) => subcategories.find((s) => s.id === id)?.name
const brName = (id) => brands.find((b) => b.id === id)?.name
const avail = (p) => r2(p.stockQty - p.reservedQty)
const price = (p, d) => r2(p.listPrice * (1 - d / 100))
const racksFor = (p) => p.locations.filter((l) => l.quantity > 0).map((l) => rackLocations.find((r) => r.id === l.rackLocationId).label).sort()
const adminProduct = (p) => ({
  ...p, categoryName: catName(p.categoryId), subCategoryName: subName(p.subCategoryId), brandName: brName(p.brandId), partnerPrice: price(p, p.partnerDiscountPercent),
  retailPrice: price(p, p.retailDiscountPercent), availableQty: avail(p), isLowStock: p.stockQty <= p.reorderLevel, rackLocations: racksFor(p), locations: undefined, ...movementOf(p), movementReferenceAt: undefined, agingFromAt: undefined,
})
const lookup = (p) => ({ id: p.id, code: p.code, name: p.name, brandName: brName(p.brandId), unit: p.unit, listPrice: p.listPrice, partnerDiscountPercent: p.partnerDiscountPercent, retailDiscountPercent: p.retailDiscountPercent, gstRate: p.gstRate, availableQty: avail(p), stockQty: p.stockQty, imageUrl: p.imageUrls[0], rackLocations: racksFor(p) })
const localName = (p, lang) => (lang && lang !== 'en' && p.translations[lang]) || p.name
const card = (p, v) => {
  const d = v.kind === 'Partner' ? p.partnerDiscountPercent : p.retailDiscountPercent
  return { id: p.id, code: p.code, name: localName(p, v.lang), brandName: brName(p.brandId), categoryId: p.categoryId, unit: p.unit, imageUrl: p.imageUrls[0] ?? null, mrp: p.mrp, listPrice: p.listPrice, discountPercent: d, price: price(p, d), inStock: avail(p) > 0, rewardPoints: v.kind === 'Partner' ? p.rewardPointsPerUnit : null, family: p.variantFamily, variantLabel: p.variantLabel ? displayLabel(p.variantLabel) : null, variantCount: 1, fromPrice: null, variantSummary: null }
}
const orderList = (o) => ({ id: o.id, orderNo: o.orderNo, createdAt: o.createdAt, channel: o.channel, customerKind: o.customerKind, status: o.status, paymentStatus: o.paymentStatus, fulfilmentType: o.fulfilmentType, scheduledAt: o.scheduledAt, customerName: o.customerName, customerPhone: o.customerPhone, itemCount: o.items.length, grandTotal: o.grandTotal, balanceDue: r2(o.grandTotal - o.amountPaid), rewardPointsEarned: o.rewardPointsEarned, invoiceNo: o.dispatch?.invoiceNo ?? null })
const editable = (o) => !o.dispatch && ['Paid', 'Processing', 'ReadyForPickup'].includes(o.status)
const customerEvents = new Set(['Order placed', 'Payment received', 'Pickup / delivery scheduled', 'Status updated', 'Dispatched', 'Delivered', 'Cancelled', 'Refund initiated'])
const orderDetail = (o, staff = true) => ({
  ...orderList(o), paymentMethod: o.paymentMethod, paidAt: o.paidAt, userId: o.userId, customerGstin: o.customerGstin, shipLine1: o.shipLine1, shipLine2: o.shipLine2, shipCity: o.shipCity, shipState: o.shipState, shipPincode: o.shipPincode,
  subTotal: o.subTotal, discountTotal: o.discountTotal, taxTotal: o.taxTotal, shippingFee: o.shippingFee, amountPaid: o.amountPaid, rewardsCredited: o.rewardsCredited,
  customerNotes: o.customerNotes, internalNotes: staff ? o.internalNotes : null, cancelReason: o.cancelReason, canEdit: editable(o), canDispatch: editable(o), canCancel: !o.dispatch && !['Cancelled', 'Completed'].includes(o.status),
  items: o.items.map((i) => ({ ...i, imageUrl: products[i.productId - 1].imageUrls[0], rackLocations: staff ? racksFor(products[i.productId - 1]) : [] })),
  events: staff ? o.events : o.events.filter((e) => customerEvents.has(e.action)).map((e) => ({ ...e, by: null })), payments: o.payments, dispatch: o.dispatch,
})
const SOLD = new Set(['Paid', 'Processing', 'ReadyForPickup', 'OutForDelivery', 'Completed'])
const partnerOrders = (uid) => orders.filter((o) => o.userId === uid && SOLD.has(o.status))
const partnerList = (p) => { const u = user(p.userId); const os = partnerOrders(p.userId); return { userId: p.userId, name: u.name, phone: u.phone, businessName: p.businessName, partnerType: p.partnerType, city: p.city, area: p.area, pincode: p.pincode, kycStatus: p.kycStatus, managerName: user(p.managerId)?.name ?? null, rewardBalance: p.rewardBalance, orderCount: os.length, totalPurchase: r2(os.reduce((s, o) => s + o.grandTotal, 0)), lastOrderAt: os.at(-1)?.createdAt ?? null, isActive: u.isActive, createdAt: u.createdAt } }
const partnerDetail = (p) => {
  const u = user(p.userId); const os = partnerOrders(p.userId); const total = r2(os.reduce((s, o) => s + o.grandTotal, 0))
  const top = {}; os.forEach((o) => o.items.forEach((i) => { top[i.productId] ??= { id: i.productId, name: i.productName, quantity: 0, amount: 0 }; top[i.productId].quantity += i.quantity; top[i.productId].amount = r2(top[i.productId].amount + i.lineTotal) }))
  return { ...p, name: u.name, phone: u.phone, email: u.email, isActive: u.isActive, createdAt: u.createdAt, lastLoginAt: u.lastLoginAt, kycReviewedByName: user(p.kycReviewedById)?.name ?? null, managerName: user(p.managerId)?.name ?? null,
    stats: { orderCount: os.length, totalPurchase: total, averageOrderValue: os.length ? r2(total / os.length) : 0, lastOrderAt: os.at(-1)?.createdAt ?? null, pointsEarned: r2(rewardTxns.filter((r) => r.partnerUserId === p.userId && r.type === 'Earned').reduce((s, r) => s + r.points, 0)), topProducts: Object.values(top).sort((a, b) => b.amount - a.amount).slice(0, 5) } }
}
const authUser = (u) => ({ id: u.id, name: u.name, phone: u.phone, email: u.email, userType: u.userType, kycStatus: partnerOf(u.id)?.kycStatus ?? null, roleName: roles.find((r) => r.id === u.roleId)?.name ?? null, permissions: u.userType === 'Staff' ? roles.find((r) => r.id === u.roleId).permissions : [], preferredLanguage: u.preferredLanguage ?? 'en' })
const issue = (u, isNew = false) => { const t = randomUUID(); const rt = randomUUID(); sessions.set(t, u.id); sessions.set(rt, u.id); u.lastLoginAt = iso(now()); return { accessToken: t, accessTokenExpiresAt: iso(Date.now() + 3600e3), refreshToken: rt, user: authUser(u), isNewUser: isNew } }

// ------------------------------------------------------------------ routes
const routes = []
const on = (method, pattern, fn) => routes.push({ method, re: new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), fn })

// auth
on('POST', '/api/auth/staff/login', ({ body }) => { const u = users.find((x) => x.userType === 'Staff' && x.email === (body.email ?? '').toLowerCase()); if (!u || body.password !== 'Admin@12345') fail(401, 'Incorrect email or password.', 'invalid_credentials'); return issue(u) })
on('POST', '/api/auth/otp/request', ({ body }) => { if (!/^\d{10}$/.test((body.phone ?? '').replace(/\D/g, '').slice(-10))) fail(400, 'Enter a valid 10-digit mobile number.'); return { message: 'OTP sent.' } })
// Same account rules as AuthService.SignInByPhoneAsync: an audience picks/creates that account; without one the
// partner account wins, then the customer account; a new number gets 409 signup_required.
function signInByPhone(phone, { audience, name, email, partnerType } = {}) {
  const accounts = users.filter((x) => x.phone === phone && (x.userType === 'Partner' || x.userType === 'Customer'))
  let u, type
  if (!audience) {
    u = accounts.find((x) => x.userType === 'Partner' && x.isActive) ?? accounts.find((x) => x.userType === 'Customer' && x.isActive) ?? accounts[0]
    if (!u) fail(409, 'No account for this number yet. Create one to continue.', 'signup_required')
    type = u.userType
  } else { type = audience === 'Partner' ? 'Partner' : 'Customer'; u = accounts.find((x) => x.userType === type) }
  let isNew = false
  if (!u) {
    isNew = true
    u = { id: 1000 + users.length, userType: type, name: name?.trim() ?? '', phone, email: null, isActive: true, createdAt: iso(now()), preferredLanguage: 'en' }; users.push(u)
    if (type === 'Partner') partners.push({ userId: u.id, partnerType: partnerType || 'Other', businessName: null, addressLine: null, area: null, city: null, state: null, pincode: null, gstin: null, kycStatus: 'NotSubmitted', documents: [], rewardBalance: 0, createdByAdmin: false, locationVerified: false, managerId: null, createdAt: iso(now()) })
  } else if (!u.isActive) fail(403, 'This account is disabled. Please contact the store.')
  if (!u.name && name) u.name = name.trim()
  if (!u.email && email?.includes('@') && !users.some((x) => x.email === email.trim().toLowerCase())) u.email = email.trim().toLowerCase()
  u.lastLoginAt = iso(now())
  return issue(u, isNew)
}
const phone10 = (v) => { const d = String(v ?? '').replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '').replace(/^0(?=\d{10}$)/, ''); if (!/^[6-9]\d{9}$/.test(d)) fail(400, 'Enter a valid 10-digit mobile number.'); return d }
on('POST', '/api/auth/otp/verify', ({ body }) => {
  if (body.code !== '123456') fail(400, 'Incorrect OTP.', 'otp_invalid')
  return signInByPhone(phone10(body.phone), body)
})
// Firebase phone sign-in. DEMO ONLY: the mock decodes the token without checking Google's signature (the real API
// verifies it — FirebaseTokenVerifier). It still checks the project and that a phone number was verified.
const FIREBASE_PROJECTS = (process.env.FIREBASE_PROJECT_ID ?? 'buildmate24x7,buildmate-24x7').split(',').map((x) => x.trim())
on('POST', '/api/auth/firebase', ({ body }) => {
  let claims
  try { claims = JSON.parse(Buffer.from(String(body.idToken ?? '').split('.')[1], 'base64url').toString('utf8')) } catch { fail(401, "We couldn't verify your sign-in. Please try again.", 'firebase_token_invalid') }
  if (!FIREBASE_PROJECTS.includes(claims.aud) || claims.iss !== `https://securetoken.google.com/${claims.aud}`) fail(401, "We couldn't verify your sign-in. Please try again.", 'firebase_token_invalid')
  if (claims.exp * 1000 < Date.now() - 120e3) fail(401, 'Your sign-in expired. Please verify your number again.', 'firebase_token_expired')
  if (!claims.phone_number) fail(401, 'Sign in with your mobile number.', 'firebase_phone_required')
  return signInByPhone(phone10(claims.phone_number), body)
})
on('POST', '/api/auth/refresh', ({ body }) => { const id = sessions.get(body.refreshToken); if (!id) fail(401, 'Session expired. Please log in again.', 'refresh_invalid'); return issue(user(id)) })
on('POST', '/api/auth/logout', () => null)
on('GET', '/api/auth/me', ({ me }) => authUser(me()))

// public catalogue
const viewer = (req, uid) => ({ channel: (req.headers['x-client'] ?? 'web') === 'app' ? 'App' : 'Web', kind: uid && user(uid)?.userType === 'Partner' ? 'Partner' : 'Retail', lang: (req.headers['accept-language'] ?? 'en').slice(0, 2) })
const visible = (v) => products.filter((p) => p.isActive && (v.channel === 'Web' ? p.showOnWeb : p.showOnApp))
function search(q, v) {
  let rows = visible(v)
  if (q.q) {
    // every word must match somewhere (name, code, brand, alias or translation), so "coupler 25" finds "… Coupler SDR 11 – 25 mm"
    const terms = q.q.toLowerCase().split(/\s+/).filter(Boolean)
    rows = rows.filter((p) => { const hay = [p.name, p.code, brName(p.brandId), ...p.aliases, ...Object.values(p.translations)].join(' ').toLowerCase(); return terms.every((t) => hay.includes(t)) })
  }
  if (q.categoryId) rows = rows.filter((p) => p.categoryId == q.categoryId)
  if (q.subCategoryId) rows = rows.filter((p) => p.subCategoryId == q.subCategoryId)
  if (q.brandId) rows = rows.filter((p) => p.brandId == q.brandId)
  if (q.groupId) rows = rows.filter((p) => p.groupIds.includes(Number(q.groupId)))
  if (q.inStock === 'true') rows = rows.filter((p) => avail(p) > 0)
  if (q.discounted === 'true' || q.discounted === true) rows = rows.filter((p) => (v.kind === 'Partner' ? p.partnerDiscountPercent : p.retailDiscountPercent) >= 10)
  const pr = (p) => price(p, v.kind === 'Partner' ? p.partnerDiscountPercent : p.retailDiscountPercent)
  rows = [...rows].sort(q.sort === 'price_asc' ? (a, b) => pr(a) - pr(b) : q.sort === 'price_desc' ? (a, b) => pr(b) - pr(a) : q.sort === 'newest' ? (a, b) => b.id - a.id : q.sort === 'name' ? (a, b) => a.name.localeCompare(b.name) : (a, b) => a.sequence - b.sequence)
  if (q.collapse === 'true') rows = firstOfEachFamily(rows)
  const res = page(rows.map((p) => card(p, v)), { page: q.page, pageSize: q.pageSize ?? 24 })
  if (q.collapse === 'true') res.items = withFamilyInfo(res.items, v)
  return res
}
const firstOfEachFamily = (rows) => { const seen = new Set(); return rows.filter((p) => !p.variantFamily || (!seen.has(p.variantFamily) && seen.add(p.variantFamily))) }
const familyMembers = (fam, v) => visible(v).filter((p) => p.variantFamily === fam).sort((a, b) => a.sequence - b.sequence || a.id - b.id)
// Option families: a label like "Size: 1.5 sq.mm; Colour: Red; Length: 90 m" (same rules as Catalog/Variants.cs).
const parseOpts = (label) => (label && label.includes(':') ? label.split(';').map((p) => p.split(':')).filter((kv) => kv.length >= 2).map(([k, ...v]) => [k.trim(), v.join(':').trim()]).filter(([k, v]) => k && v) : [])
const displayLabel = (label) => { const o = parseOpts(label); return o.length ? o.map(([, v]) => v).join(' · ') : label }
const NOUNS = { size: ['size', 'sizes'], colour: ['colour', 'colours'], length: ['length', 'lengths'], type: ['type', 'types'], category: ['category', 'categories'], conductor: ['conductor', 'conductors'], cores: ['core option', 'core options'], pairs: ['pair option', 'pair options'] }
const variantSummary = (labels) => {
  const parsed = labels.map(parseOpts)
  if (!parsed.length || parsed.some((p) => p.length < 2)) return `${labels.length} sizes`
  const names = [...new Set(parsed.flatMap((p) => p.map(([k]) => k)))]
  const parts = names.map((n) => [n, new Set(parsed.map((p) => (p.find(([k]) => k === n) ?? [])[1]).filter(Boolean)).size]).filter(([, c]) => c > 1)
    .map(([n, c]) => `${c} ${(NOUNS[n.toLowerCase()] ?? [n.toLowerCase(), n.toLowerCase() + 's'])[c === 1 ? 0 : 1]}`)
  return parts.length ? parts.join(' · ') : `${labels.length} options`
}
const variantAxes = (currentId, members) => {
  const parsed = members.map((m) => ({ id: m.id, inStock: avail(m) > 0, opts: Object.fromEntries(parseOpts(m.variantLabel)) }))
  if (parsed.length < 2 || parsed.some((p) => Object.keys(p.opts).length < 2)) return []
  const cur = parsed.find((p) => p.id === currentId); if (!cur) return []
  const names = [...new Set(parsed.flatMap((p) => Object.keys(p.opts)))]
  const weight = (n) => 2 ** (names.length - names.indexOf(n))
  const axes = []
  for (const axis of names) {
    const values = [...new Set(parsed.map((p) => p.opts[axis]).filter(Boolean))]
    if (values.length < 2) continue
    const full = names.filter((n) => n !== axis && cur.opts[n] != null).reduce((s, n) => s + weight(n), 0)
    axes.push({ name: axis, choices: values.map((value) => {
      const best = parsed.filter((p) => p.opts[axis] === value)
        .map((c) => ({ c, score: names.filter((n) => n !== axis && c.opts[n] != null && c.opts[n] === cur.opts[n]).reduce((s, n) => s + weight(n), 0) }))
        .sort((a, b) => b.score - a.score)[0]
      return { value, productId: best.c.id, selected: cur.opts[axis] === value, exact: best.score === full, inStock: best.c.inStock }
    }) })
  }
  return axes.length >= 2 ? axes : []
}
const withFamilyInfo = (cards, v) => cards.map((c) => {
  if (!c.family) return c
  const m = familyMembers(c.family, v)
  if (m.length < 2) return c
  const d = (p) => (v.kind === 'Partner' ? p.partnerDiscountPercent : p.retailDiscountPercent)
  return { ...c, name: c.family, variantCount: m.length, fromPrice: Math.min(...m.map((p) => price(p, d(p)))), inStock: m.some((p) => avail(p) > 0), variantSummary: variantSummary(m.map((p) => p.variantLabel)) }
})
const detail = (p, v) => {
  const c = card(p, v)
  const members = p.variantFamily ? familyMembers(p.variantFamily, v) : []
  const d = (x) => (v.kind === 'Partner' ? x.partnerDiscountPercent : x.retailDiscountPercent)
  const related = firstOfEachFamily(visible(v).filter((x) => x.id !== p.id && x.subCategoryId === p.subCategoryId && (!p.variantFamily || x.variantFamily !== p.variantFamily)).sort((a, b) => a.sequence - b.sequence)).slice(0, 8)
  return {
    ...c, description: p.description, brandId: p.brandId, categoryName: catName(p.categoryId), subCategoryId: p.subCategoryId, subCategoryName: subName(p.subCategoryId), hsnCode: p.hsnCode, gstRate: p.gstRate, imageUrls: p.imageUrls, maxOrderQty: Math.max(0, avail(p)), otherNames: [...Object.values(p.translations), ...p.aliases],
    related: withFamilyInfo(related.map((x) => card(x, v)), v),
    variants: members.length > 1 ? members.map((x) => ({ id: x.id, code: x.code, label: x.variantLabel ? displayLabel(x.variantLabel) : x.name, mrp: x.mrp, price: price(x, d(x)), inStock: avail(x) > 0 })) : [],
    variantAxes: members.length > 1 ? variantAxes(p.id, members) : [],
    specs: p.specs.map((x) => { const i = x.indexOf(':'); return { name: x.slice(0, i).trim(), value: x.slice(i + 1).trim() } }).filter((x) => x.name && x.value),
  }
}
const storeInfo = () => ({ storeName: settings.storeName, supportPhone: settings.supportPhone, whatsAppNumber: settings.whatsAppNumber, supportEmail: settings.supportEmail, address: [settings.addressLine, settings.city, settings.state, settings.pincode].filter(Boolean).join(', '), openingHours: settings.openingHours, minOrderValue: settings.minOrderValue, deliveryFee: settings.deliveryFee, freeDeliveryAbove: settings.freeDeliveryAbove, homeDeliveryEnabled: settings.homeDeliveryEnabled, storePickupEnabled: settings.storePickupEnabled, supportedLanguages: settings.supportedLanguages, androidAppUrl: settings.androidAppUrl, iosAppUrl: settings.iosAppUrl, minAppVersion: settings.minAppVersion })
const catTree = (v) => categories.filter((c) => c.isActive).map((c) => ({ id: c.id, name: c.name, imageUrl: c.imageUrl, productCount: visible(v).filter((p) => p.categoryId === c.id).length, subCategories: subcategories.filter((s) => s.categoryId === c.id && s.isActive).map((s) => ({ id: s.id, name: s.name })) }))
on('GET', '/api/catalog/home', ({ req, uid }) => {
  const v = viewer(req, uid); const place = v.channel
  return {
    banners: banners.filter((b) => b.isActive && (b.placement === 'Both' || b.placement === place)).sort((a, b) => a.sortOrder - b.sortOrder),
    categories: catTree(v), brands: brands.filter((b) => b.isActive).map((b) => ({ id: b.id, name: b.name, logoUrl: b.logoUrl })),
    sections: sections.filter((s) => s.isActive && (s.placement === 'Both' || s.placement === place)).sort((a, b) => a.sortOrder - b.sortOrder).map((s) => ({ id: s.id, title: s.title, type: s.type, referenceId: s.referenceId,
      products: search({ ...(s.type === 'ProductGroup' ? { groupId: s.referenceId } : s.type === 'Category' ? { categoryId: s.referenceId } : s.type === 'Brand' ? { brandId: s.referenceId } : s.type === 'Discounted' ? { discounted: 'true' } : { sort: 'newest' }), pageSize: s.maxItems, collapse: 'true' }, v).items })).filter((s) => s.products.length),
    store: storeInfo(),
  }
})
on('GET', '/api/catalog/store', () => storeInfo())
on('GET', '/api/catalog/categories', ({ req, uid }) => catTree(viewer(req, uid)))
// Every visible product of a category, one row per size, with specifications as a map (CatalogService.CategoryItemsAsync).
on('GET', '/api/catalog/categories/:id/items', ({ req, uid, p, q }) => {
  const v = viewer(req, uid)
  return visible(v).filter((x) => x.categoryId == p.id && (!q.subCategoryId || x.subCategoryId == q.subCategoryId) && brands.find((b) => b.id === x.brandId)?.isActive !== false)
    .sort((a, b) => a.sequence - b.sequence || a.id - b.id)
    .map((x) => {
      const c = card(x, v)
      const specs = Object.fromEntries((x.specs ?? []).map((s) => s.split(/:(.*)/s)).filter((kv) => kv.length > 1).map(([k, val]) => [k.trim(), val.trim()]))
      return { id: x.id, code: x.code, name: c.name, brandName: c.brandName, brandId: x.brandId, subCategoryId: x.subCategoryId, subCategoryName: subName(x.subCategoryId) ?? null,
        unit: x.unit, imageUrl: c.imageUrl, mrp: x.mrp, listPrice: x.listPrice, discountPercent: c.discountPercent, price: c.price, inStock: c.inStock, rewardPoints: c.rewardPoints ?? null,
        family: x.variantFamily ?? null, variantLabel: x.variantLabel ? displayLabel(x.variantLabel) : null, specs, sequence: x.sequence }
    })
})
on('GET', '/api/catalog/brands', () => brands.filter((b) => b.isActive).map((b) => ({ id: b.id, name: b.name, logoUrl: b.logoUrl })))
on('GET', '/api/catalog/groups', () => groups.filter((g) => g.isActive).map((g) => ({ id: g.id, name: g.name, imageUrl: g.imageUrl })))
on('GET', '/api/catalog/products', ({ req, uid, q }) => search(q, viewer(req, uid)))
on('GET', '/api/catalog/products/:id', ({ req, uid, p }) => { const x = products.find((y) => y.id == p.id && y.isActive); if (!x) fail(404, 'Product not found.'); return detail(x, viewer(req, uid)) })
on('GET', '/api/catalog/scan/:code', ({ req, uid, p }) => { const c = decodeURIComponent(p.code).trim(); const x = products.find((y) => y.isActive && (y.code === c.toUpperCase() || (y.barcode && y.barcode === c))); if (!x) fail(404, 'Product for this code not found.'); return detail(x, viewer(req, uid)) })
on('POST', '/api/catalog/products/batch', ({ req, uid, body }) => body.map((id) => products.find((p) => p.id === id)).filter(Boolean).map((p) => card(p, viewer(req, uid))))

// cart & checkout
const cartOf = (uid) => { if (!carts.has(uid)) carts.set(uid, []); return carts.get(uid) }
function cartDto(uid, v, fulfilment = 'StorePickup') {
  const issues = []
  const items = cartOf(uid).map((c) => {
    const p = products[c.productId - 1]; const d = v.kind === 'Partner' ? p.partnerDiscountPercent : p.retailDiscountPercent; const u = price(p, d)
    let issue = null; if (avail(p) <= 0) issue = 'Out of stock'; else if (c.quantity > avail(p)) issue = `Only ${avail(p)} in stock`
    if (issue) issues.push(`${p.name}: ${issue}`)
    return { productId: p.id, code: p.code, name: localName(p, v.lang), brandName: brName(p.brandId), unit: p.unit, imageUrl: p.imageUrls[0], quantity: c.quantity, listPrice: p.listPrice, discountPercent: d, unitPrice: u, lineTotal: r2(u * c.quantity), mrp: p.mrp, availableQty: Math.max(0, avail(p)), rewardPoints: v.kind === 'Partner' ? r2(p.rewardPointsPerUnit * c.quantity) : null, issue }
  })
  const subTotal = r2(items.reduce((s, i) => s + i.listPrice * i.quantity, 0)); const total = r2(items.reduce((s, i) => s + i.lineTotal, 0))
  if (items.length && total < settings.minOrderValue) issues.push(`Minimum order value is ₹${settings.minOrderValue}.`)
  if (v.kind === 'Partner' && partnerOf(uid)?.kycStatus !== 'Approved') issues.push('Your account is awaiting KYC approval. You can order once approved.')
  const fee = fulfilment === 'HomeDelivery' && !(settings.freeDeliveryAbove > 0 && total >= settings.freeDeliveryAbove) ? settings.deliveryFee : 0
  const exact = r2(total + fee); const payable = Math.round(exact)
  return { items, itemCount: items.length, subTotal, discountTotal: r2(subTotal - total), total, roundOff: r2(payable - exact), payable, rewardPoints: r2(items.reduce((s, i) => s + (i.rewardPoints ?? 0), 0)), deliveryFee: fee, freeDeliveryAbove: settings.freeDeliveryAbove, minOrderValue: settings.minOrderValue, canCheckout: items.length > 0 && issues.length === 0, issues, storePickupEnabled: settings.storePickupEnabled, homeDeliveryEnabled: settings.homeDeliveryEnabled }
}
const setQty = (uid, productId, qtyV, add) => {
  const c = cartOf(uid); const row = c.find((x) => x.productId === productId); const p = products[productId - 1]; if (!p) fail(404, 'Product not found.')
  const q = add ? (row?.quantity ?? 0) + qtyV : qtyV
  if (q > avail(p)) fail(409, `Only ${Math.max(0, avail(p))} ${p.unit} of ${p.name} in stock.`, 'insufficient_stock')
  if (q <= 0) carts.set(uid, c.filter((x) => x.productId !== productId)); else if (row) row.quantity = q; else c.push({ productId, quantity: q })
}
on('GET', '/api/cart', ({ req, me, q }) => cartDto(me().id, viewer(req, me().id), q.fulfilment))
on('POST', '/api/cart/items', ({ req, me, body }) => { setQty(me().id, body.productId, body.quantity, true); return cartDto(me().id, viewer(req, me().id)) })
on('PUT', '/api/cart/items', ({ req, me, body }) => { setQty(me().id, body.productId, body.quantity, false); return cartDto(me().id, viewer(req, me().id)) })
on('DELETE', '/api/cart/items/:pid', ({ req, me, p }) => { carts.set(me().id, cartOf(me().id).filter((x) => x.productId != p.pid)); return cartDto(me().id, viewer(req, me().id)) })
on('POST', '/api/cart/merge', ({ req, me, body }) => { for (const i of body) { try { setQty(me().id, i.productId, i.quantity, false) } catch { /* skip */ } } return cartDto(me().id, viewer(req, me().id)) })
on('DELETE', '/api/cart', ({ me }) => { carts.set(me().id, []); return null })
on('POST', '/api/orders/checkout', ({ req, me, body }) => {
  const u = me(); const v = viewer(req, u.id); const cart = cartDto(u.id, v, body.fulfilmentType)
  if (!cart.items.length) fail(400, 'Your cart is empty.'); if (!cart.canCheckout) fail(409, cart.issues.join(' '), 'cart_invalid')
  if (body.fulfilmentType === 'HomeDelivery' && !addresses.some((a) => a.id === body.addressId && a.userId === u.id)) fail(400, 'Choose a delivery address.')
  const o = makeOrder({ userId: u.id, kind: v.kind, channel: v.channel, at: now(), lines: cart.items.map((i) => [i.productId, i.quantity]), fulfilment: body.fulfilmentType, status: 'PendingPayment' })
  delete o._clock
  if (body.fulfilmentType === 'HomeDelivery') { const a = addresses.find((x) => x.id === body.addressId); Object.assign(o, { shipLine1: a.line1, shipLine2: a.line2, shipCity: a.city, shipState: a.state, shipPincode: a.pincode }) }
  o.customerNotes = body.notes ?? null; o.scheduledAt = body.preferredAt ?? null
  return { orderId: o.id, orderNo: o.orderNo, amount: o.grandTotal, gatewayOrderId: `${o.orderNo}-1`, paymentSessionId: 'mock_session', environment: 'mock' }
})
on('POST', '/api/orders/:id/pay', ({ me, p }) => { const o = orders.find((x) => x.id == p.id && x.userId === me().id); if (!o) fail(404, 'Order not found.'); return { orderId: o.id, orderNo: o.orderNo, amount: o.grandTotal, gatewayOrderId: `${o.orderNo}-2`, paymentSessionId: 'mock_session', environment: 'mock' } })
on('POST', '/api/orders/:id/confirm-payment', ({ me, p }) => {
  const o = orders.find((x) => x.id == p.id && x.userId === me().id); if (!o) fail(404, 'Order not found.')
  if (o.status === 'PendingPayment') { pay(o, 'Cashfree'); const ids = new Set(o.items.map((i) => i.productId)); carts.set(me().id, cartOf(me().id).filter((c) => !ids.has(c.productId))) }
  return { orderId: o.id, orderNo: o.orderNo, status: o.status, paymentStatus: o.paymentStatus, message: 'Payment received. Thank you!' }
})
on('GET', '/api/orders', ({ me, q }) => page(orders.filter((o) => o.userId === me().id && (!q.status || o.status === q.status)).reverse().map(orderList), q))
on('GET', '/api/orders/:id', ({ me, p }) => { const o = orders.find((x) => x.id == p.id && x.userId === me().id); if (!o) fail(404, 'Order not found.'); return orderDetail(o, false) })
on('GET', '/api/orders/:id/invoice', ({ me, p }) => invoice(orders.find((x) => x.id == p.id && x.userId === me().id)))
on('POST', '/api/orders/:id/cancel', ({ me, p }) => { const o = orders.find((x) => x.id == p.id && x.userId === me().id); if (!o) fail(404, 'Order not found.'); if (o.status !== 'PendingPayment') fail(409, 'This order is already paid. Please call the store to cancel it.'); cancel(o, 'Cancelled by customer before payment'); return orderDetail(o, false) })

// quotations — ask for the store's price on the cart; staff add an extra discount per line; accept → order → pay
const quotes = []; let quoteSeq = 1, qItemId = 1
function quoteRecalc(q) {
  for (const i of q.items) { i.unitPrice = r2(i.listPrice * (1 - Math.min(100, i.discountPercent + i.specialDiscountPercent) / 100)); i.lineTotal = r2(i.unitPrice * i.quantity) }
  q.subTotal = r2(q.items.reduce((s, i) => s + i.listPrice * i.quantity, 0)); const net = r2(q.items.reduce((s, i) => s + i.lineTotal, 0))
  q.discountTotal = r2(q.subTotal - net); const exact = r2(net + q.shippingFee); q.grandTotal = Math.round(exact); q.roundOff = r2(q.grandTotal - exact)
}
const quoteStatus = (q) => (q.status === 'Quoted' && q.validUntil && new Date(q.validUntil) < now() ? 'Expired' : q.status)
const quoteSummary = (q) => ({ id: q.id, quoteNo: q.quoteNo, createdAt: q.createdAt, status: quoteStatus(q), customerKind: q.customerKind, customerName: q.customerName, customerPhone: q.customerPhone, fulfilmentType: q.fulfilmentType, itemCount: q.items.length, subTotal: q.subTotal, grandTotal: q.grandTotal, validUntil: q.validUntil, orderId: q.orderId })
function quoteDto(q, staff) {
  const a = addresses.find((x) => x.id === q.addressId)
  return { ...quoteSummary(q), channel: q.channel, addressText: a ? [a.name, a.line1, a.line2, a.landmark, a.city, a.pincode].filter(Boolean).join(', ') : null, preferredAt: q.preferredAt, customerNotes: q.customerNotes,
    items: q.items.map((i) => { const p = products[i.productId - 1]; return { id: i.id, productId: i.productId, code: i.productCode, name: i.productName, imageUrl: p.imageUrls[0] ?? null, unit: p.unit, quantity: i.quantity, listPrice: i.listPrice, discountPercent: i.discountPercent, specialDiscountPercent: i.specialDiscountPercent, unitPrice: i.unitPrice, lineTotal: i.lineTotal, rewardPoints: i.rewardPoints, averageCost: staff ? p.averageCost ?? null : null, availableQty: staff ? Math.max(0, avail(p)) : null } }),
    discountTotal: q.discountTotal, shippingFee: q.shippingFee, roundOff: q.roundOff, rewardPoints: r2(q.items.reduce((s, i) => s + i.rewardPoints, 0)), storeMessage: q.storeMessage, quotedAt: q.quotedAt, quotedByName: q.quotedByName, respondedAt: q.respondedAt, cancelReason: q.cancelReason, orderNo: orders.find((o) => o.id === q.orderId)?.orderNo ?? null }
}
function makeQuote(uid, v, body, lines, at = now()) {
  const u = user(uid); const a = body.fulfilmentType === 'HomeDelivery' ? addresses.find((x) => x.id === body.addressId && x.userId === uid) : null
  if (body.fulfilmentType === 'HomeDelivery' && !a) fail(400, 'Choose a delivery address.')
  const q = { id: quotes.length + 1, quoteNo: `Q${istDate(at).slice(2, 4)}${istDate(at).slice(5, 7)}${String(quoteSeq++).padStart(5, '0')}`, createdAt: iso(at), userId: uid, customerKind: v.kind, channel: v.channel, status: 'Requested',
    fulfilmentType: body.fulfilmentType, addressId: a?.id ?? null, preferredAt: body.preferredAt ?? null, customerNotes: body.notes ?? null, customerName: u.name || 'Customer', customerPhone: u.phone,
    shippingFee: 0, storeMessage: null, quotedAt: null, quotedByName: null, validUntil: null, respondedAt: null, cancelReason: null, orderId: null,
    items: lines.map(([pid, qty]) => { const p = products[pid - 1]; return { id: qItemId++, productId: p.id, productCode: p.code, productName: p.name, quantity: qty, listPrice: p.listPrice, discountPercent: discFor(p, v.kind), specialDiscountPercent: 0, gstRate: p.gstRate, rewardPoints: v.kind === 'Partner' ? r2(p.rewardPointsPerUnit * qty) : 0 } }) }
  quoteRecalc(q)
  if (body.fulfilmentType === 'HomeDelivery' && !(settings.freeDeliveryAbove > 0 && q.grandTotal >= settings.freeDeliveryAbove)) { q.shippingFee = settings.deliveryFee; quoteRecalc(q) }
  quotes.push(q); return q
}
function priceQuote(q, body, by) {
  const st = quoteStatus(q); if (!['Requested', 'Quoted', 'Expired'].includes(st)) fail(409, 'This quotation is already closed.', 'quote_closed')
  if (!(body.validDays >= 1 && body.validDays <= 30)) fail(400, 'Validity must be 1 to 30 days.')
  for (const l of body.lines ?? []) { const i = q.items.find((x) => x.id === l.itemId); if (!i) fail(400, 'Unknown line in the quotation.'); if (l.specialDiscountPercent < 0 || i.discountPercent + l.specialDiscountPercent > 100) fail(400, `${i.productName}: the discount must be between 0 and ${100 - i.discountPercent}%.`); i.specialDiscountPercent = r2(l.specialDiscountPercent) }
  if (body.shippingFee != null) q.shippingFee = r2(body.shippingFee); if (q.fulfilmentType === 'StorePickup') q.shippingFee = 0
  quoteRecalc(q)
  Object.assign(q, { status: 'Quoted', storeMessage: body.message?.trim() || null, quotedAt: iso(now()), quotedByName: by, validUntil: iso(new Date(new Date(`${istDate(new Date(now().getTime() + body.validDays * 864e5))}T23:59:59+05:30`))) })
  notify(q.userId, `Your quotation ${q.quoteNo} is ready`, `Price ₹${q.grandTotal} for ${q.items.length} item(s).`, `quote:${q.id}`)
}
on('POST', '/api/quotations', ({ req, me, body }) => {
  const u = me(); const v = viewer(req, u.id); const lines = cartOf(u.id).map((c) => [c.productId, c.quantity])
  if (!lines.length) fail(400, 'Add products to your cart to ask for a quote.')
  const q = makeQuote(u.id, v, body, lines); carts.set(u.id, []); return quoteDto(q, false)
})
on('GET', '/api/quotations', ({ me, q }) => page(quotes.filter((x) => x.userId === me().id).reverse().map(quoteSummary), q))
const myQuote = (me, id) => { const q = quotes.find((x) => x.id == id && x.userId === me().id); if (!q) fail(404, 'Quotation not found.'); return q }
on('GET', '/api/quotations/:id', ({ me, p }) => quoteDto(myQuote(me, p.id), false))
on('POST', '/api/quotations/:id/decline', ({ me, p }) => { const q = myQuote(me, p.id); if (!['Requested', 'Quoted'].includes(q.status)) fail(409, 'This quotation is already closed.', 'quote_closed'); Object.assign(q, { status: 'Declined', respondedAt: iso(now()) }); return quoteDto(q, false) })
on('POST', '/api/quotations/:id/accept', ({ me, p }) => {
  const q = myQuote(me, p.id)
  if (q.status === 'Accepted' && q.orderId) { const o = orders.find((x) => x.id === q.orderId); if (o.status !== 'PendingPayment') fail(409, `Order ${o.orderNo} for this quotation is already paid.`, 'already_paid'); return { orderId: o.id, orderNo: o.orderNo, amount: o.grandTotal, gatewayOrderId: `${o.orderNo}-2`, paymentSessionId: 'mock_session', environment: 'mock' } }
  const st = quoteStatus(q)
  if (st === 'Requested') fail(409, "The store hasn't priced this quotation yet.", 'quote_not_ready')
  if (st === 'Expired') fail(409, 'This price has expired. Ask the store to send a fresh quotation.', 'quote_expired')
  if (st !== 'Quoted') fail(409, 'This quotation is closed.', 'quote_closed')
  if (q.customerKind === 'Partner' && partnerOf(q.userId)?.kycStatus !== 'Approved') fail(409, 'Your account is awaiting KYC approval. You can order once approved.', 'kyc_pending')
  for (const i of q.items) { const pr = products[i.productId - 1]; if (avail(pr) < i.quantity) fail(409, `Only ${Math.max(0, avail(pr))} of ${pr.name} in stock right now. Call the store to arrange the rest.`, 'insufficient_stock') }
  const o = makeOrder({ userId: q.userId, kind: q.customerKind, channel: q.channel, at: now(), lines: q.items.map((i) => [i.productId, i.quantity]), fulfilment: q.fulfilmentType, status: 'PendingPayment' })
  delete o._clock
  o.items.forEach((oi, k) => { const qi = q.items[k]; Object.assign(oi, { listPrice: qi.listPrice, discountPercent: qi.discountPercent, specialDiscountPercent: qi.specialDiscountPercent, rewardPoints: qi.rewardPoints }) })
  o.shippingFee = q.shippingFee; recalc(o)
  const a = addresses.find((x) => x.id === q.addressId); if (a) Object.assign(o, { shipLine1: a.line1, shipLine2: a.line2, shipCity: a.city, shipState: a.state, shipPincode: a.pincode })
  o.customerNotes = q.customerNotes; o.events[0].details = `From quotation ${q.quoteNo}: ${o.items.length} item(s), ₹${o.grandTotal.toFixed(2)}`
  Object.assign(q, { status: 'Accepted', respondedAt: iso(now()), orderId: o.id })
  return { orderId: o.id, orderNo: o.orderNo, amount: o.grandTotal, gatewayOrderId: `${o.orderNo}-1`, paymentSessionId: 'mock_session', environment: 'mock' }
})
on('GET', '/api/admin/quotations', ({ q }) => {
  let rows = quotes.slice().sort((a, b) => (a.status === 'Requested' ? 0 : 1) - (b.status === 'Requested' ? 0 : 1) || b.id - a.id)
  if (q.status) rows = rows.filter((x) => quoteStatus(x) === q.status)
  if (q.search) { const s = q.search.toLowerCase(); rows = rows.filter((x) => x.quoteNo.toLowerCase().includes(s) || x.customerName.toLowerCase().includes(s) || (x.customerPhone ?? '').includes(s)) }
  return page(rows.map(quoteSummary), q)
})
const anyQuote = (id) => { const q = quotes.find((x) => x.id == id); if (!q) fail(404, 'Quotation not found.'); return q }
on('GET', '/api/admin/quotations/:id', ({ p }) => quoteDto(anyQuote(p.id), true))
on('POST', '/api/admin/quotations/:id/price', ({ p, body, me }) => { const q = anyQuote(p.id); priceQuote(q, body, me().name); return quoteDto(q, true) })
on('POST', '/api/admin/quotations/:id/cancel', ({ p, body }) => { const q = anyQuote(p.id); if (!body.reason?.trim()) fail(400, 'Give a reason — the customer sees it.'); if (['Accepted', 'Declined', 'Cancelled'].includes(q.status)) fail(409, 'This quotation is already closed.', 'quote_closed'); Object.assign(q, { status: 'Cancelled', cancelReason: body.reason.trim() }); notify(q.userId, `Quotation ${q.quoteNo} was closed`, q.cancelReason, `quote:${q.id}`); return quoteDto(q, true) })
// demo: a site enquiry from a partner waiting for a price, and a priced one for a customer
{
  const pu = partners.find((x) => x.kycStatus === 'Approved')?.userId; const cu = users.find((x) => x.userType === 'Customer')?.id
  if (pu) makeQuote(pu, { kind: 'Partner', channel: 'App' }, { fulfilmentType: 'StorePickup', notes: 'Site at Adani township, need 3 bathrooms worth. Best rate please.' }, [[1, 12], [3, 6], [5, 6]], new Date(now().getTime() - 5 * 3600e3))
  if (cu) { const aid = addresses.find((x) => x.userId === cu)?.id; const q = makeQuote(cu, { kind: 'Retail', channel: 'Web' }, { fulfilmentType: aid ? 'HomeDelivery' : 'StorePickup', addressId: aid, notes: 'For new house wiring' }, [[2, 1], [4, 2]], new Date(now().getTime() - 26 * 3600e3)); priceQuote(q, { lines: q.items.map((i) => ({ itemId: i.id, specialDiscountPercent: 3 })), validDays: 7, message: 'Extra 3% off. Delivery within 2 days of payment.' }, 'Rakesh Sharma') }
}

// account
on('PUT', '/api/account/profile', ({ me, body }) => { Object.assign(me(), { name: body.name, email: body.email ?? null, preferredLanguage: body.preferredLanguage ?? me().preferredLanguage }); return null })
on('GET', '/api/account/addresses', ({ me }) => addresses.filter((a) => a.userId === me().id))
on('POST', '/api/account/addresses', ({ me, body }) => { const a = { id: addresses.length + 1, userId: me().id, ...body, isDefault: body.isDefault || !addresses.some((x) => x.userId === me().id) }; if (a.isDefault) addresses.forEach((x) => { if (x.userId === me().id) x.isDefault = false }); addresses.push(a); return a })
on('PUT', '/api/account/addresses/:id', ({ me, p, body }) => { const a = addresses.find((x) => x.id == p.id && x.userId === me().id); Object.assign(a, body); return a })
on('DELETE', '/api/account/addresses/:id', ({ me, p }) => { const i = addresses.findIndex((x) => x.id == p.id && x.userId === me().id); if (i >= 0) addresses.splice(i, 1); return null })
on('GET', '/api/account/notifications', ({ me, q }) => page(notifications.filter((n) => n.userId === me().id).reverse(), { ...q, pageSize: 30 }))
on('GET', '/api/account/notifications/unread-count', ({ me }) => ({ count: notifications.filter((n) => n.userId === me().id && !n.isRead).length }))
on('POST', '/api/account/notifications/read', ({ me, q }) => { notifications.filter((n) => n.userId === me().id && (!q.id || n.id == q.id)).forEach((n) => { n.isRead = true }); return null })
on('POST', '/api/account/devices', () => null)
on('DELETE', '/api/account', ({ me }) => { me().isActive = false; return null })

// service requests (customer)
on('POST', '/api/service-requests', ({ me, body }) => { const u = me(); const r = { id: serviceRequests.length + 1, requestNo: `SR${String(serviceRequests.length + 1).padStart(6, '0')}`, userId: u.id, createdAt: iso(now()), serviceType: body.serviceType, description: body.description, contactName: body.contactName || u.name || 'Customer', contactPhone: body.contactPhone || u.phone, address: body.address, pincode: body.pincode, preferredAt: body.preferredAt, status: 'Pending', assignedPartnerId: null, adminNotes: null, history: [{ at: iso(now()), status: 'Pending', note: 'Request created', by: null }] }; serviceRequests.push(r); return srDto(r) })
on('GET', '/api/service-requests', ({ me }) => serviceRequests.filter((r) => r.userId === me().id).reverse().map(srDto))
on('POST', '/api/service-requests/:id/cancel', ({ me, p }) => { const r = serviceRequests.find((x) => x.id == p.id && x.userId === me().id); r.status = 'Cancelled'; r.history.push({ at: iso(now()), status: 'Cancelled', note: 'Cancelled by customer', by: null }); return srDto(r) })
const srDto = (r) => ({ ...r, assignedPartnerName: user(r.assignedPartnerId)?.name ?? null, assignedPartnerPhone: user(r.assignedPartnerId)?.phone ?? null })

// partner self
on('GET', '/api/partner/profile', ({ me }) => partnerDetail(partnerOf(me().id)))
on('PUT', '/api/partner/profile', ({ me, body }) => { const pr = partnerOf(me().id); const { name, email, preferredLanguage, ...rest } = body; Object.assign(me(), { name, email, preferredLanguage: preferredLanguage ?? 'en' }); Object.assign(pr, rest); return partnerDetail(pr) })
on('POST', '/api/partner/kyc/documents', ({ me }) => { const pr = partnerOf(me().id); const d = { id: Date.now(), documentType: 'Aadhaar', documentNumberMasked: 'XXXXXXXX1234', fileKey: 'private/kyc/x.png', uploadedAt: iso(now()) }; pr.documents = [...(pr.documents ?? []), d]; return d })
on('POST', '/api/partner/kyc/submit', ({ me }) => { const pr = partnerOf(me().id); if (!pr.documents?.length) fail(400, 'Upload your Aadhaar or PAN card to continue.'); pr.kycStatus = 'Pending'; pr.kycSubmittedAt = iso(now()); return partnerDetail(pr) })
on('GET', '/api/partner/rewards', ({ me }) => { const pr = partnerOf(me().id); const mine = rewardTxns.filter((r) => r.partnerUserId === me().id); return { balance: pr.rewardBalance, lifetimeEarned: r2(mine.filter((r) => r.type === 'Earned').reduce((s, r) => s + r.points, 0)), thisMonthEarned: r2(mine.filter((r) => r.type === 'Earned' && istDate(r.createdAt).slice(0, 7) === istDate(now()).slice(0, 7)).reduce((s, r) => s + r.points, 0)), pointValueRupees: settings.rewardPointValue, recent: mine.slice(-10).reverse() } })
on('GET', '/api/partner/rewards/history', ({ me, q }) => page(rewardTxns.filter((r) => r.partnerUserId === me().id).reverse(), { ...q, pageSize: 30 }))

// ---- admin
on('GET', '/api/admin/dashboard', () => {
  const today = istDate(now()); const month = today.slice(0, 7)
  const lm = new Date(); lm.setUTCMonth(lm.getUTCMonth() - 1); const lastMonth = istDate(lm).slice(0, 7)
  const sold = orders.filter((o) => SOLD.has(o.status) && o.paidAt)
  const sum = (xs) => r2(xs.reduce((s, o) => s + o.grandTotal, 0))
  const td = sold.filter((o) => istDate(o.paidAt) === today); const tm = sold.filter((o) => istDate(o.paidAt).slice(0, 7) === month)
  const days = [...Array(30)].map((_, i) => istDate(daysAgo(29 - i)))
  const recent = sold.filter((o) => istDate(o.paidAt) >= days[0])
  const agg = (key, label) => { const m = {}; recent.forEach((o) => o.items.forEach((i) => { const k = key(i, o); if (k == null) return; m[k] ??= { id: k, name: label(i, o), quantity: 0, amount: 0, orders: new Set() }; m[k].quantity += i.quantity; m[k].amount = r2(m[k].amount + i.lineTotal); m[k].orders.add(o.id) })); return Object.values(m).map((x) => ({ ...x, orders: x.orders.size })).sort((a, b) => b.amount - a.amount).slice(0, 8) }
  const tp = {}; recent.filter((o) => o.customerKind === 'Partner').forEach((o) => { tp[o.userId] ??= { id: o.userId, name: o.customerName, quantity: 0, amount: 0, orders: 0 }; tp[o.userId].amount = r2(tp[o.userId].amount + o.grandTotal); tp[o.userId].orders++ })
  return {
    kpis: { salesToday: sum(td), ordersToday: td.length, salesThisMonth: sum(tm), ordersThisMonth: tm.length, salesLastMonth: sum(sold.filter((o) => istDate(o.paidAt).slice(0, 7) === lastMonth)),
      awaitingDispatch: orders.filter(editable).length, awaitingPayment: orders.filter((o) => o.status === 'PendingPayment').length, pendingKyc: partners.filter((p) => p.kycStatus === 'Pending').length,
      lowStockCount: products.filter((p) => p.isActive && p.stockQty <= p.reorderLevel).length, activePartners: partners.filter((p) => p.kycStatus === 'Approved').length,
      openServiceRequests: serviceRequests.filter((r) => ['Pending', 'InProgress'].includes(r.status)).length, inventoryValue: r2(products.reduce((s, p) => s + Math.max(0, p.stockQty) * p.averageCost, 0)), averageOrderValue: tm.length ? r2(sum(tm) / tm.length) : 0 },
    trend: days.map((d) => { const os = recent.filter((o) => istDate(o.paidAt) === d); const by = (c) => r2(os.filter((o) => o.channel === c).reduce((s, o) => s + o.grandTotal, 0)); return { label: new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }), date: d, app: by('App'), web: by('Web'), store: by('Store'), orders: os.length } }),
    topProducts: agg((i) => i.productId, (i) => i.productName), byCategory: agg((i) => products[i.productId - 1].categoryId, (i) => catName(products[i.productId - 1].categoryId)),
    topPartners: Object.values(tp).sort((a, b) => b.amount - a.amount).slice(0, 8), byChannel: [],
  }
})
// orders
on('GET', '/api/admin/orders', ({ q }) => {
  let rows = [...orders].reverse()
  if (q.search) rows = rows.filter((o) => like(o.orderNo, q.search) || like(o.customerName, q.search) || like(o.customerPhone, q.search) || like(o.dispatch?.invoiceNo, q.search))
  for (const k of ['status', 'channel', 'customerKind', 'fulfilmentType']) if (q[k]) rows = rows.filter((o) => o[k] === q[k])
  if (q.userId) rows = rows.filter((o) => o.userId == q.userId)
  rows = rows.filter((o) => inRange(o.createdAt, q))
  return page(rows.map(orderList), q)
})
const findOrder = (id) => orders.find((o) => o.id == id) ?? fail(404, 'Order not found.')
on('GET', '/api/admin/orders/:id', ({ p }) => orderDetail(findOrder(p.id)))
on('POST', '/api/admin/orders/:id/schedule', ({ p, body, me }) => { const o = findOrder(p.id); o.fulfilmentType = body.fulfilmentType; o.scheduledAt = body.scheduledAt ?? null; if (o.status === 'Paid') o.status = 'Processing'; ev(o, 'Pickup / delivery scheduled', body.note ?? null, me().name); return orderDetail(o) })
on('POST', '/api/admin/orders/:id/status', ({ p, body, me }) => { const o = findOrder(p.id); o.status = body.status; ev(o, 'Status updated', body.status, me().name); return orderDetail(o) })
on('POST', '/api/admin/orders/:id/notes', ({ p, body, me }) => { const o = findOrder(p.id); o.internalNotes = [o.internalNotes, body.note].filter(Boolean).join('\n'); ev(o, 'Note', body.note, me().name); return orderDetail(o) })
on('PUT', '/api/admin/orders/:id/items', ({ p, body, me }) => {
  const o = findOrder(p.id); if (!editable(o)) fail(409, 'Only paid orders that haven\'t been dispatched can be edited.')
  const before = o.grandTotal
  for (const i of o.items) products[i.productId - 1].reservedQty -= i.quantity
  o.items = body.lines.map((l) => { const ex = o.items.find((i) => i.productId === l.productId); const pr = products[l.productId - 1]; return { ...(ex ?? { id: itemId++, productId: pr.id, productCode: pr.code, productName: pr.name, hsnCode: pr.hsnCode, listPrice: pr.listPrice, discountPercent: discFor(pr, o.customerKind), gstRate: pr.gstRate, addedAtStore: true }), quantity: l.quantity, specialDiscountPercent: l.specialDiscountPercent, rewardPoints: o.customerKind === 'Partner' ? r2(pr.rewardPointsPerUnit * l.quantity) : 0 } })
  for (const i of o.items) products[i.productId - 1].reservedQty += i.quantity
  if (body.shippingFee != null) o.shippingFee = body.shippingFee
  recalc(o); ev(o, 'Items updated', `Total ₹${before.toFixed(2)} → ₹${o.grandTotal.toFixed(2)}${body.note ? '; ' + body.note : ''}`, me().name)
  return orderDetail(o)
})
on('POST', '/api/admin/orders/:id/cancel', ({ p, body, me }) => { const o = findOrder(p.id); cancel(o, body.reason, me().name); if (body.refundOnline && o.amountPaid) { o.paymentStatus = 'Refunded'; ev(o, 'Refund initiated', `₹${o.amountPaid.toFixed(2)} refund initiated to original payment method`, me().name) } return orderDetail(o) })
on('POST', '/api/admin/orders/:id/dispatch', ({ p, body, me }) => { const o = findOrder(p.id); if (!editable(o)) fail(409, 'Only paid orders that haven\'t been dispatched can be dispatched.'); dispatch(o, body, me().name); return orderDetail(o) })
on('POST', '/api/admin/orders/:id/delivered', ({ p, me }) => { const o = findOrder(p.id); o.status = 'Completed'; ev(o, 'Delivered', null, me().name); return orderDetail(o) })
on('POST', '/api/admin/orders/counter-sale', ({ body, me }) => {
  const partner = body.partnerUserId ? user(body.partnerUserId) : null
  const o = makeOrder({ userId: partner?.id ?? null, kind: partner ? 'Partner' : 'WalkIn', channel: 'Store', at: now(), lines: body.lines.map((l) => [l.productId, l.quantity]), fulfilment: 'StorePickup', status: 'PendingPayment' })
  delete o._clock
  if (!partner) { o.customerName = body.customerName || 'Walk-in customer'; o.customerPhone = body.customerPhone || null; o.customerGstin = body.customerGstin || null }
  o.items.forEach((i) => { i.specialDiscountPercent = body.lines.find((l) => l.productId === i.productId)?.specialDiscountPercent ?? 0 }); recalc(o)
  pay(o, body.paymentMethod); dispatch(o, {}, me().name); return orderDetail(o)
})
function takeInvoiceNo(at = now()) {
  const fy = fyLabel(at); let n = invoiceCounters[fy] ?? 1; let no = fmtInvoice(fy, n)
  while (orders.some((x) => x.dispatch?.invoiceNo === no)) no = fmtInvoice(fy, ++n)
  invoiceCounters[fy] = n + 1; return no
}
const numbering = () => { const fy = fyLabel(); const n = invoiceCounters[fy] ?? 1; return { financialYear: fy, prefix: settings.invoicePrefix, digits: settings.invoiceNumberDigits, nextNumber: n, nextInvoiceNo: fmtInvoice(fy, n) } }
function invoice(o) {
  if (!o) fail(404, 'Order not found.'); if (!o.dispatch) fail(409, 'The invoice is generated when the order is dispatched.', 'no_invoice')
  const pos = o.fulfilmentType === 'StorePickup' || !o.shipState ? settings.state : o.shipState
  const inter = !!settings.state && pos.toLowerCase() !== settings.state.toLowerCase()
  let n = 0
  const line = (code, desc, hsn, qty, unit, disc, gst, total, tax) => { const taxable = r2(total - tax); const half = r2(tax / 2); return { no: ++n, code, description: desc, hsnCode: hsn, quantity: qty, unit: (unit || '').toUpperCase(), rate: qty ? r2(taxable / qty) : 0, discountPercent: disc, taxableValue: taxable, gstRate: gst, cgst: inter ? 0 : half, sgst: inter ? 0 : r2(tax - half), igst: inter ? tax : 0, total } }
  const lines = o.items.map((i) => line(i.productCode, i.productName, i.hsnCode, i.quantity, products[i.productId - 1]?.unit ?? 'pcs', i.discountPercent + i.specialDiscountPercent, i.gstRate, i.lineTotal, i.taxAmount))
  if (o.shippingFee > 0) lines.push(line(null, 'Delivery charges', '996511', 1, '', 0, DELIVERY_GST, o.shippingFee, r2((o.shippingFee * DELIVERY_GST) / (100 + DELIVERY_GST))))
  const sum = (xs, k) => r2(xs.reduce((s, l) => s + l[k], 0))
  const rates = [...new Set(lines.map((l) => l.gstRate))].sort((a, b) => a - b)
  const taxSummary = rates.map((g) => { const ls = lines.filter((l) => l.gstRate === g); return { gstRate: g, taxableValue: sum(ls, 'taxableValue'), cgst: sum(ls, 'cgst'), sgst: sum(ls, 'sgst'), igst: sum(ls, 'igst') } })
  const buyerAddress = [o.shipLine1, o.shipLine2, o.shipCity, o.shipPincode].filter(Boolean).join(', ') || null
  const cgstTotal = sum(lines, 'cgst'), sgstTotal = sum(lines, 'sgst'), igstTotal = sum(lines, 'igst')
  return {
    invoiceNo: o.dispatch.invoiceNo, invoiceDate: o.dispatch.dispatchedAt, dateOfSupply: o.dispatch.dispatchedAt, orderNo: o.orderNo,
    memoType: o.amountPaid >= o.grandTotal ? 'CASH MEMO' : 'DEBIT MEMO', storeName: settings.storeName, logoUrl: settings.invoiceLogoUrl || null,
    seller: { name: settings.legalName, address: [settings.addressLine, settings.city, settings.state, settings.pincode].filter(Boolean).join(', '), state: settings.state, stateCode: stateCode(settings.state, settings.gstin), gstin: settings.gstin || null, pan: settings.pan || null, phone: settings.supportPhone || null },
    buyer: { name: o.customerName, address: buyerAddress, state: o.shipState || null, stateCode: stateCode(o.shipState, o.customerGstin), gstin: o.customerGstin, pan: null, phone: o.customerPhone },
    bank: { bankName: settings.bankName || null, branch: settings.bankBranch || null, accountNo: settings.bankAccountNo || null, ifsc: settings.bankIfsc || null },
    placeOfSupply: pos, placeOfSupplyCode: stateCode(pos), interState: inter, lines, taxSummary,
    totalQuantity: r2(o.items.reduce((s, i) => s + i.quantity, 0)), taxableTotal: sum(lines, 'taxableValue'), cgstTotal, sgstTotal, igstTotal, totalTax: r2(cgstTotal + sgstTotal + igstTotal),
    roundOff: o.roundOff ?? 0, grandTotal: o.grandTotal, amountInWords: amountWords(o.grandTotal), amountPaid: o.amountPaid, balanceDue: Math.max(0, r2(o.grandTotal - o.amountPaid)),
    terms: String(settings.invoiceTerms ?? '').split('\n').map((t) => t.trim()).filter(Boolean), rewardPointsEarned: o.rewardPointsEarned,
  }
}
const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
const small = (n) => (n < 20 ? ones[n] : n < 100 ? `${tens[Math.floor(n / 10)]} ${ones[n % 10]}`.trim() : words(n))
function words(n) { const out = []; for (const [d, l] of [[1e7, 'Crore'], [1e5, 'Lakh'], [1e3, 'Thousand'], [100, 'Hundred']]) { if (n >= d) { out.push(`${small(Math.floor(n / d))} ${l}`); n %= d } } if (n) out.push(small(n)); return out.join(' ') || 'Zero' }
function amountWords(v) { const rupees = Math.floor(v + 1e-9); const paise = Math.round((v - rupees) * 100); return `${words(rupees)}${paise ? ` and ${small(paise)} Paise` : ''} Only` }
on('GET', '/api/admin/orders/:id/invoice', ({ p }) => invoice(findOrder(p.id)))

// catalogue admin
on('GET', '/api/admin/categories', ({ q }) => page(categories.filter((c) => like(c.name, q.search)).map((c) => ({ ...c, productCount: products.filter((p) => p.categoryId === c.id).length, subCategoryCount: subcategories.filter((s) => s.categoryId === c.id).length })), q))
const upsert = (arr, id, body) => { if (id) { const x = arr.find((y) => y.id == id); Object.assign(x, body); return x } const x = { id: Math.max(0, ...arr.map((y) => y.id)) + 1, ...body }; arr.push(x); return x }
on('POST', '/api/admin/categories', ({ body }) => upsert(categories, null, body))
on('PUT', '/api/admin/categories/:id', ({ p, body }) => upsert(categories, p.id, body))
on('GET', '/api/admin/subcategories', ({ q }) => page(subcategories.filter((s) => like(s.name, q.search) && (!q.categoryId || s.categoryId == q.categoryId)).map((s) => ({ ...s, categoryName: catName(s.categoryId), productCount: products.filter((p) => p.subCategoryId === s.id).length })), q))
on('POST', '/api/admin/subcategories', ({ body }) => upsert(subcategories, null, body))
on('PUT', '/api/admin/subcategories/:id', ({ p, body }) => upsert(subcategories, p.id, body))
on('GET', '/api/admin/brands', ({ q }) => page(brands.filter((b) => like(b.name, q.search)).map((b) => ({ ...b, productCount: products.filter((p) => p.brandId === b.id).length })), q))
on('POST', '/api/admin/brands', ({ body }) => upsert(brands, null, body))
on('PUT', '/api/admin/brands/:id', ({ p, body }) => upsert(brands, p.id, body))
on('POST', '/api/admin/brands/:id/active', ({ p, q }) => { brands.find((b) => b.id == p.id).isActive = q.value === 'true'; return null })
on('GET', '/api/admin/products', ({ q }) => {
  let rows = products.filter((p) => !q.search || like(p.name, q.search) || like(p.code, q.search) || p.aliases.some((a) => like(a, q.search)))
  if (q.categoryId) rows = rows.filter((p) => p.categoryId == q.categoryId); if (q.brandId) rows = rows.filter((p) => p.brandId == q.brandId)
  if (q.groupId) rows = rows.filter((p) => p.groupIds.includes(Number(q.groupId))); if (q.isActive) rows = rows.filter((p) => String(p.isActive) === q.isActive)
  if (q.lowStockOnly === 'true') rows = rows.filter((p) => p.stockQty <= p.reorderLevel)
  return page(rows.map(adminProduct).filter(movementFilter(q)), q)
})
on('GET', '/api/admin/products/lookup', ({ q }) => products.filter((p) => p.isActive && (like(p.name, q.q) || like(p.code, q.q) || p.aliases.some((a) => like(a, q.q)))).slice(0, Number(q.take ?? 15)).map(lookup))
on('GET', '/api/admin/products/scan/:code', ({ p }) => { const c = decodeURIComponent(p.code).trim(); return lookup(products.find((x) => x.code === c.toUpperCase() || (x.barcode && x.barcode === c)) ?? fail(404, `Product for code ${c} not found.`)) })
on('GET', '/api/admin/products/:id', ({ p }) => adminProduct(products.find((x) => x.id == p.id) ?? fail(404, 'Product not found.')))
on('POST', '/api/admin/products', ({ body }) => { const x = upsert(products, null, { ...body, code: `BM${String(products.length + 1).padStart(6, '0')}`, stockQty: 0, reservedQty: 0, averageCost: 0, locations: [], createdAt: iso(now()), updatedAt: iso(now()) }); return adminProduct(x) })
on('PUT', '/api/admin/products/:id', ({ p, body }) => adminProduct(upsert(products, p.id, { ...body, updatedAt: iso(now()) })))
on('POST', '/api/admin/products/:id/active', ({ p, q }) => { products.find((x) => x.id == p.id).isActive = q.value === 'true'; return null })
on('GET', '/api/admin/product-groups', () => groups.map((g) => ({ ...g, productCount: g.productIds.length })))
on('POST', '/api/admin/product-groups', ({ body }) => upsert(groups, null, body))
on('PUT', '/api/admin/product-groups/:id', ({ p, body }) => upsert(groups, p.id, body))
// Image uploads are kept in memory (lost on restart, like all mock data) and served from /files/uploads/…
const uploads = new Map()
const IMAGE_SIGS = [['image/png', [0x89, 0x50, 0x4e, 0x47]], ['image/jpeg', [0xff, 0xd8, 0xff]], ['image/webp', [0x52, 0x49, 0x46, 0x46]], ['image/gif', [0x47, 0x49, 0x46]]]
on('POST', '/api/admin/uploads/image', ({ files, q }) => {
  const f = files?.file ?? fail(400, 'Choose an image to upload.')
  if (f.data.length > 8 * 1024 * 1024) fail(400, 'Images must be 8 MB or smaller.')
  const type = IMAGE_SIGS.find(([, sig]) => sig.every((b, i) => f.data[i] === b))?.[0] ?? fail(400, 'Upload an image (JPG, PNG or WEBP).')
  const folder = String(q.folder ?? 'images').replace(/[^a-z0-9-]/gi, '') || 'images'
  const name = `${folder}-${randomUUID().slice(0, 8)}.${type.split('/')[1].replace('jpeg', 'jpg')}`
  uploads.set(name, { type, data: f.data })
  return { key: `public/${folder}/${name}`, url: `/files/uploads/${name}` }
})

// inventory admin
const stockRow = (p) => ({ productId: p.id, code: p.code, name: p.name, category: catName(p.categoryId), brand: brName(p.brandId), unit: p.unit, stockQty: p.stockQty, reservedQty: p.reservedQty, availableQty: avail(p), reorderLevel: p.reorderLevel, averageCost: p.averageCost, value: r2(Math.max(0, p.stockQty) * p.averageCost), listPrice: p.listPrice, racks: racksFor(p), ...movementOf(p) })
const stockBase = (q) => products.filter((p) => p.isActive && (q.lowOnly !== 'true' || p.stockQty <= p.reorderLevel) && (!q.categoryId || p.categoryId == q.categoryId) && (!q.brandId || p.brandId == q.brandId)
  && (!q.search || like(p.name, q.search) || like(p.code, q.search) || p.barcode === q.search.trim() || p.aliases.some((a) => like(a, q.search))))
const movementFilter = (q) => (r) => (!q.movement || r.movement === q.movement) && (q.neverDispatched == null || q.neverDispatched === '' || String(r.neverDispatched) === q.neverDispatched)
on('GET', '/api/admin/stock', ({ q }) => stockBase(q).map(stockRow).filter(movementFilter(q)).sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name)))
on('GET', '/api/admin/stock/movement-summary', ({ q }) => {
  const rows = stockBase(q).map((p) => ({ p, m: movementOf(p) }))
  const bucket = (c) => { const b = rows.filter((x) => x.m.movement === c); return { products: b.length, neverDispatched: b.filter((x) => x.m.neverDispatched).length, stockQty: r2(b.reduce((s, x) => s + x.p.stockQty, 0)), stockValue: r2(b.reduce((s, x) => s + Math.max(0, x.p.stockQty) * x.p.averageCost, 0)) } }
  return { asOf: istDate(now()), fastMaxDays: FAST_MAX_DAYS, slowMaxDays: SLOW_MAX_DAYS, fast: bucket('Fast'), slow: bucket('Slow'), nonMoving: bucket('NonMoving') }
})
on('GET', '/api/admin/stock/:productId/movement', ({ p: { productId } }) => {
  const p = products.find((x) => x.id == productId) ?? fail(404, 'Product not found.')
  const dispatches = orders.filter((o) => o.dispatch && o.items.some((i) => i.productId === p.id)).map((o) => ({
    dispatchedAt: o.dispatch.dispatchedAt, invoiceNo: o.dispatch.invoiceNo, dispatchNo: o.dispatch.dispatchNo, orderId: o.id, orderNo: o.orderNo, customer: o.customerName, channel: o.channel,
    quantity: r2(o.items.filter((i) => i.productId === p.id).reduce((s, i) => s + i.quantity, 0)),
  })).sort((a, b) => b.dispatchedAt.localeCompare(a.dispatchedAt))
  const within = (n) => r2(dispatches.filter((d) => Math.max(0, istDayNo(now()) - istDayNo(d.dispatchedAt)) <= n).reduce((s, d) => s + d.quantity, 0))
  return { productId: p.id, code: p.code, name: p.name, unit: p.unit, stockQty: p.stockQty, ...movementOf(p), firstReceiptAt: p.agingFromAt ?? null, createdAt: p.createdAt,
    dispatchCount: dispatches.length, qtyLast30Days: within(FAST_MAX_DAYS), qtyLast120Days: within(SLOW_MAX_DAYS), dispatches: dispatches.slice(0, 200) }
})
on('GET', '/api/admin/stock/movements', ({ q }) => page([...stockMoves].reverse().filter((m) => (!q.productId || m.productId == q.productId) && (!q.type || m.type === q.type) && inRange(m.createdAt, q)).map((m) => ({ ...m, productCode: products[m.productId - 1].code, productName: products[m.productId - 1].name })), q))
on('GET', '/api/admin/stock/statement', ({ q }) => products.filter((p) => !q.productId || p.id == q.productId).map((p) => {
  const ms = stockMoves.filter((m) => m.productId === p.id); const opening = r2(ms.filter((m) => q.from && istDate(m.createdAt) < q.from).reduce((s, m) => s + m.quantity, 0))
  const inP = ms.filter((m) => inRange(m.createdAt, q)); const i = r2(inP.filter((m) => m.quantity > 0).reduce((s, m) => s + m.quantity, 0)); const o = r2(-inP.filter((m) => m.quantity < 0).reduce((s, m) => s + m.quantity, 0))
  return { productId: p.id, code: p.code, name: p.name, opening, in: i, out: o, closing: r2(opening + i - o) }
}))
on('POST', '/api/admin/stock/adjust', ({ body }) => { const p = products[body.productId - 1]; const s = body.isIncrease ? body.quantity : -body.quantity; p.stockQty = r2(p.stockQty + s); const m = { id: mvId++, createdAt: iso(now()), productId: p.id, type: body.isIncrease ? 'AdjustmentIn' : 'AdjustmentOut', quantity: s, balanceAfter: p.stockQty, unitCost: p.averageCost, referenceType: 'Adjustment', referenceNo: null, note: body.reason }; stockMoves.push(m); return { ...m, productCode: p.code, productName: p.name } })
on('GET', '/api/admin/racks', () => racks.map((r) => { const locs = rackLocations.filter((l) => l.rackId === r.id); return { ...r, locationCount: locs.length, occupiedCount: locs.filter((l) => products.some((p) => p.locations.some((x) => x.rackLocationId === l.id && x.quantity > 0))).length } }))
on('GET', '/api/admin/racks/locations', () => rackLocations.map((l) => ({ id: l.id, label: l.label })))
const locDto = (l) => ({ ...l, products: products.flatMap((p) => p.locations.filter((x) => x.rackLocationId === l.id && x.quantity > 0).map((x) => ({ productId: p.id, code: p.code, name: p.name, quantity: Math.min(x.quantity, p.stockQty) }))) })
on('GET', '/api/admin/racks/find', ({ q }) => rackLocations.map(locDto).map((l) => ({ ...l, products: l.products.filter((p) => like(p.name, q.q) || like(p.code, q.q)) })).filter((l) => l.products.length))
on('GET', '/api/admin/racks/:id/locations', ({ p }) => rackLocations.filter((l) => l.rackId == p.id).map(locDto))
on('POST', '/api/admin/racks', ({ body }) => { const r = upsert(racks, null, body); for (let a = 1; a <= r.rows; a++) for (let c = 1; c <= r.columns; c++) rackLocations.push({ id: rlid++, rackId: r.id, label: `${r.code}-${String.fromCharCode(64 + a)}${c}`, rowNo: a, columnNo: c }); return r })
on('GET', '/api/admin/purchases', ({ q }) => page([...purchases].reverse().filter((p) => (like(p.purchaseNo, q.search) || like(p.supplierName, q.search) || like(p.supplierInvoiceNo, q.search)) && (!q.from || p.purchaseDate >= q.from) && (!q.to || p.purchaseDate <= q.to)).map((p) => ({ ...p, itemCount: p.items.length, totalQuantity: p.items.reduce((s, i) => s + i.quantity, 0) })), q))
on('GET', '/api/admin/purchases/:id', ({ p }) => purchases.find((x) => x.id == p.id))
on('POST', '/api/admin/purchases', ({ body }) => {
  const pu = { id: purchases.length + 1, purchaseNo: `PU2627${String(purchases.length + 1).padStart(5, '0')}`, ...body, createdAt: iso(now()), items: body.items.map((i) => { const p = products[i.productId - 1]; p.stockQty += i.quantity; const net = r2(i.listPrice * (1 - i.purchaseDiscountPercent / 100)); stockMoves.push({ id: mvId++, createdAt: iso(now()), productId: p.id, type: 'PurchaseIn', quantity: i.quantity, balanceAfter: p.stockQty, unitCost: net, referenceType: 'Purchase', referenceNo: `PU2627${String(purchases.length + 1).padStart(5, '0')}`, note: body.supplierName }); return { productId: p.id, productCode: p.code, productName: p.name, quantity: i.quantity, listPrice: i.listPrice, purchaseDiscountPercent: i.purchaseDiscountPercent, netRate: net, lineTotal: r2(net * i.quantity), rackLabel: rackLocations.find((l) => l.id === i.rackLocationId)?.label ?? null } }) }
  pu.totalAmount = r2(pu.items.reduce((s, i) => s + i.lineTotal, 0)); purchases.push(pu); return pu
})

// partners admin
on('GET', '/api/admin/partners', ({ q }) => {
  let rows = partners.map(partnerList)
  if (q.search) rows = rows.filter((p) => like(p.name, q.search) || like(p.phone, q.search) || like(p.businessName, q.search))
  for (const k of ['kycStatus', 'partnerType', 'pincode']) if (q[k]) rows = rows.filter((p) => p[k] === q[k])
  if (q.city) rows = rows.filter((p) => like(p.city, q.city) || like(p.area, q.city))
  if (q.managerId) rows = rows.filter((p) => partnerOf(p.userId).managerId == q.managerId)
  if (q.sort === 'purchase') rows.sort((a, b) => b.totalPurchase - a.totalPurchase); else if (q.sort === 'rewards') rows.sort((a, b) => b.rewardBalance - a.rewardBalance); else rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return page(rows, q)
})
on('GET', '/api/admin/partners/:id', ({ p }) => partnerDetail(partnerOf(Number(p.id)) ?? fail(404, 'Partner not found.')))
on('POST', '/api/admin/partners/:id/kyc', ({ p, body, me }) => { const pr = partnerOf(Number(p.id)); Object.assign(pr, { kycStatus: body.approve ? 'Approved' : 'Rejected', kycRemarks: body.remarks ?? null, kycReviewedById: me().id, kycReviewedAt: iso(now()), locationVerified: body.locationVerified }); notify(pr.userId, body.approve ? 'Your account is approved 🎉' : 'KYC needs attention', body.approve ? 'You can now order with partner pricing and earn reward points.' : `Reason: ${body.remarks}`, 'kyc'); return partnerDetail(pr) })
on('PUT', '/api/admin/partners/:id', ({ p, body }) => { const pr = partnerOf(Number(p.id)); const u = user(pr.userId); const { name, email, preferredLanguage, ...rest } = body.profile; Object.assign(u, { name, email, isActive: body.isActive }); Object.assign(pr, rest, { managerId: body.managerId ?? null }); return partnerDetail(pr) })
on('POST', '/api/admin/partners', ({ body, me }) => { const id = 1000 + users.length; users.push({ id, userType: 'Partner', name: body.profile.name, phone: body.phone, email: body.profile.email ?? null, isActive: true, createdAt: iso(now()) }); const { name, email, preferredLanguage, ...rest } = body.profile; const pr = { userId: id, ...rest, kycStatus: body.approveNow ? 'Approved' : 'Pending', kycReviewedById: body.approveNow ? me().id : null, kycReviewedAt: body.approveNow ? iso(now()) : null, managerId: body.managerId ?? null, createdByAdmin: true, rewardBalance: 0, documents: [], locationVerified: false }; partners.push(pr); return partnerDetail(pr) })
on('GET', '/api/admin/partners/:id/rewards', ({ p, q }) => page(rewardTxns.filter((r) => r.partnerUserId == p.id).reverse(), q))
on('POST', '/api/admin/partners/:id/rewards', ({ p, body }) => { const pr = partnerOf(Number(p.id)); pr.rewardBalance = r2(pr.rewardBalance + body.points); const t = { id: rtId++, partnerUserId: pr.userId, createdAt: iso(now()), type: body.points < 0 && /redeem/i.test(body.note) ? 'Redeemed' : 'Adjusted', points: body.points, balanceAfter: pr.rewardBalance, orderId: null, orderNo: null, note: body.note }; rewardTxns.push(t); return t })
on('GET', '/api/admin/partners/:id/kyc/documents/:doc', () => ({ __file: join(ART, 'switch.svg') }))
on('GET', '/api/admin/service-requests', ({ q }) => page([...serviceRequests].reverse().filter((r) => (like(r.requestNo, q.search) || like(r.contactName, q.search) || like(r.contactPhone, q.search) || like(r.description, q.search)) && (!q.serviceType || r.serviceType === q.serviceType) && (!q.status || r.status === q.status) && inRange(r.createdAt, q)).map(srDto), q))
on('PUT', '/api/admin/service-requests/:id', ({ p, body, me }) => { const r = serviceRequests.find((x) => x.id == p.id); Object.assign(r, { status: body.status, assignedPartnerId: body.assignedPartnerId ?? null, adminNotes: body.note ?? r.adminNotes }); r.history.push({ at: iso(now()), status: body.status, note: body.note ?? null, by: me().name }); notify(r.userId, `Service request ${r.requestNo}`, 'Status updated.', `service:${r.id}`); return srDto(r) })

// content, team, settings, integrations
on('GET', '/api/admin/content/banners', () => banners)
on('POST', '/api/admin/content/banners', ({ body }) => upsert(banners, null, body))
on('PUT', '/api/admin/content/banners/:id', ({ p, body }) => upsert(banners, p.id, body))
on('DELETE', '/api/admin/content/banners/:id', ({ p }) => { banners.splice(banners.findIndex((b) => b.id == p.id), 1); return null })
const sectionDto = (s) => ({ ...s, referenceName: s.type === 'ProductGroup' ? groups.find((g) => g.id === s.referenceId)?.name : s.type === 'Category' ? catName(s.referenceId) : s.type === 'Brand' ? brName(s.referenceId) : null })
on('GET', '/api/admin/content/sections', () => sections.map(sectionDto))
on('POST', '/api/admin/content/sections', ({ body }) => sectionDto(upsert(sections, null, body)))
on('PUT', '/api/admin/content/sections/:id', ({ p, body }) => sectionDto(upsert(sections, p.id, body)))
on('DELETE', '/api/admin/content/sections/:id', ({ p }) => { sections.splice(sections.findIndex((b) => b.id == p.id), 1); return null })
const staffDto = (u) => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, roleId: u.roleId, roleName: roles.find((r) => r.id === u.roleId)?.name, isActive: u.isActive, lastLoginAt: u.lastLoginAt, partnerCount: partners.filter((p) => p.managerId === u.id).length })
on('GET', '/api/admin/team/managers', () => users.filter((u) => u.userType === 'Staff' && u.isActive).map((u) => ({ id: u.id, name: u.name })))
on('GET', '/api/admin/team/users', () => users.filter((u) => u.userType === 'Staff').map(staffDto))
on('POST', '/api/admin/team/users', ({ body }) => { const u = { id: 1000 + users.length, userType: 'Staff', ...body, password: undefined }; users.push(u); return staffDto(u) })
on('PUT', '/api/admin/team/users/:id', ({ p, body }) => { const u = user(Number(p.id)); Object.assign(u, { ...body, password: undefined }); return staffDto(u) })
on('GET', '/api/admin/team/roles', () => roles.map((r) => ({ ...r, userCount: users.filter((u) => u.roleId === r.id).length })))
on('GET', '/api/admin/team/permissions', () => permissionCatalogue)
on('POST', '/api/admin/team/roles', ({ body }) => upsert(roles, null, { ...body, isSystem: false }))
on('PUT', '/api/admin/team/roles/:id', ({ p, body }) => upsert(roles, p.id, body))
on('GET', '/api/admin/settings/invoice-numbering', () => numbering())
on('PUT', '/api/admin/settings/invoice-numbering', ({ body }) => { const n = Number(body?.nextNumber); if (!(n >= 1 && n <= 99999999)) fail(400, 'The next invoice number must be between 1 and 99999999.'); invoiceCounters[fyLabel()] = Math.floor(n); return numbering() })
on('GET', '/api/admin/settings', () => settings)
on('PUT', '/api/admin/settings', ({ body }) => Object.assign(settings, body))
on('GET', '/api/admin/integrations/erp', ({ q }) => { const items = [...outbox].reverse().filter((m) => !q.status || m.status === q.status); return { connector: 'None', counts: ['Pending', 'Processed', 'Failed', 'Skipped'].map((s) => ({ status: s, count: outbox.filter((m) => m.status === s).length })), items, total: items.length } })

// reports
const soldIn = (q) => orders.filter((o) => SOLD.has(o.status) && o.paidAt && inRange(o.paidAt, q))
on('GET', '/api/admin/reports/sales', ({ q }) => {
  const key = (d) => { const s = istDate(d); if (q.groupBy === 'Month') return new Date(s).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }); if (q.groupBy === 'Week') { const x = new Date(s); x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7)); return `${x.toISOString().slice(0, 10)} (week)` } if (q.groupBy === 'Quarter') { const m = +s.slice(5, 7); return `Q${m >= 4 && m <= 6 ? 1 : m <= 9 && m >= 7 ? 2 : m >= 10 ? 3 : 4} FY 26-27` } if (q.groupBy === 'Year') return 'FY 26-27'; return s }
  const m = new Map()
  soldIn(q).filter((o) => (!q.kind || o.customerKind === q.kind) && (!q.channel || o.channel === q.channel)).sort((a, b) => a.paidAt.localeCompare(b.paidAt)).forEach((o) => { const k = key(o.paidAt); const r = m.get(k) ?? { period: k, orders: 0, gross: 0, discount: 0, tax: 0, net: 0, partnerSales: 0, retailSales: 0 }; r.orders++; r.gross = r2(r.gross + o.subTotal); r.discount = r2(r.discount + o.discountTotal); r.tax = r2(r.tax + o.taxTotal); r.net = r2(r.net + o.grandTotal); if (o.customerKind === 'Partner') r.partnerSales = r2(r.partnerSales + o.grandTotal); else r.retailSales = r2(r.retailSales + o.grandTotal); m.set(k, r) })
  return [...m.values()]
})
on('GET', '/api/admin/reports/products', ({ q }) => { const m = {}; soldIn(q).forEach((o) => o.items.forEach((i) => { const p = products[i.productId - 1]; if ((q.categoryId && p.categoryId != q.categoryId) || (q.brandId && p.brandId != q.brandId)) return; m[p.id] ??= { productId: p.id, code: p.code, name: p.name, category: catName(p.categoryId), brand: brName(p.brandId), quantitySold: 0, revenue: 0, tax: 0, orders: new Set(), stockQty: p.stockQty, cost: p.averageCost }; const r = m[p.id]; r.quantitySold += i.quantity; r.revenue = r2(r.revenue + i.lineTotal); r.tax += i.taxAmount; r.orders.add(o.id) })); return Object.values(m).map((r) => ({ ...r, orders: r.orders.size, averagePrice: r2(r.revenue / r.quantitySold), margin: r2(r.revenue - r.tax - r.quantitySold * r.cost) })).sort((a, b) => b.revenue - a.revenue) })
on('GET', '/api/admin/reports/partners', ({ q }) => partners.filter((p) => p.kycStatus === 'Approved' && (!q.managerId || p.managerId == q.managerId)).map((p) => { const os = soldIn(q).filter((o) => o.userId === p.userId); const rev = r2(os.reduce((s, o) => s + o.grandTotal, 0)); return { userId: p.userId, name: user(p.userId).name, phone: user(p.userId).phone, city: p.city, manager: user(p.managerId)?.name, orders: os.length, revenue: rev, averageOrderValue: os.length ? r2(rev / os.length) : 0, pointsEarned: r2(os.reduce((s, o) => s + o.rewardPointsEarned, 0)), lastOrderAt: os.at(-1)?.paidAt ?? null } }).sort((a, b) => b.revenue - a.revenue))
on('GET', '/api/admin/reports/category-brand', ({ q }) => { const agg = (f, n) => { const m = {}; soldIn(q).forEach((o) => o.items.forEach((i) => { const k = f(products[i.productId - 1]); m[k] ??= { id: k, name: n(k), quantity: 0, amount: 0, orders: new Set() }; m[k].quantity += i.quantity; m[k].amount = r2(m[k].amount + i.lineTotal); m[k].orders.add(o.id) })); return Object.values(m).map((x) => ({ ...x, orders: x.orders.size })).sort((a, b) => b.amount - a.amount) }; return { categories: agg((p) => p.categoryId, catName), brands: agg((p) => p.brandId, brName) } })
on('GET', '/api/admin/reports/purchases', ({ q }) => { const m = {}; purchases.filter((p) => (!q.from || p.purchaseDate >= q.from) && (!q.to || p.purchaseDate <= q.to)).forEach((pu) => pu.items.forEach((i) => { const k = q.groupBy === 'product' ? `${i.productCode} · ${i.productName}` : q.groupBy === 'month' ? pu.purchaseDate.slice(0, 7) : pu.supplierName; m[k] ??= { group: k, purchases: new Set(), quantity: 0, amount: 0 }; m[k].purchases.add(pu.id); m[k].quantity += i.quantity; m[k].amount = r2(m[k].amount + i.lineTotal) })); return Object.values(m).map((x) => ({ ...x, purchases: x.purchases.size })) })
on('GET', '/api/admin/reports/dispatches', ({ q }) => orders.filter((o) => o.dispatch && inRange(o.dispatch.dispatchedAt, q)).reverse().map((o) => ({ invoiceNo: o.dispatch.invoiceNo, dispatchNo: o.dispatch.dispatchNo, dispatchedAt: o.dispatch.dispatchedAt, orderNo: o.orderNo, customer: o.customerName, kind: o.customerKind, fulfilment: o.fulfilmentType, amount: o.grandTotal, dispatchedBy: o.dispatch.dispatchedBy })))

// QR code: the product code as a scannable PNG, like the real API.
on('GET', '/api/admin/products/:id/qr.png', ({ p, q }) => { const x = products.find((y) => y.id == p.id) ?? fail(404, 'Product not found.'); return { __png: qrPng(x.code, Number(q.size ?? 10)), name: `${x.code}.png` } })
// ------------------------------------------------------------------ Excel: templates, import, export
// Same columns and rules as the real API (api/src/BuildMate.Services/Excel/ExcelService.cs). Registered ahead
// of the other routes so "/products/template" isn't taken for a product id.
const onFirst = (method, pattern, fn) => { on(method, pattern, fn); routes.unshift(routes.pop()) }
const xlsxFile = (name, sheet, rows) => ({ __xlsx: writeXlsx(sheet, rows), name: `${name}-${istDate(now())}.xlsx` })
const PRODUCT_COLUMNS = ['Code', 'Name', 'Category', 'SubCategory', 'Brand', 'Unit', 'HSN', 'GST %', 'MRP', 'List Price',
  'Partner Discount %', 'Retail Discount %', 'Reward Points / Unit', 'Reorder Level', 'Sequence',
  'Barcode', 'Aliases (comma separated)', 'Name (Hindi)', 'Name (Gujarati)', 'Active', 'Show On Web', 'Show On App', 'Description',
  'Image URL', 'Variant Family', 'Variant Label', 'Specs', 'Purchase Discount %']
const TEMPLATES = {
  products: [PRODUCT_COLUMNS, ['C1115CKG', 'King CPVC Coupler SDR 11 – 15 mm (½")', 'Pipes & Fittings', 'CPVC Fittings', 'King', 'pcs', '39174000', 18, 7.42, 7.42,
    0, 0, 0, 500, 1, '', 'socket, coupling', '', '', 'Yes', 'Yes', 'Yes', 'King CPVC coupler, class SDR 11, size 15 mm (½").',
    'https://example.com/coupler.png', 'King CPVC Coupler SDR 11', '15 mm (½")', 'Material: CPVC; SDR: SDR 11; Size: 15 mm (½")', 5]],
  subcategories: [['Category', 'SubCategory', 'Sort Order', 'Active'], ['Plumbing', 'CPVC Pipes', 1, 'Yes']],
  purchases: [['Product Code', 'Quantity', 'List Price', 'Purchase Discount %', 'Rack Location'], ['C1115CKG', 100, 7.42, 30, 'R1-A1']],
}
for (const [kind, rows] of Object.entries(TEMPLATES)) onFirst('GET', `/api/admin/${kind}/template`, () => xlsxFile(`${kind.replace(/ies$/, 'y').replace(/s$/, '')}-template`, kind, rows))

/** Reads the uploaded workbook into a column lookup, like the API's Sheet class. */
function openSheet(files) {
  const f = files?.file ?? Object.values(files ?? {})[0]
  if (!f) fail(400, 'Choose an .xlsx file to upload.')
  let rows
  try { rows = readXlsx(f.data) } catch { fail(400, "Couldn't read this file. Upload an .xlsx file saved from Excel or Google Sheets.") }
  const norm = (h) => String(h).toLowerCase().replace(/[^\p{L}\p{N}]/gu, '')
  const cols = new Map()
  ;(rows[0] ?? []).forEach((h, i) => { if (h && !cols.has(norm(h))) cols.set(norm(h), i) })
  const sheet = {
    lastRow: rows.length, // rows are 1-based like Excel; row 1 is the header
    has: (h) => cols.has(norm(h)),
    str: (r, h) => { const i = cols.get(norm(h)); const v = i == null ? '' : String(rows[r - 1]?.[i] ?? '').trim(); return v === '' ? null : v },
    dec: (r, h, errors) => { const s = sheet.str(r, h); if (s == null) return null; const n = Number(s.replace(/[,₹%]/g, '')); if (Number.isFinite(n)) return n; errors.push({ row: r, message: `"${h}" should be a number (got "${s}").` }); return null },
    bool: (r, h) => { const s = sheet.str(r, h)?.toLowerCase(); return s == null ? null : ['yes', 'y', 'true', '1', 'active'].includes(s) },
    blank: (r) => !(rows[r - 1] ?? []).some((v) => String(v ?? '').trim() !== ''),
  }
  return sheet
}
const rowErrors = (errors) => { const e = new HttpError(400, `${errors.length} row(s) have problems. Nothing was saved — fix them and upload again.`, 'import_validation'); e.errors = errors.sort((a, b) => a.row - b.row); throw e }
const CODE_RE = /^[A-Z0-9][A-Z0-9\-/.]{0,19}$/
const GST_SLABS = [0, 0.25, 3, 5, 12, 18, 28]

onFirst('POST', '/api/admin/products/import', ({ files, q }) => {
  const sheet = openSheet(files)
  for (const h of ['Name', 'Category', 'Brand', 'List Price']) if (!sheet.has(h)) fail(400, `Missing column "${h}". Download the product template.`)
  const createMasters = q.createMissingMasters === 'true'
  const errors = [], pending = [], seen = new Set()
  // masters created during this import are only kept if the whole file is valid
  const newCats = [], newBrands = [], newSubs = []
  const findCat = (n) => categories.find((c) => c.name.toLowerCase() === n.toLowerCase()) ?? newCats.find((c) => c.name.toLowerCase() === n.toLowerCase())
  const findBrand = (n) => brands.find((b) => b.name.toLowerCase() === n.toLowerCase()) ?? newBrands.find((b) => b.name.toLowerCase() === n.toLowerCase())
  const findSub = (cat, n) => [...subcategories, ...newSubs].find((s) => s.categoryId === cat.id && s.name.toLowerCase() === n.toLowerCase())
  let nextCat = Math.max(0, ...categories.map((c) => c.id)) + 1, nextBrand = Math.max(0, ...brands.map((b) => b.id)) + 1, nextSub = Math.max(0, ...subcategories.map((s) => s.id)) + 1
  for (let r = 2; r <= sheet.lastRow; r++) {
    if (sheet.blank(r)) continue
    const before = errors.length, err = (message) => errors.push({ row: r, message })
    const code = sheet.str(r, 'Code')?.toUpperCase() ?? null
    const name = sheet.str(r, 'Name'), cat = sheet.str(r, 'Category'), brand = sheet.str(r, 'Brand')
    const listPrice = sheet.dec(r, 'List Price', errors)
    if (!name) err('Name is required.'); if (!cat) err('Category is required.'); if (!brand) err('Brand is required.')
    const active = sheet.bool(r, 'Active') ?? true
    if (active && !(listPrice > 0)) err('List Price must be more than zero (or set Active to No).')
    if (listPrice < 0) err("List Price can't be negative.")
    if (code && !CODE_RE.test(code)) err(`Code ${code} can only use letters, numbers, - / . and be up to 20 characters.`)
    if (code && seen.has(code)) err(`Code ${code} appears twice.`); if (code) seen.add(code)
    const gst = sheet.dec(r, 'GST %', errors) ?? 18
    if (!GST_SLABS.includes(gst)) err(`GST ${gst}% is not a valid slab.`)
    const mrp = sheet.dec(r, 'MRP', errors) ?? 0
    if (mrp > 0 && listPrice > mrp) err('List Price is higher than MRP.')
    const pd = sheet.dec(r, 'Partner Discount %', errors) ?? 0, rd = sheet.dec(r, 'Retail Discount %', errors) ?? 0
    if (pd < 0 || pd > 90 || rd < 0 || rd > 90) err('Discounts must be between 0 and 90%.')
    if (errors.length > before) continue

    let c = findCat(cat)
    if (!c) { if (!createMasters) { err(`Unknown category "${cat}".`); continue } c = { id: nextCat++, name: cat, description: '', imageUrl: null, sortOrder: categories.length + newCats.length + 1, isActive: true }; newCats.push(c) }
    let b = findBrand(brand)
    if (!b) { if (!createMasters) { err(`Unknown brand "${brand}".`); continue } b = { id: nextBrand++, name: brand, logoUrl: null, sortOrder: brands.length + newBrands.length, isActive: true }; newBrands.push(b) }
    let sub = null
    const subN = sheet.str(r, 'SubCategory')
    if (subN) {
      sub = findSub(c, subN)
      if (!sub) { if (!createMasters) { err(`Unknown sub category "${subN}" in ${cat}.`); continue } sub = { id: nextSub++, categoryId: c.id, name: subN, sortOrder: 0, isActive: true }; newSubs.push(sub) }
    }
    const purchaseDisc = sheet.dec(r, 'Purchase Discount %', errors)
    if (purchaseDisc != null && (purchaseDisc < 0 || purchaseDisc >= 100)) err('Purchase Discount % must be between 0 and 99.')
    const fields = {
      name, categoryId: c.id, subCategoryId: sub?.id ?? null, brandId: b.id, unit: sheet.str(r, 'Unit') ?? 'pcs', hsnCode: sheet.str(r, 'HSN'), gstRate: gst, mrp,
      listPrice: listPrice ?? 0, partnerDiscountPercent: pd, retailDiscountPercent: rd, rewardPointsPerUnit: sheet.dec(r, 'Reward Points / Unit', errors) ?? 0,
      reorderLevel: sheet.dec(r, 'Reorder Level', errors) ?? 0, sequence: Math.trunc(sheet.dec(r, 'Sequence', errors) ?? 0), barcode: sheet.str(r, 'Barcode'),
      isActive: active, showOnWeb: sheet.bool(r, 'Show On Web') ?? true, showOnApp: sheet.bool(r, 'Show On App') ?? true,
      aliases: (sheet.str(r, 'Aliases (comma separated)') ?? '').split(',').map((x) => x.trim()).filter(Boolean),
    }
    const desc = sheet.str(r, 'Description'); if (desc) fields.description = desc
    if (sheet.has('Image URL')) fields.imageUrls = [...new Set((sheet.str(r, 'Image URL') ?? '').split(/[,\s]+/).filter((u) => /^(https?:\/\/|\/)/.test(u)))]
    if (sheet.has('Variant Family')) fields.variantFamily = sheet.str(r, 'Variant Family')
    if (sheet.has('Variant Label')) fields.variantLabel = sheet.str(r, 'Variant Label')
    if (sheet.has('Specs')) fields.specs = (sheet.str(r, 'Specs') ?? '').split(';').map((x) => x.trim()).filter((x) => x.includes(':'))
    const tr = {}; const hi = sheet.str(r, 'Name (Hindi)'), gu = sheet.str(r, 'Name (Gujarati)'); if (hi) tr.hi = hi; if (gu) tr.gu = gu
    pending.push({ code, fields, tr, purchaseDisc })
  }
  if (errors.length) rowErrors(errors)
  if (!pending.length) fail(400, 'The sheet has no product rows.')

  categories.push(...newCats); brands.push(...newBrands); subcategories.push(...newSubs)
  let created = 0, updated = 0
  for (const { code, fields, tr, purchaseDisc } of pending) {
    let p = code ? products.find((x) => x.code === code) : null
    if (!p) {
      const id = products.length + 1
      p = { id, code: code ?? `BM${String(id).padStart(6, '0')}`, description: '', stockQty: 0, reservedQty: 0, averageCost: 0, imageUrls: [], translations: {}, groupIds: [],
        variantFamily: null, variantLabel: null, specs: [], locations: [], createdAt: iso(now()) }
      products.push(p); created++
    } else updated++
    Object.assign(p, fields, { translations: { ...p.translations, ...tr }, updatedAt: iso(now()) })
    if (purchaseDisc != null && p.stockQty === 0) p.averageCost = r2((p.mrp > 0 ? p.mrp : p.listPrice) * (1 - purchaseDisc / 100))
  }
  return { created, updated, skipped: 0, warnings: [] }
})

onFirst('POST', '/api/admin/subcategories/import', ({ files }) => {
  const sheet = openSheet(files)
  if (!sheet.has('Category') || !sheet.has('SubCategory')) fail(400, 'The sheet needs Category and SubCategory columns. Download the template.')
  const errors = [], rows = [], seen = new Set()
  for (let r = 2; r <= sheet.lastRow; r++) {
    if (sheet.blank(r)) continue
    const cat = sheet.str(r, 'Category'), sub = sheet.str(r, 'SubCategory')
    if (!cat || !sub) { errors.push({ row: r, message: 'Category and SubCategory are required.' }); continue }
    const k = `${cat.toLowerCase()}|${sub.toLowerCase()}`
    if (seen.has(k)) { errors.push({ row: r, message: `Duplicate row for ${cat} / ${sub}.` }); continue }
    seen.add(k)
    rows.push({ cat, sub, sort: Math.trunc(sheet.dec(r, 'Sort Order', errors) ?? 0), active: sheet.bool(r, 'Active') ?? true })
  }
  if (errors.length) rowErrors(errors)
  let created = 0, updated = 0, skipped = 0
  for (const x of rows) {
    let c = categories.find((y) => y.name.toLowerCase() === x.cat.toLowerCase())
    if (!c) { c = { id: Math.max(0, ...categories.map((y) => y.id)) + 1, name: x.cat, description: '', imageUrl: null, sortOrder: categories.length + 1, isActive: true }; categories.push(c) }
    const s = subcategories.find((y) => y.categoryId === c.id && y.name.toLowerCase() === x.sub.toLowerCase())
    if (!s) { subcategories.push({ id: Math.max(0, ...subcategories.map((y) => y.id)) + 1, categoryId: c.id, name: x.sub, sortOrder: x.sort, isActive: x.active }); created++ }
    else if (s.sortOrder !== x.sort || s.isActive !== x.active) { s.sortOrder = x.sort; s.isActive = x.active; updated++ }
    else skipped++
  }
  return { created, updated, skipped, warnings: [] }
})

onFirst('POST', '/api/admin/purchases/upload', ({ files, body }) => {
  const sheet = openSheet(files)
  for (const h of ['Product Code', 'Quantity', 'List Price']) if (!sheet.has(h)) fail(400, `Missing column "${h}". Download the purchase template.`)
  const errors = [], items = []
  for (let r = 2; r <= sheet.lastRow; r++) {
    if (sheet.blank(r)) continue
    const code = sheet.str(r, 'Product Code')?.toUpperCase(), p = products.find((x) => x.code === code)
    const quantity = sheet.dec(r, 'Quantity', errors) ?? 0, listPrice = sheet.dec(r, 'List Price', errors) ?? 0, disc = sheet.dec(r, 'Purchase Discount %', errors) ?? 0
    const rackLabel = sheet.str(r, 'Rack Location'), rack = rackLabel ? rackLocations.find((l) => l.label.toLowerCase() === rackLabel.toLowerCase()) : null
    if (!p) errors.push({ row: r, message: `Unknown product code "${code ?? ''}".` })
    if (!(quantity > 0)) errors.push({ row: r, message: 'Quantity must be more than zero.' })
    if (listPrice < 0) errors.push({ row: r, message: "List Price can't be negative." })
    if (disc < 0 || disc >= 100) errors.push({ row: r, message: 'Purchase Discount % must be between 0 and 99.' })
    if (rackLabel && !rack) errors.push({ row: r, message: `Unknown rack location "${rackLabel}".` })
    if (p) items.push({ productId: p.id, quantity, listPrice, purchaseDiscountPercent: disc, rackLocationId: rack?.id })
  }
  if (errors.length) rowErrors(errors)
  if (!items.length) fail(400, 'The sheet has no rows.')
  const create = routes.find((x) => x.method === 'POST' && x.re.test('/api/admin/purchases'))
  return create.fn({ body: { supplierName: body.supplierName || null, supplierGstin: body.supplierGstin || null, supplierInvoiceNo: body.supplierInvoiceNo || null, purchaseDate: body.purchaseDate || istDate(now()), notes: body.notes || null, items } })
})

// Exports. Products and sub categories use the import columns, so an export can be edited and imported back.
const yesNo = (v) => (v ? 'Yes' : 'No')
onFirst('GET', '/api/admin/products/export', ({ q, req, uid }) => {
  const list = routes.find((x) => x.method === 'GET' && x.re.test('/api/admin/products'))
  const ids = new Set(list.fn({ q: { ...q, page: 1, __all: true }, req, uid }).items.map((p) => p.id))
  const rows = products.filter((p) => ids.has(p.id)).map((p) => [p.code, p.name, catName(p.categoryId), subName(p.subCategoryId) ?? '', brName(p.brandId), p.unit, p.hsnCode ?? '', p.gstRate, p.mrp, p.listPrice,
    p.partnerDiscountPercent, p.retailDiscountPercent, p.rewardPointsPerUnit, p.reorderLevel, p.sequence, p.barcode ?? '', (p.aliases ?? []).join(', '), p.translations?.hi ?? '', p.translations?.gu ?? '',
    yesNo(p.isActive), yesNo(p.showOnWeb), yesNo(p.showOnApp), p.description ?? '', (p.imageUrls ?? []).filter((u) => !u.startsWith('/files/mock/')).join(', '), p.variantFamily ?? '', p.variantLabel ?? '', (p.specs ?? []).join('; '), ''])
  return xlsxFile('products', 'Products', [PRODUCT_COLUMNS, ...rows])
})
onFirst('GET', '/api/admin/subcategories/export', () =>
  xlsxFile('subcategories', 'SubCategories', [['Category', 'SubCategory', 'Sort Order', 'Active'], ...subcategories.map((s) => [catName(s.categoryId), s.name, s.sortOrder, yesNo(s.isActive)])]))

/** Any other list as a sheet: one column per plain field. */
const humanKey = (k) => k.replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, (c) => c.toUpperCase()).replace(/\bId\b/, 'ID')
function tableRows(data) {
  const list = Array.isArray(data) ? data : data?.items ?? data?.rows ?? []
  const keys = [...new Set(list.flatMap((o) => Object.keys(o).filter((k) => { const v = o[k]; return v == null || ['string', 'number', 'boolean'].includes(typeof v) || (Array.isArray(v) && v.every((x) => typeof x !== 'object')) })))]
  return [keys.map(humanKey), ...list.map((o) => keys.map((k) => { const v = o[k]; return Array.isArray(v) ? v.join(', ') : typeof v === 'boolean' ? yesNo(v) : v ?? '' }))]
}
for (const name of ['orders', 'partners', 'stock']) onFirst('GET', `/api/admin/${name}/export`, ({ q, req, uid, me }) => {
  const list = routes.find((x) => x.method === 'GET' && x.re.test(`/api/admin/${name}`))
  return xlsxFile(name, humanKey(name), tableRows(list.fn({ q: { ...q, page: 1, __all: true }, req, uid, me, p: {} })))
})

// ------------------------------------------------------------------ server
http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Client, Accept-Language')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end() }

  if (url.pathname.startsWith('/files/uploads/')) {
    const u = uploads.get(url.pathname.slice('/files/uploads/'.length))
    if (u) { res.writeHead(200, { 'Content-Type': u.type, 'Cache-Control': 'max-age=3600' }); return res.end(u.data) }
  }
  if (url.pathname.startsWith('/files/mock/')) {
    const f = join(ART, url.pathname.slice('/files/mock/'.length).replace(/[^a-z0-9.-]/gi, ''))
    if (existsSync(f)) { res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'max-age=3600' }); return res.end(readFileSync(f)) }
  }
  const token = (req.headers.authorization ?? '').replace('Bearer ', '')
  const uid = sessions.get(token)
  let body = null, files = null
  if (['POST', 'PUT'].includes(req.method)) {
    const chunks = []; for await (const c of req) chunks.push(c)
    const buf = Buffer.concat(chunks), ct = req.headers['content-type'] ?? ''
    if (ct.includes('multipart/form-data')) { const mp = parseMultipart(buf, ct); body = mp.fields; files = mp.files }
    else { const raw = buf.toString(); try { body = raw && ct.includes('json') ? JSON.parse(raw) : {} } catch { body = {} } }
  }
  const q = Object.fromEntries(url.searchParams)
  for (const r of routes) {
    if (r.method !== req.method) continue
    const m = r.re.exec(url.pathname)
    if (!m) continue
    const needsAuth = !url.pathname.startsWith('/api/auth/') && !url.pathname.startsWith('/api/catalog/')
    try {
      if (needsAuth && !uid) throw new HttpError(401, 'Please log in.')
      if (url.pathname.startsWith('/api/admin/') && user(uid)?.userType !== 'Staff') throw new HttpError(403, "You don't have access to this.")
      let result = await r.fn({ req, q, p: m.groups ?? {}, body, files, uid, me: () => user(uid) })
      // report screens: ?export=true returns the same rows as an Excel file
      if (q.export === 'true' && req.method === 'GET' && result && !result.__xlsx) result = xlsxFile(url.pathname.split('/').pop(), humanKey(url.pathname.split('/').pop()), tableRows(result))
      if (result?.__xlsx) { res.writeHead(200, { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="${result.name}"`, 'Access-Control-Expose-Headers': 'Content-Disposition' }); return res.end(result.__xlsx) }
      if (result?.__png) { res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Disposition': `inline; filename="${result.name}"`, 'Access-Control-Expose-Headers': 'Content-Disposition' }); return res.end(result.__png) }
      if (result?.__svg) { res.writeHead(200, { 'Content-Type': 'image/svg+xml' }); return res.end(result.__svg) }
      if (result?.__file) { res.writeHead(200, { 'Content-Type': 'image/svg+xml' }); return res.end(readFileSync(result.__file)) }
      if (result === null || result === undefined) { res.writeHead(204); return res.end() }
      res.writeHead(200, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify(result))
    } catch (e) {
      const status = e.status ?? 500
      if (status === 500) console.error(e)
      res.writeHead(status, { 'Content-Type': 'application/problem+json' })
      return res.end(JSON.stringify({ status, title: e.message, type: e.code, ...(e.errors ? { errors: e.errors } : {}) }))
    }
  }
  res.writeHead(404, { 'Content-Type': 'application/problem+json' }); res.end(JSON.stringify({ status: 404, title: 'Not found' }))
}).listen(PORT, () => console.log(`BuildMate mock API on http://localhost:${PORT}  ·  ${products.length} products, ${orders.length} orders, ${partners.length} partners`))
