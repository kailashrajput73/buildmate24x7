import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ErrorBox, Loading, PageHeader, Section, Stat } from '../components/ui'
import { api } from '../lib/api'
import { money0, moneyShort, qty } from '../lib/format'
import type { Dashboard as D, NamedValue } from '../lib/types'

const CH = { app: '#1A63C7', web: '#2E9B3E', store: '#F2B300' }

export default function Dashboard() {
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ['dashboard'], queryFn: () => api.get<D>('/api/admin/dashboard'), refetchInterval: 60000 })
  if (isLoading) return <Loading />
  if (error || !data) return <><ErrorBox error={error} /><button className="btn mt-3" onClick={() => refetch()}>Retry dashboard</button></>
  const k = data.kpis
  const monthChange = k.salesLastMonth > 0 ? ((k.salesThisMonth - k.salesLastMonth) / k.salesLastMonth) * 100 : null

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Sales are counted when payment is received. Times are IST." />
      {data.overview && <Section title="All records" className="mb-4">
        <p className="mb-3 text-sm text-ink-soft">Totals include all dates and statuses. Open a card to view its records.</p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <ActionTile to="/products" n={data.overview.products} label="total products" />
          <ActionTile to="/categories" n={data.overview.categories} label="categories" />
          <ActionTile to="/brands" n={data.overview.brands} label="brands" />
          <ActionTile to="/customers" n={data.overview.customers} label="customers" />
          <ActionTile to="/partners" n={data.overview.partners} label="referral partners" />
          <ActionTile to="/orders" n={data.overview.orders} label="total orders" />
          <ActionTile to="/quotations" n={data.overview.quotations} label="quotations" />
        </div>
      </Section>}

      {/* Things that need someone to act come first. */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ActionTile to="/orders?status=Paid" n={k.awaitingDispatch} label="orders to pack & dispatch" />
        <ActionTile to="/partners?kycStatus=Pending" n={k.pendingKyc} label="partner KYCs to review" />
        <ActionTile to="/stock?lowOnly=true" n={k.lowStockCount} label="products at or below reorder level" />
        <ActionTile to="/service-requests?status=Pending" n={k.openServiceRequests} label="open plumber / electrician requests" />
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Sales today" value={money0(k.salesToday)} sub={`${k.ordersToday} orders`} />
        <Stat label="Sales this month" value={money0(k.salesThisMonth)}
          sub={monthChange == null ? `${k.ordersThisMonth} orders` : `${k.ordersThisMonth} orders · ${monthChange >= 0 ? '+' : ''}${monthChange.toFixed(0)}% vs last month`}
          tone={monthChange != null && monthChange >= 0 ? 'good' : undefined} />
        <Stat label="Average order" value={money0(k.averageOrderValue)} sub="this month" />
        <Stat label="Stock value" value={moneyShort(k.inventoryValue)} sub={`${k.activePartners} approved partners`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Section title="Last 30 days by channel" className="xl:col-span-2"
          actions={<div className="flex gap-3 text-xs text-ink-soft">{Object.entries(CH).map(([n, c]) => <span key={n} className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-sm" style={{ background: c }} />{n === 'app' ? 'Partner app' : n === 'web' ? 'Website' : 'Counter'}</span>)}</div>}>
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={data.trend} margin={{ left: 4, right: 4, top: 4 }}>
                <CartesianGrid vertical={false} stroke="#E6EBF2" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#8A96AB' }} interval={4} tickLine={false} axisLine={false} />
                <YAxis tickFormatter={moneyShort} tick={{ fontSize: 11, fill: '#8A96AB' }} width={56} tickLine={false} axisLine={false} />
                <Tooltip formatter={(v: number) => money0(v)} cursor={{ fill: '#EEF4FC' }} />
                <Bar dataKey="app" name="Partner app" stackId="a" fill={CH.app} />
                <Bar dataKey="web" name="Website" stackId="a" fill={CH.web} />
                <Bar dataKey="store" name="Counter" stackId="a" fill={CH.store} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Section>
        <RankList title="Top categories (30 days)" rows={data.byCategory} />
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <RankList title="Top products (30 days)" rows={data.topProducts} showQty link={(r) => `/products/${r.id}`} />
        <RankList title="Top partners (30 days)" rows={data.topPartners} link={(r) => `/partners/${r.id}`} />
      </div>
    </>
  )
}

function ActionTile({ to, n, label }: { to: string; n: number; label: string }) {
  return (
    <Link to={to} className={`card flex items-center gap-3 px-4 py-3 transition-colors hover:border-pipe-500 ${n > 0 ? 'border-l-4 border-l-tape-500' : ''}`}>
      <span className={`num text-3xl font-display font-bold ${n > 0 ? 'text-ink' : 'text-ink-faint'}`}>{n}</span>
      <span className="text-sm text-ink-soft">{label}</span>
    </Link>
  )
}

function RankList({ title, rows, showQty, link }: { title: string; rows: NamedValue[]; showQty?: boolean; link?: (r: NamedValue) => string }) {
  const max = Math.max(1, ...rows.map((r) => r.amount))
  return (
    <Section title={title}>
      {rows.length === 0 ? <p className="py-6 text-center text-sm text-ink-faint">No sales yet in this period.</p> : (
        <ul className="space-y-2.5">
          {rows.map((r) => {
            const name = link ? <Link to={link(r)} className="hover:text-pipe-600 hover:underline">{r.name}</Link> : r.name
            return (
              <li key={r.id}>
                <div className="flex justify-between gap-3 text-sm">
                  <span className="truncate">{name}</span>
                  <span className="num shrink-0 font-semibold">{money0(r.amount)}</span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-1.5 flex-1 rounded-full bg-paper"><div className="h-1.5 rounded-full bg-pipe-500" style={{ width: `${(r.amount / max) * 100}%` }} /></div>
                  <span className="num w-24 text-right text-2xs text-ink-faint">{showQty ? `${qty(r.quantity)} sold` : `${r.orders} orders`}</span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </Section>
  )
}
