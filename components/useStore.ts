'use client'
import { useSyncExternalStore, useEffect, useState } from 'react'
import { subscribe, getRevision } from '@/data/store'
export function useStore() {
  useSyncExternalStore(subscribe, getRevision, () => 0)
  const [, tick] = useState(0)
  useEffect(() => {
    const timer = setInterval(() => tick(n => n + 1), 30000)
    return () => clearInterval(timer)
  }, [])
}
