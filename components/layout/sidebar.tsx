'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { 
  LayoutDashboard, 
  CheckSquare, 
  Users, 
  Settings,
  CreditCard,
  LogOut
} from 'lucide-react'
import { Button } from '@/components/ui/button'

const clientSidebarItems = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    title: 'My Tasks',
    href: '/tasks',
    icon: CheckSquare,
  },
  {
    title: 'Billing',
    href: '/billing',
    icon: CreditCard,
  },
  {
    title: 'Settings',
    href: '/settings',
    icon: Settings,
  },
]

const adminSidebarItems = [
  {
    title: 'Dashboard',
    href: '/admin/dashboard',
    icon: LayoutDashboard,
  },
  {
    title: 'Clients',
    href: '/admin/clients',
    icon: Users,
  },
  {
    title: 'Tasks',
    href: '/admin/tasks',
    icon: CheckSquare,
  },
  {
    title: 'Settings',
    href: '/settings',
    icon: Settings,
  },
]

interface SidebarProps {
  isAdmin?: boolean
}

export function Sidebar({ isAdmin = false }: SidebarProps) {
  const pathname = usePathname()

  return (
    <div className="flex h-full w-64 flex-col bg-card border-r">
      {/* Logo */}
      <div className="flex h-16 items-center px-6 border-b">
        <Link href={isAdmin ? "/admin/dashboard" : "/dashboard"} className="flex items-center space-x-2">
          <div className="h-8 w-8 rounded bg-primary"></div>
          <span className="font-semibold text-lg">Webdevium</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        <div className="space-y-1">
          {(isAdmin ? adminSidebarItems : clientSidebarItems).map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                )}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.title}</span>
              </Link>
            )
          })}
        </div>
      </nav>

      {/* User Section */}
      <div className="p-3 border-t">
        <Button variant="ghost" className="w-full justify-start" size="sm">
          <LogOut className="h-4 w-4 mr-3" />
          Sign Out
        </Button>
      </div>
    </div>
  )
}
