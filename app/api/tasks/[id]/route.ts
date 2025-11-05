import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getServerSupabase } from '@/lib/supabase/server'

const updateSchema = z.object({
  title: z.string().min(3).optional(),
  description: z.string().nullable().optional(),
  priority: z.enum(['low','medium','high']).optional(),
  est_hours: z.number().int().min(0).nullable().optional(),
  status: z.enum(['queued','in_progress','done']).optional(),
  assigned_dev_id: z.string().uuid().nullable().optional(),
  position: z.number().int().min(0).optional(),
  completed_at: z.string().nullable().optional()
}).refine((data) => Object.keys(data).length > 0, { message: 'No fields to update' })

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await getServerSupabase()
  const body = await req.json().catch(() => ({}))
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { id } = await params
  
  // Handle completed_at - set to now() if status is 'done', null otherwise
  const updateData: any = { ...parsed.data }
  
  // Remove completed_at from parsed data if it exists (we'll handle it based on status)
  if ('completed_at' in updateData) {
    delete updateData.completed_at
  }
  
  if (updateData.status === 'done') {
    // Only set completed_at if it's not already set
    const { data: currentTask } = await supabase
      .from('tasks')
      .select('completed_at')
      .eq('id', id)
      .single()
    
    if (!currentTask?.completed_at) {
      updateData.completed_at = new Date().toISOString()
    }
  } else if (updateData.status && updateData.status !== 'done') {
    updateData.completed_at = null
  }

  const { data, error } = await supabase
    .from('tasks')
    .update(updateData)
    .eq('id', id)
    .select(`
      *,
      assigned_dev:users!tasks_assigned_dev_id_fkey(id, email)
    `)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ task: data })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await getServerSupabase()
  const { id } = await params

  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ success: true })
}


