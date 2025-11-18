'use client'

import { useState } from 'react'
import { Sidebar } from './sidebar'
import { Topbar } from './topbar'
import { useUser } from '@/contexts/user-context'

interface DashboardLayoutProps {
  children: React.ReactNode
  isAdmin?: boolean
}

export function DashboardLayout({ children, isAdmin: isAdminProp = false }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  // Use cached user data from context instead of fetching
  const { user, isAdmin: isUserAdmin } = useUser()

  // Determine if admin based on role or prop
  const isAdmin = isAdminProp || isUserAdmin

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
