'use client'
import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useShop } from '@/lib/shop'
import { Login, rememberAfterLogin } from '@/ui/screens'

function LoginPage() {
  const next = useSearchParams().get('next')
  const { user, ready } = useShop()
  const router = useRouter()
  useEffect(() => { rememberAfterLogin(next) }, [next])
  useEffect(() => { if (ready && user) router.replace(next || '/account') }, [ready, user, next, router])
  return <Login />
}

export default function Page() {
  return <Suspense><LoginPage /></Suspense>
}
