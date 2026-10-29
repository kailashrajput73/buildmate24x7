import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { Loading } from './components/ui'
import { P, useAuth } from './lib/auth'
import Login from './pages/Login'

const Dashboard = lazy(() => import('./pages/Dashboard'))
const Orders = lazy(() => import('./pages/Orders'))
const Quotations = lazy(() => import('./pages/Quotations'))
const OrderDetail = lazy(() => import('./pages/OrderDetail'))
const Invoice = lazy(() => import('./pages/Invoice'))
const Counter = lazy(() => import('./pages/Counter'))
const Products = lazy(() => import('./pages/Products'))
const ProductEdit = lazy(() => import('./pages/ProductEdit'))
const Categories = lazy(() => import('./pages/Categories'))
const Brands = lazy(() => import('./pages/Brands'))
const ProductGroups = lazy(() => import('./pages/ProductGroups'))
const Stock = lazy(() => import('./pages/Stock'))
const Purchases = lazy(() => import('./pages/Purchases'))
const PurchaseNew = lazy(() => import('./pages/PurchaseNew'))
const Racks = lazy(() => import('./pages/Racks'))
const Partners = lazy(() => import('./pages/Partners'))
const PartnerDetail = lazy(() => import('./pages/PartnerDetail'))
const ServiceRequests = lazy(() => import('./pages/ServiceRequests'))
const Content = lazy(() => import('./pages/Content'))
const Reports = lazy(() => import('./pages/Reports'))
const Team = lazy(() => import('./pages/Team'))
const Settings = lazy(() => import('./pages/Settings'))
const Integrations = lazy(() => import('./pages/Integrations'))

function Guard({ perm, children }: { perm?: string; children: ReactNode }) {
  const { can } = useAuth()
  if (perm && !can(perm))
    return <div className="card p-8 text-center text-sm text-ink-soft">Your role doesn't include access to this page. Ask an administrator if you need it.</div>
  return <>{children}</>
}

export default function App() {
  const { user, can } = useAuth()
  if (!user) return <Login />
  const home = can(P.dashboard) ? <Dashboard /> : can(P.ordersView) ? <Navigate to="/orders" replace /> : <Navigate to="/products" replace />

  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={home} />
          <Route path="login" element={<Navigate to="/" replace />} />
          <Route path="orders" element={<Guard perm={P.ordersView}><Orders /></Guard>} />
          <Route path="orders/:id" element={<Guard perm={P.ordersView}><OrderDetail /></Guard>} />
          <Route path="quotations" element={<Guard perm={P.ordersView}><Quotations /></Guard>} />
          <Route path="counter" element={<Guard perm={P.counter}><Counter /></Guard>} />
          <Route path="service-requests" element={<Guard perm={P.services}><ServiceRequests /></Guard>} />
          <Route path="products" element={<Guard perm={P.catalogView}><Products /></Guard>} />
          <Route path="products/:id" element={<Guard perm={P.catalogView}><ProductEdit /></Guard>} />
          <Route path="categories" element={<Guard perm={P.catalogView}><Categories /></Guard>} />
          <Route path="brands" element={<Guard perm={P.catalogView}><Brands /></Guard>} />
          <Route path="product-groups" element={<Guard perm={P.catalogView}><ProductGroups /></Guard>} />
          <Route path="stock" element={<Guard perm={P.stockView}><Stock /></Guard>} />
          <Route path="purchases" element={<Guard perm={P.purchases}><Purchases /></Guard>} />
          <Route path="purchases/new" element={<Guard perm={P.purchases}><PurchaseNew /></Guard>} />
          <Route path="racks" element={<Guard perm={P.stockView}><Racks /></Guard>} />
          <Route path="partners" element={<Guard perm={P.partnersView}><Partners /></Guard>} />
          <Route path="partners/:id" element={<Guard perm={P.partnersView}><PartnerDetail /></Guard>} />
          <Route path="content" element={<Guard perm={P.content}><Content /></Guard>} />
          <Route path="reports" element={<Guard perm={P.reports}><Reports /></Guard>} />
          <Route path="team" element={<Guard perm={P.users}><Team /></Guard>} />
          <Route path="settings" element={<Guard perm={P.settings}><Settings /></Guard>} />
          <Route path="integrations" element={<Guard perm={P.settings}><Integrations /></Guard>} />
          <Route path="*" element={<div className="card p-8 text-center text-sm">This page doesn't exist.</div>} />
        </Route>
        <Route path="orders/:id/invoice" element={<Guard perm={P.ordersView}><Invoice /></Guard>} />
      </Routes>
    </Suspense>
  )
}
