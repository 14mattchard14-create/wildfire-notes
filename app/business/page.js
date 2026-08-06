'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// /business itself has nothing to show — Forecast is the first sub-tab
// built (see app/business/layout.js's SUB_TABS), so land there by default,
// same pattern as the root page redirecting into /manage.
export default function BusinessIndex() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/business/forecast')
  }, [router])
  return null
}
