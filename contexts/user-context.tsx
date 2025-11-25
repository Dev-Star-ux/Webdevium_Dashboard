'use client'

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react'
import { User } from '@supabase/supabase-js'
import { getBrowserSupabase } from '@/lib/supabase/client'

interface UserMembership {
  client_id: string
  role: 'admin' | 'pm' | 'dev' | 'client'
}

interface UserRecord {
  role: 'admin' | 'pm' | 'dev' | 'client'
}

interface UserContextType {
  user: User | null
  userRecord: UserRecord | null
  membership: UserMembership | null
  clientId: string | null
  userRole: 'admin' | 'pm' | 'dev' | 'client' | null
  loading: boolean
  refresh: () => Promise<void>
  isAdmin: boolean
}

const UserContext = createContext<UserContextType | undefined>(undefined)

const CACHE_KEY = 'user_data_cache'
const CACHE_DURATION = 30 * 1000 // 30 seconds - short cache for faster navigation, but ensures fresh data on refresh

interface CacheData {
  user: User | null
  userRecord: UserRecord | null
  membership: UserMembership | null
  timestamp: number
}

// Helper to get cache from localStorage
function getCache(): CacheData | null {
  if (typeof window === 'undefined') return null
  try {
    const cached = localStorage.getItem(CACHE_KEY)
    if (!cached) return null
    const data: CacheData = JSON.parse(cached)
    const now = Date.now()
    // Check if cache is still valid (within cache duration)
    if (now - data.timestamp < CACHE_DURATION) {
      return data
    }
    // Cache expired, remove it
    localStorage.removeItem(CACHE_KEY)
    return null
  } catch {
    return null
  }
}

// Helper to save cache to localStorage
function setCache(data: Omit<CacheData, 'timestamp'>) {
  if (typeof window === 'undefined') return
  try {
    const cache: CacheData = {
      ...data,
      timestamp: Date.now(),
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch {
    // Ignore localStorage errors
  }
}

// Helper to clear cache
function clearCache() {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(CACHE_KEY)
  } catch {
    // Ignore localStorage errors
  }
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [userRecord, setUserRecord] = useState<UserRecord | null>(null)
  const [membership, setMembership] = useState<UserMembership | null>(null)
  const [loading, setLoading] = useState(true)
  const supabase = getBrowserSupabase()

  const loadUserData = useCallback(async (forceRefresh = false) => {
    try {
      setLoading(true)

      // Always verify auth session first, even when using cache
      const { data: { user: authUser } } = await supabase.auth.getUser()

      if (!authUser) {
        setUser(null)
        setUserRecord(null)
        setMembership(null)
        clearCache()
        setLoading(false)
        return
      }

      // Check cache only after auth is verified and if not forcing refresh
      if (!forceRefresh) {
        const cached = getCache()
        // Validate cache: user ID must match current auth user
        if (cached && cached.user?.id === authUser.id) {
          setUser(cached.user)
          setUserRecord(cached.userRecord)
          setMembership(cached.membership)
          setLoading(false)
          // Fetch fresh data in background to update cache (don't await)
          // Use setTimeout to avoid interfering with current render cycle
          setTimeout(() => {
            loadUserData(true).catch(() => {})
          }, 100)
          return
        }
      }

      // Parallel: Fetch user record and membership at once
      const [{ data: record }, { data: mem }] = await Promise.all([
        supabase
          .from('users')
          .select('role')
          .eq('id', authUser.id)
          .maybeSingle(),
        supabase
          .from('client_members')
          .select('client_id, role')
          .eq('user_id', authUser.id)
          .limit(1)
          .maybeSingle(),
      ])

      setUser(authUser)
      setUserRecord(record)
      setMembership(mem || null)

      // Update cache
      setCache({
        user: authUser,
        userRecord: record,
        membership: mem || null,
      })

      setLoading(false)
    } catch (error) {
      console.error('Error loading user data:', error)
      setLoading(false)
    }
  }, [supabase])

  const refresh = useCallback(async () => {
    await loadUserData(true)
  }, [loadUserData])

  useEffect(() => {
    let cancelled = false

    // Load initial user data
    loadUserData().then(() => {
      if (cancelled) return
    })

    // Listen for auth changes to invalidate cache and reload
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (cancelled) return

      // Clear cache on auth changes
      clearCache()

      if (session?.user) {
        // Reload user data when auth changes
        await loadUserData(true)
      } else {
        // User logged out
        setUser(null)
        setUserRecord(null)
        setMembership(null)
        setLoading(false)
      }
    })

    // Refresh stale cache when page becomes visible after being hidden
    const handleVisibilityChange = () => {
      if (!cancelled && document.visibilityState === 'visible') {
        const cached = getCache()
        if (cached) {
          const cacheAge = Date.now() - cached.timestamp
          // If cache is older than duration, refresh it
          if (cacheAge > CACHE_DURATION) {
            loadUserData(true).catch(() => {})
          }
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      cancelled = true
      subscription.unsubscribe()
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [supabase, loadUserData])

  // Memoize computed values
  const clientId = useMemo(() => membership?.client_id || null, [membership])
  const userRole = useMemo(() => {
    // Prefer users.role for global roles, fallback to membership.role
    return userRecord?.role || membership?.role || null
  }, [userRecord, membership])
  
  const isAdmin = useMemo(() => {
    return userRole === 'admin' || userRole === 'pm'
  }, [userRole])

  const value = useMemo(() => ({
    user,
    userRecord,
    membership,
    clientId,
    userRole,
    loading,
    refresh,
    isAdmin,
  }), [user, userRecord, membership, clientId, userRole, loading, refresh, isAdmin])

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>
}

export function useUser() {
  const context = useContext(UserContext)
  if (context === undefined) {
    throw new Error('useUser must be used within a UserProvider')
  }
  return context
}

