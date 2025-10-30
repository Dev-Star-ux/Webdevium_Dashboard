import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getServerSupabase } from '@/lib/supabase/server'

const updateSchema = z.object({
  est_hours: z.number().int().min(0).optional(),
  status: z.enum(['queued','in_progress','done']).optional(),
  assigned_dev_id: z.string().uuid().nullable().optional()
}).refine((data) => Object.keys(data).length > 0, { message: 'No fields to update' })

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await getServerSupabase()
  const body = await req.json().catch(() => ({}))
  const parsed = updateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { id } = await params
  const { data, error } = await supabase
    .from('tasks')
    .update(parsed.data as any)
    .eq('id', id)
    .select('*')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ task: data })
}


