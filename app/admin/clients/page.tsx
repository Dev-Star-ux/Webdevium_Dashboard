'use client'

import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Users, AlertTriangle, Calendar, Clock, TrendingUp } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getBrowserSupabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Client = {
  id: string
  name: string
  plan_code: string
  hours_monthly: number
  hours_used_month: number
  cycle_start: string
  owner_user_id: string
  plan_name?: string
  usage_percent?: number
  risk_flag?: 'low' | 'medium' | 'high'
}

export default function AdminClientsPage() {
  const [loading, setLoading] = useState(true)
  const [clients, setClients] = useState<Client[]>([])
  const [userRole, setUserRole] = useState<'admin' | 'pm' | 'dev' | 'client' | null>(null)
  const router = useRouter()
  const supabase = getBrowserSupabase()

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        // Get user and role
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/login')
          return
        }

        // Get user role - check all memberships to find admin/pm role
        const { data: memberships } = await supabase
          .from('client_members')
          .select('role')
          .eq('user_id', user.id)

        const isAdminOrPM = memberships?.some(m => m.role === 'admin' || m.role === 'pm')
        
        if (!isAdminOrPM) {
          router.push('/dashboard')
          return
        }

        // Set role (use first admin/pm role found)
        const adminOrPMMembership = memberships?.find(m => m.role === 'admin' || m.role === 'pm')
        if (adminOrPMMembership) {
          setUserRole(adminOrPMMembership.role as 'admin' | 'pm')
        }

        // Fetch all clients with usage data
        // First get clients, then join with usage view
        const { data: clientsData, error } = await supabase
          .from('clients')
          .select(`
            id,
            name,
            plan_code,
            cycle_start,
            owner_user_id,
            hours_monthly,
            hours_used_month,
            plans!inner(name)
          `)
          .order('name')

        if (error) {
          console.error('Error fetching clients:', error)
        } else if (clientsData) {
          // Get usage data from view for each client
          const clientIds = (clientsData as any[]).map(c => c.id)
          const { data: usageData } = await supabase
            .from('v_client_usage')
            .select('client_id, hours_used, pct_used')
            .in('client_id', clientIds)

          // Create a map of usage data by client_id
          const usageMap = new Map()
          if (usageData) {
            usageData.forEach((u: any) => {
              usageMap.set(u.client_id, {
                hours_used: Number(u.hours_used || 0),
                pct_used: Number(u.pct_used || 0),
              })
            })
          }

          const formattedClients: Client[] = (clientsData as any[]).map((c: any) => {
            const usage = usageMap.get(c.id) || { hours_used: 0, pct_used: 0 }
            const usagePercent = usage.pct_used
            const planName = c.plans?.name || c.plan_code
            
            // Determine risk flag
            let riskFlag: 'low' | 'medium' | 'high' = 'low'
            if (usagePercent >= 100) riskFlag = 'high'
            else if (usagePercent >= 80) riskFlag = 'medium'

            return {
              id: c.id,
              name: c.name,
              plan_code: c.plan_code,
              hours_monthly: Number(c.hours_monthly || 0),
              hours_used_month: usage.hours_used,
              cycle_start: c.cycle_start,
              owner_user_id: c.owner_user_id,
              plan_name: planName,
              usage_percent: usagePercent,
              risk_flag: riskFlag,
            }
          })
          setClients(formattedClients)
        }
      } catch (e) {
        console.error('Failed to load clients:', e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [supabase, router])

  const getRiskBadgeVariant = (risk: string) => {
    switch (risk) {
      case 'high': return 'destructive'
      case 'medium': return 'warning'
      default: return 'success'
    }
  }

  const getNextResetDate = (cycleStart: string) => {
    const start = new Date(cycleStart)
    start.setMonth(start.getMonth() + 1)
    return start
  }

  if (loading) {
    return (
      <DashboardLayout isAdmin={true}>
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-muted-foreground">Loading clients...</p>
          </CardContent>
        </Card>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout isAdmin={true}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Clients</h1>
          <p className="text-muted-foreground">Manage all clients and monitor usage</p>
        </div>

        {/* Stats Summary */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{clients.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">At Risk</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {clients.filter(c => c.risk_flag === 'high' || c.risk_flag === 'medium').length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Hours Used</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {clients.reduce((sum, c) => sum + c.hours_used_month, 0).toFixed(1)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Usage</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {clients.length > 0 
                  ? (clients.reduce((sum, c) => sum + (c.usage_percent || 0), 0) / clients.length).toFixed(1)
                  : '0'}%
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Clients List */}
        <Card>
          <CardHeader>
            <CardTitle>All Clients</CardTitle>
            <CardDescription>Internal view: hours used and capacity tracking</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {clients.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No clients found</p>
                </div>
              ) : (
                clients.map((client) => {
                  const nextReset = getNextResetDate(client.cycle_start)
                  const daysUntilReset = Math.ceil((nextReset.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                  
                  return (
                    <div key={client.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 className="font-semibold text-lg">{client.name}</h3>
                            <Badge variant="secondary">{client.plan_name}</Badge>
                            <Badge variant={getRiskBadgeVariant(client.risk_flag || 'low')}>
                              {client.risk_flag === 'high' ? 'High Risk' : 
                               client.risk_flag === 'medium' ? 'At Risk' : 'On Track'}
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Hours Used</p>
                              <p className="text-sm font-medium">
                                {client.hours_used_month.toFixed(1)} / {client.hours_monthly}
                              </p>
                            </div>
                            
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Usage %</p>
                              <p className="text-sm font-medium">{client.usage_percent?.toFixed(1) || 0}%</p>
                            </div>
                            
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Reset Date</p>
                              <p className="text-sm font-medium">
                                {nextReset.toLocaleDateString('en-US', { 
                                  month: 'short', 
                                  day: 'numeric' 
                                })}
                              </p>
                            </div>
                            
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Days Until Reset</p>
                              <p className="text-sm font-medium">{daysUntilReset} days</p>
                            </div>
                          </div>

                          <div className="mt-3">
                            <Progress 
                              value={Math.min(client.usage_percent || 0, 100)} 
                              className="h-2"
                            />
                          </div>
                        </div>
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/admin/tasks?clientId=${client.id}`)}
                        >
                          View Tasks
                        </Button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}

