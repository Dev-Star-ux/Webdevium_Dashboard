'use client'

import { useState, useEffect } from 'react'
import { Sidebar } from './sidebar'
import { Topbar } from './topbar'
import { getBrowserSupabase } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'

interface DashboardLayoutProps {
  children: React.ReactNode
  isAdmin?: boolean
}

export function DashboardLayout({ children, isAdmin: isAdminProp = false }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [userRole, setUserRole] = useState<'admin' | 'pm' | 'dev' | 'client' | null>(null)
  const supabase = getBrowserSupabase()

  useEffect(() => {
    async function loadUserRole() {
      // Get initial user
      const { data: { user: authUser } } = await supabase.auth.getUser()
      setUser(authUser)

      if (authUser) {
        // Get user role from client_members
        const { data: membership } = await supabase
          .from('client_members')
          .select('role')
          .eq('user_id', authUser.id)
          .limit(1)
          .maybeSingle()

        if (membership) {
          setUserRole(membership.role as 'admin' | 'pm' | 'dev' | 'client' | null)
        }
      }
    }

    loadUserRole()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null)
      
      if (session?.user) {
        const { data: membership } = await supabase
          .from('client_members')
          .select('role')
          .eq('user_id', session.user.id)
          .limit(1)
          .maybeSingle()

        if (membership) {
          setUserRole(membership.role as 'admin' | 'pm' | 'dev' | 'client' | null)
        }
      }
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  // Determine if admin based on role or prop
  const isAdmin = isAdminProp || userRole === 'admin' || userRole === 'pm'

  const userName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'User'
  const userEmail = user?.email

  return (
    <div className="flex h-screen bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex md:flex-shrink-0">
        <Sidebar isAdmin={isAdmin} />
      </div>

      {/* Mobile Sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="fixed inset-0 bg-black bg-opacity-25" onClick={() => setSidebarOpen(false)} />
          <div className="fixed left-0 top-0 bottom-0 w-64 z-50">
            <Sidebar isAdmin={isAdmin} />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar 
          onMenuClick={() => setSidebarOpen(true)} 
          userName={userName}
          userEmail={userEmail}
        />
        
        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          <div className="p-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
