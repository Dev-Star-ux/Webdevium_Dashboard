'use client'

import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Plus, CreditCard, Clock, CheckCircle, TrendingUp, AlertTriangle } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { getBrowserSupabase } from '@/lib/supabase/client'
import { SubmitTaskDialog } from '@/components/tasks/submit-task-dialog'
import { useRouter } from 'next/navigation'

type UsageStatus = 'On Track' | 'Approaching Limit' | 'Exceeded'

type RecentTask = {
  id: string
  title: string
  status: 'queued' | 'in_progress' | 'done'
  created_at: string
  completed_at: string | null
}

function useDashboardData() {
  const [loading, setLoading] = useState(true)
  const [clientId, setClientId] = useState<string | null>(null)
  const [planName, setPlanName] = useState<string>('')
  const [usagePercent, setUsagePercent] = useState<number>(0)
  const [recentTasks, setRecentTasks] = useState<RecentTask[]>([])
  const [tasksCompletedThisMonth, setTasksCompletedThisMonth] = useState<number>(0)
  const [avgTurnaroundDays, setAvgTurnaroundDays] = useState<number>(0)

  useEffect(() => {
    let supabase: ReturnType<typeof getBrowserSupabase> | null = null
    try {
      supabase = getBrowserSupabase()
    } catch (e) {
      console.error('Error loading dashboard data:', e)
      setLoading(false)
      return
    }
    async function load() {
      setLoading(true)
      // Find a client_id for current user (first membership)
      const { data: membership } = await supabase!
        .from('client_members')
        .select('client_id')
        .limit(1)
        .maybeSingle()

      if (!membership?.client_id) {
        // Redirect to onboarding if no client
        if (typeof window !== 'undefined') {
          window.location.href = '/onboarding'
        }
        return
      }

      setClientId(membership.client_id)

      const [usageRes, tasksRes, clientRes, statsRes] = await Promise.all([
        supabase!.from('v_client_usage').select('hours_monthly,hours_used,pct_used').eq('client_id', membership.client_id).maybeSingle(),
        supabase!.from('tasks').select('id,title,status,created_at,completed_at').eq('client_id', membership.client_id).order('created_at', { ascending: false }).limit(10),
        supabase!.from('clients').select('plan_code, plans!inner(name)').eq('id', membership.client_id).single(),
        supabase!.rpc('calculate_task_stats', { p_client_id: membership.client_id }).maybeSingle()
      ])

      if (usageRes.data) {
        setUsagePercent(Number(usageRes.data.pct_used ?? 0))
      }
      
      // Get plan name from clients query
      if (clientRes.data) {
        const planName = (clientRes.data as any).plans?.name
        const planCode = (clientRes.data as any).plan_code
        setPlanName(planName || planCode || '')
      }

      if (tasksRes.data) setRecentTasks(tasksRes.data as any)

      if (statsRes?.data) {
        setTasksCompletedThisMonth(Number((statsRes.data as any).completed_this_month ?? 0))
        setAvgTurnaroundDays(Number(((statsRes.data as any).avg_turnaround_days ?? 0)))
      }

      setLoading(false)
    }
    load()
  }, [])

  const usageStatus: UsageStatus = useMemo(() => {
    if (usagePercent >= 100) return 'Exceeded'
    if (usagePercent >= 80) return 'Approaching Limit'
    return 'On Track'
  }, [usagePercent])

  return {
    loading,
    clientId,
    planName,
    usagePercent,
    usageStatus,
    recentTasks,
    tasksCompletedThisMonth,
    avgTurnaroundDays,
  }
}

function UsageMeter({ usagePercent, usageStatus, router }: { usagePercent: number; usageStatus: UsageStatus; router: any }) {
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'On Track': return 'success'
      case 'Approaching Limit': return 'warning'
      case 'Exceeded': return 'destructive'
      default: return 'default'
    }
  }

  const getProgressColor = (usage: number) => {
    if (usage >= 100) return 'bg-red-500'
    if (usage >= 80) return 'bg-yellow-500'
    return 'bg-green-500'
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          Monthly Usage
          <Badge variant={getStatusColor(usageStatus) as any}>
            {usageStatus}
          </Badge>
        </CardTitle>
        <CardDescription>
          Your development capacity for this month
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex justify-between text-sm">
            <span>Used</span>
            <span>{usagePercent}% of plan capacity</span>
          </div>
          <Progress value={Math.min(usagePercent, 100)} className="h-3" />
          {usagePercent >= 80 && (
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border border-yellow-200">
              <div className="flex items-center space-x-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                <div>
                  <p className="text-sm font-semibold text-yellow-900">
                    {usagePercent >= 100 ? 'Usage Limit Exceeded' : 'Approaching Usage Limit'}
                  </p>
                  <p className="text-xs text-yellow-700 mt-1">
                    {usagePercent >= 100 
                      ? 'You\'ve exceeded your plan capacity. Upgrade to continue receiving service.'
                      : 'You\'re at ' + Math.round(usagePercent) + '% of your plan capacity. Consider upgrading for more hours.'}
                  </p>
                </div>
              </div>
              <Button 
                onClick={() => router.push('/billing')}
                size="sm"
                className="bg-yellow-600 hover:bg-yellow-700 text-white"
              >
                Upgrade Plan
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function StatsCards({ planName, tasksCompleted, avgTurnaround }: { planName: string; tasksCompleted: number; avgTurnaround: number }) {

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Tasks Completed</CardTitle>
          <CheckCircle className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{tasksCompleted}</div>
          <p className="text-xs text-muted-foreground">This month</p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Avg Turnaround</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{avgTurnaround.toFixed(1)} days</div>
          <p className="text-xs text-muted-foreground">Per task</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Plan</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{planName || '—'}</div>
          <p className="text-xs text-muted-foreground">Current plan</p>
        </CardContent>
      </Card>
    </div>
  )
}

function RecentActivity({ tasks }: { tasks: RecentTask[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>Your latest task updates</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {tasks.map((task) => (
            <div key={task.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex-1">
                <p className="font-medium">{task.title}</p>
                <p className="text-sm text-muted-foreground">
                  {task.status === 'done' && (task.completed_at ? `Completed ${new Date(task.completed_at).toLocaleString()}` : 'Completed')}
                  {task.status === 'in_progress' && `In progress since ${new Date(task.created_at).toLocaleString()}`}
                  {task.status === 'queued' && `Queued ${new Date(task.created_at).toLocaleString()}`}
                </p>
              </div>
              <Badge 
                variant={task.status === 'done' ? 'success' : task.status === 'in_progress' ? 'default' : 'secondary'}
              >
                {task.status === 'done' ? 'Completed' : task.status === 'in_progress' ? 'In Progress' : 'Queued'}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

export default function DashboardPage() {
  const { loading, clientId, usagePercent, usageStatus, recentTasks, planName, tasksCompletedThisMonth, avgTurnaroundDays } = useDashboardData()
  const [submitTaskOpen, setSubmitTaskOpen] = useState(false)
  const router = useRouter()

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
          <div>
            <h1 className="text-2xl font-bold">Welcome back</h1>
            <p className="text-muted-foreground">Here's what's happening with your projects</p>
          </div>
          <div className="flex space-x-2">
            <Button onClick={() => setSubmitTaskOpen(true)} disabled={!clientId}>
              <Plus className="h-4 w-4 mr-2" />
              Submit New Task
            </Button>
            <Button variant="outline" onClick={() => router.push('/billing')}>
              <CreditCard className="h-4 w-4 mr-2" />
              Manage Billing
            </Button>
          </div>
        </div>

        {/* Submit Task Dialog */}
        {clientId && (
          <SubmitTaskDialog 
            isOpen={submitTaskOpen}
            onClose={() => setSubmitTaskOpen(false)}
            clientId={clientId}
          />
        )}

        {/* Usage Meter */}
        <UsageMeter usagePercent={usagePercent} usageStatus={usageStatus} router={router} />

        {/* Stats Cards */}
        <StatsCards planName={planName} tasksCompleted={tasksCompletedThisMonth} avgTurnaround={avgTurnaroundDays} />

        {/* Recent Activity */}
        <RecentActivity tasks={recentTasks} />
      </div>
    </DashboardLayout>
  )
}
