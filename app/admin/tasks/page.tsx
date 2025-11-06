'use client'

import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Plus, Filter, Search, Clock } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getBrowserSupabase } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import { EditTaskDialog } from '@/components/tasks/edit-task-dialog'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  useDroppable,
  DragOverlay,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

type Task = {
  id: string
  title: string
  description: string | null
  priority: 'low' | 'medium' | 'high'
  status: 'queued' | 'in_progress' | 'done'
  est_hours: number | null
  hours_spent: number | null
  assigned_dev_id: string | null
  client_id: string
  created_at: string
  completed_at: string | null
  position?: number
  assigned_dev?: {
    id?: string
    email: string
  }
  client?: {
    name: string
  }
}

type Client = {
  id: string
  name: string
}

type Developer = {
  id: string
  email: string
}

interface TaskCardProps {
  task: Task
  onEdit: (task: Task) => void
}

function TaskCard({ task, onEdit }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0 : 1,
  }

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'high': return 'destructive'
      case 'medium': return 'warning'
      case 'low': return 'secondary'
      default: return 'default'
    }
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Card 
        className="mb-3 cursor-pointer hover:shadow-md transition-shadow"
        onClick={() => onEdit(task)}
      >
        <CardContent className="p-4">
          <div className="flex justify-between items-start mb-2">
            <div className="flex-1">
              <h4 className="font-medium text-sm">{task.title}</h4>
              {task.client && (
                <p className="text-xs text-muted-foreground mt-1">{task.client.name}</p>
              )}
            </div>
            <Badge variant={getPriorityColor(task.priority) as any} className="text-xs">
              {task.priority?.charAt(0).toUpperCase() + task.priority?.slice(1)}
            </Badge>
          </div>
          
          <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
            {task.description}
          </p>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center space-x-3">
              {task.est_hours && (
                <div className="flex items-center">
                  <Clock className="h-3 w-3 mr-1" />
                  Est: {task.est_hours}h
                </div>
              )}
              {task.hours_spent && task.hours_spent > 0 && (
                <div className="flex items-center">
                  <Clock className="h-3 w-3 mr-1" />
                  Spent: {task.hours_spent}h
                </div>
              )}
            </div>
            {task.assigned_dev && (
              <div className="text-xs">
                Dev: {task.assigned_dev.email}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

interface KanbanColumnProps {
  title: string
  tasks: Task[]
  count: number
  status: 'queued' | 'in_progress' | 'done'
  onEditTask: (task: Task) => void
}

function KanbanColumn({ title, tasks, count, status, onEditTask }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id: status,
  })

  const taskIds = tasks.map(task => task.id)
  
  return (
    <div 
      ref={setNodeRef}
      className={`flex-1 min-w-0 border-2 rounded-lg p-4 transition-colors ${
        isOver 
          ? 'border-primary bg-primary/5' 
          : 'border-border bg-card'
      }`}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
          {title}
        </h3>
        <Badge variant="secondary" className="text-xs">
          {count}
        </Badge>
      </div>
      
      <div className="space-y-3 min-h-[200px]">
        {taskIds.length > 0 ? (
          <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
            {tasks.map((task) => (
              <TaskCard 
                key={task.id} 
                task={task}
                onEdit={onEditTask}
              />
            ))}
          </SortableContext>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">No tasks</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default function AdminTasksPage() {
  const [loading, setLoading] = useState(true)
  const [tasks, setTasks] = useState<Task[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [developers, setDevelopers] = useState<Developer[]>([])
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | 'queued' | 'in_progress' | 'done'>('all')
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'low' | 'medium' | 'high'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [editTaskOpen, setEditTaskOpen] = useState(false)
  const [selectedTask, setSelectedTask] = useState<Task | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = getBrowserSupabase()

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  useEffect(() => {
    // Get clientId from URL params
    const clientIdParam = searchParams.get('clientId')
    if (clientIdParam) {
      setSelectedClientId(clientIdParam)
    }
  }, [searchParams])

  useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        // Get user and verify admin/pm
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
          router.push('/login')
          return
        }

        const { data: memberships } = await supabase
          .from('client_members')
          .select('role')
          .eq('user_id', user.id)

        const isAdminOrPM = memberships?.some(m => m.role === 'admin' || m.role === 'pm')
        
        if (!isAdminOrPM) {
          router.push('/dashboard')
          return
        }

        // Load all clients
        const { data: clientsData } = await supabase
          .from('clients')
          .select('id, name')
          .order('name')

        if (clientsData) {
          setClients(clientsData)
        }

        // Load all developers (users with role 'dev')
        const { data: devsData } = await supabase
          .from('users')
          .select('id, email')
          .eq('role', 'dev')

        if (devsData) {
          setDevelopers(devsData)
        }

        // Load tasks
        await loadTasks()
      } catch (e) {
        console.error('Failed to load:', e)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [supabase, router])

  async function loadTasks() {
    try {
      let query = supabase
        .from('tasks')
        .select(`
          *,
          assigned_dev:users!tasks_assigned_dev_id_fkey(id, email),
          clients!inner(id, name)
        `)

      if (selectedClientId) {
        query = query.eq('client_id', selectedClientId)
      }

      const { data: tasksData, error } = await query
        .order('position', { ascending: true })
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching tasks:', error)
      } else if (tasksData) {
        setTasks(tasksData as any)
      }
    } catch (e) {
      console.error('Failed to load tasks:', e)
    }
  }

  useEffect(() => {
    loadTasks()
  }, [selectedClientId, supabase])

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = event

    if (!over) return

    const draggedTask = tasks.find(t => t.id === active.id)
    if (!draggedTask) return

    const targetStatus = ['queued', 'in_progress', 'done'].includes(over.id as string) 
      ? (over.id as string)
      : null

    if (targetStatus && draggedTask.status !== targetStatus) {
      const newStatus = targetStatus as 'queued' | 'in_progress' | 'done'

      // Update task status
      const updatedTasks = tasks.map(task =>
        task.id === draggedTask.id ? { ...task, status: newStatus } : task
      )
      setTasks(updatedTasks)

      try {
        await fetch(`/api/tasks/${draggedTask.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        })
        loadTasks()
      } catch (error) {
        console.error('Failed to update task:', error)
        loadTasks()
      }
    }
  }

  const filteredTasks = tasks.filter(task => {
    if (statusFilter !== 'all' && task.status !== statusFilter) return false
    if (priorityFilter !== 'all' && task.priority !== priorityFilter) return false
    if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !task.description?.toLowerCase().includes(searchQuery.toLowerCase())) return false
    return true
  })

  const queuedTasks = filteredTasks.filter(t => t.status === 'queued')
  const inProgressTasks = filteredTasks.filter(t => t.status === 'in_progress')
  const doneTasks = filteredTasks.filter(t => t.status === 'done')

  const onEditTask = (task: Task) => {
    setSelectedTask(task)
    setEditTaskOpen(true)
  }

  return (
    <DashboardLayout isAdmin={true}>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center space-y-4 sm:space-y-0">
          <div>
            <h1 className="text-2xl font-bold">All Tasks</h1>
            <p className="text-muted-foreground">Manage tasks across all clients</p>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label>Client</Label>
                <select
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={selectedClientId || ''}
                  onChange={(e) => {
                    setSelectedClientId(e.target.value || null)
                    if (e.target.value) {
                      router.push(`/admin/tasks?clientId=${e.target.value}`)
                    } else {
                      router.push('/admin/tasks')
                    }
                  }}
                >
                  <option value="">All Clients</option>
                  {clients.map(client => (
                    <option key={client.id} value={client.id}>{client.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <select
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                >
                  <option value="all">All Status</option>
                  <option value="queued">Queued</option>
                  <option value="in_progress">In Progress</option>
                  <option value="done">Done</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label>Priority</Label>
                <select
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value as any)}
                >
                  <option value="all">All Priorities</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label>Search</Label>
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search tasks..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Edit Task Dialog */}
        {selectedTask && (
          <EditTaskDialog
            isOpen={editTaskOpen}
            onClose={() => {
              setEditTaskOpen(false)
              setSelectedTask(null)
            }}
            task={selectedTask}
            clientId={selectedTask.client_id}
            userRole="pm"
            onTaskUpdated={() => {
              loadTasks()
            }}
          />
        )}

        {/* Task Board */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <KanbanColumn 
              title="Queued" 
              tasks={queuedTasks} 
              count={queuedTasks.length}
              status="queued"
              onEditTask={onEditTask}
            />
            <KanbanColumn 
              title="In Progress" 
              tasks={inProgressTasks}
              count={inProgressTasks.length}
              status="in_progress"
              onEditTask={onEditTask}
            />
            <KanbanColumn 
              title="Done" 
              tasks={doneTasks}
              count={doneTasks.length}
              status="done"
              onEditTask={onEditTask}
            />
          </div>

          <DragOverlay>
            {activeId ? (() => {
              const activeTask = tasks.find(t => t.id === activeId)
              if (!activeTask) return null
              return (
                <Card className="w-64 shadow-2xl">
                  <CardContent className="p-4">
                    <h4 className="font-medium text-sm">{activeTask.title}</h4>
                  </CardContent>
                </Card>
              )
            })() : null}
          </DragOverlay>
        </DndContext>
      </div>
    </DashboardLayout>
  )
}

