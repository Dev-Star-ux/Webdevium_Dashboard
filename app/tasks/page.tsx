'use client'

import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, MoreHorizontal, Paperclip, Calendar, User } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getBrowserSupabase } from '@/lib/supabase/client'
import { SubmitTaskDialog } from '@/components/tasks/submit-task-dialog'
import { useRouter } from 'next/navigation'

type Task = {
  id: string
  title: string
  description: string | null
  priority: 'low' | 'medium' | 'high'
  status: 'queued' | 'in_progress' | 'done'
  attachments: any[]
  created_at: string
  completed_at: string | null
  assigned_dev_id: string | null
  assigned_dev?: {
    email: string
  }
}

interface TaskCardProps {
  task: any
  canReorder?: boolean
}

function TaskCard({ task, canReorder = false }: TaskCardProps) {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'High': return 'destructive'
      case 'Medium': return 'warning'
      case 'Low': return 'secondary'
      default: return 'default'
    }
  }

  return (
    <Card className="mb-3 cursor-pointer hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex justify-between items-start mb-2">
          <h4 className="font-medium text-sm">{task.title}</h4>
          <Button variant="ghost" size="icon" className="h-6 w-6">
            <MoreHorizontal className="h-3 w-3" />
          </Button>
        </div>
        
        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
          {task.description}
        </p>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Badge variant={getPriorityColor(task.priority) as any} className="text-xs">
              {task.priority}
            </Badge>
            {task.attachments > 0 && (
              <div className="flex items-center text-xs text-muted-foreground">
                <Paperclip className="h-3 w-3 mr-1" />
                {task.attachments}
              </div>
            )}
          </div>
          
          <div className="flex items-center text-xs text-muted-foreground">
            <Calendar className="h-3 w-3 mr-1" />
            {new Date(task.createdAt).toLocaleDateString()}
          </div>
        </div>

        {task.assignedDev && (
          <div className="mt-2 pt-2 border-t">
            <p className="text-xs text-muted-foreground">
              Assigned to: <span className="font-medium">{task.assignedDev}</span>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

interface KanbanColumnProps {
  title: string
  tasks: any[]
  canReorder?: boolean
  count: number
}

function KanbanColumn({ title, tasks, canReorder = false, count }: KanbanColumnProps) {
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
          {title}
        </h3>
        <Badge variant="secondary" className="text-xs">
          {count}
        </Badge>
      </div>
      
      <div className="space-y-3 min-h-[200px]">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} canReorder={canReorder} />
        ))}
        
        {tasks.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">No tasks</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function TasksPage() {
  const [loading, setLoading] = useState(true)
  const [clientId, setClientId] = useState<string | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [submitTaskOpen, setSubmitTaskOpen] = useState(false)
  const router = useRouter()
  const supabase = getBrowserSupabase()

  // Fetch tasks from Supabase
  useEffect(() => {
    async function loadTasks() {
      setLoading(true)
      try {
        // Get client membership
        const { data: membership } = await supabase
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

        // Fetch tasks with assigned dev info
        const { data: tasksData, error } = await supabase
          .from('tasks')
          .select(`
            *,
            assigned_dev:users!tasks_assigned_dev_id_fkey(email)
          `)
          .eq('client_id', membership.client_id)
          .order('position', { ascending: true })
          .order('created_at', { ascending: false })

        if (error) {
          console.error('Error fetching tasks:', error)
        } else if (tasksData) {
          setTasks(tasksData as any)
        }
      } catch (e) {
        console.error('Failed to load tasks:', e)
      } finally {
        setLoading(false)
      }
    }

    loadTasks()
  }, [supabase])

  // Group tasks by status
  const queuedTasks = tasks.filter(t => t.status === 'queued')
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress')
  const doneTasks = tasks.filter(t => t.status === 'done')

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
          <div>
            <h1 className="text-2xl font-bold">My Tasks</h1>
            <p className="text-muted-foreground">Track your project progress</p>
          </div>
          <Button onClick={() => setSubmitTaskOpen(true)} disabled={!clientId}>
            <Plus className="h-4 w-4 mr-2" />
            Submit New Task
          </Button>
        </div>

        {/* Submit Task Dialog */}
        {clientId && (
          <SubmitTaskDialog 
            isOpen={submitTaskOpen}
            onClose={() => setSubmitTaskOpen(false)}
            clientId={clientId}
          />
        )}

        {/* Loading State */}
        {loading && (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">Loading tasks...</p>
            </CardContent>
          </Card>
        )}

        {/* Task Board */}
        {!loading && clientId && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <KanbanColumn 
                title="Queued" 
                tasks={queuedTasks} 
                canReorder={true}
                count={queuedTasks.length}
              />
              <KanbanColumn 
                title="In Progress" 
                tasks={inProgressTasks}
                count={inProgressTasks.length}
              />
              <KanbanColumn 
                title="Done" 
                tasks={doneTasks}
                count={doneTasks.length}
              />
            </div>

            {/* Info Card */}
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                  <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                  <span>Submit new tasks using the button above. Our team will review and start working on them according to your plan's capacity.</span>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  )
}
